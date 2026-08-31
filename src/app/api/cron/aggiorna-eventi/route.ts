import { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import {
  classificaPerKeyword,
  correggiRandonnee,
  validaTipologia,
  TIPOLOGIE_DESCRIZIONI,
  TIPOLOGIA_ID_MAP,
} from "@/lib/classifica-tipologia"

const MAX_EVENTI_PER_RUN = 5
const GIORNI_TRA_CONTROLLI = 7

type PercorsoTrovato = {
  nome: string
  km: number
  dislivello: number | null
  tipologia: string | null
}

type EventoAggiornato = {
  nome: string
  data: string | null
  luogo: string | null
  tipologia: string | null
  url: string
  percorsi: PercorsoTrovato[]
  cancellato?: boolean
}

const SITI_PREFERENZIALI = [
  "gravelland.it", "battistrada.com", "audaxitalia.it", "granfondo.it", "endu.net",
]

function dominioUrl(url: string): string {
  try { return new URL(url).hostname.replace("www.", "") } catch { return "" }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== "Bearer " + cronSecret) {
    return Response.json({ error: "Non autorizzato" }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const admin = createSupabaseAdminClient()

  const sogliaData = new Date()
  sogliaData.setDate(sogliaData.getDate() - GIORNI_TRA_CONTROLLI)

  const { data: eventiDaControllare, error } = await supabase
    .from("eventi")
    .select("id, nome, data_evento, luogo, tipologia, url, attivo, ultimo_controllo")
    .eq("attivo", true)
    .or("ultimo_controllo.is.null,ultimo_controllo.lt." + sogliaData.toISOString())
    .order("ultimo_controllo", { ascending: true, nullsFirst: true })
    .limit(MAX_EVENTI_PER_RUN)

  if (error || !eventiDaControllare?.length) {
    return Response.json({ messaggio: "Nessun evento da controllare", aggiornati: 0 })
  }

  const eventIds = eventiDaControllare.map(e => e.id)
  const { data: percorsiAttuali } = await supabase
    .from("percorsi")
    .select("id, evento_id, nome_percorso, km, dislivello_m, tipologia_id, tipologie_evento(nome)")
    .in("evento_id", eventIds)

  const percorsiPerEvento: Record<string, PercorsoTrovato[]> = {}
  for (const p of percorsiAttuali ?? []) {
    const eid = String(p.evento_id)
    if (!percorsiPerEvento[eid]) percorsiPerEvento[eid] = []
    percorsiPerEvento[eid].push({
      nome: p.nome_percorso ?? "",
      km: p.km ?? 0,
      dislivello: p.dislivello_m ?? null,
      tipologia: (p.tipologie_evento as any)?.nome ?? null,
    })
  }

  const tavilyKey = process.env.TAVILY_API_KEY
  const googleKey = process.env.GOOGLE_AI_API_KEY
  let aggiornati = 0
  let disattivati = 0
  const log: string[] = []

  for (const evento of eventiDaControllare) {
    try {
      let results: { title: string; url: string; content: string }[] = []

      if (tavilyKey) {
        const body1 = JSON.stringify({ api_key: tavilyKey, query: evento.nome + " ciclismo percorsi km dislivello", search_depth: "advanced", max_results: 5, include_answer: false, include_domains: SITI_PREFERENZIALI })
        const r1 = await fetch("https://api.tavily.com/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: body1 })
        if (r1.ok) results = (await r1.json()).results ?? []
        if (!results.length) {
          const body2 = JSON.stringify({ api_key: tavilyKey, query: evento.nome + " ciclismo percorsi km dislivello", search_depth: "basic", max_results: 5, include_answer: false })
          const r2 = await fetch("https://api.tavily.com/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: body2 })
          if (r2.ok) results = (await r2.json()).results ?? []
        }
      }

      if (!results.length) {
        await admin.from("eventi").update({ attivo: false, ultimo_controllo: new Date().toISOString() }).eq("id", evento.id)
        disattivati++
        log.push("X " + evento.nome + ": nessun risultato, disattivato")
        continue
      }

      if (!googleKey) {
        await admin.from("eventi").update({ ultimo_controllo: new Date().toISOString() }).eq("id", evento.id)
        continue
      }

      const textResults = results.map(r => "TITOLO: " + r.title + "\nURL: " + r.url + "\nCONTENUTO: " + r.content).join("\n\n---\n\n")
      const prompt = "Dai seguenti risultati di ricerca, estrai i dati aggiornati per l evento ciclistico " + evento.nome + ".\n\nRestituisci UN SOLO oggetto JSON con:\n- nome\n- data: YYYY-MM-DD o null\n- luogo: citta o null\n- tipologia\n- url\n- percorsi: [{nome,km,dislivello,tipologia}]\n- cancellato: true/false\n\n" + TIPOLOGIE_DESCRIZIONI + "\n\nRestituisci SOLO JSON valido.\n\nRISULTATI:\n" + textResults

      const gr = await fetch("https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=" + googleKey, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) })
      if (!gr.ok) { await admin.from("eventi").update({ ultimo_controllo: new Date().toISOString() }).eq("id", evento.id); continue }

      const gd = await gr.json()
      const raw: string = gd.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ""
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()

      let parsed: EventoAggiornato
      try { parsed = JSON.parse(cleaned) } catch { await admin.from("eventi").update({ ultimo_controllo: new Date().toISOString() }).eq("id", evento.id); continue }

      if (parsed.cancellato) {
        await admin.from("eventi").update({ attivo: false, ultimo_controllo: new Date().toISOString() }).eq("id", evento.id)
        disattivati++
        log.push("! " + evento.nome + ": cancellato")
        continue
      }

      const dominio = dominioUrl(parsed.url ?? evento.url ?? "")
      const kmMax = parsed.percorsi?.length > 0 ? Math.max(...parsed.percorsi.map(p => p.km ?? 0)) : null
      const tipologiaKeyword = classificaPerKeyword(parsed.nome ?? evento.nome, dominio, kmMax)
      let tipologiaFinale = tipologiaKeyword ?? validaTipologia(parsed.nome ?? evento.nome, parsed.tipologia, dominio, kmMax) ?? correggiRandonnee(parsed.tipologia, kmMax)
      if (!tipologiaFinale) tipologiaFinale = evento.tipologia ?? null

      const isRandonnee = tipologiaFinale?.toLowerCase().includes("randonn") || (parsed.nome ?? evento.nome).toLowerCase().includes("randonn")
      const percorsiPreesistenti = percorsiPerEvento[String(evento.id)] ?? []
      const percorsiCorretti = (parsed.percorsi ?? percorsiPreesistenti).map((p: PercorsoTrovato) => {
        const kmP = p.km ?? null
        let tipP: string | null
        if (dominio === "gravelland.it") tipP = "Gravel di GRAvellAND"
        else if (isRandonnee || p.tipologia?.toLowerCase().includes("randonn")) tipP = kmP != null ? (kmP <= 120 ? "Randonn\u00e9e fino a 120Km" : "Randonn\u00e9e oltre i 120Km") : p.tipologia
        else tipP = classificaPerKeyword(p.nome ?? "", dominio, kmP) ?? validaTipologia(p.nome ?? "", p.tipologia, dominio, kmP) ?? correggiRandonnee(p.tipologia, kmP)
        return { ...p, tipologia: tipP }
      })

      await admin.from("eventi").update({ nome: parsed.nome ?? evento.nome, data_evento: parsed.data ?? evento.data_evento, luogo: parsed.luogo ?? evento.luogo, tipologia: tipologiaFinale, url: parsed.url ?? evento.url, attivo: true, ultimo_controllo: new Date().toISOString() }).eq("id", evento.id)

      if (percorsiCorretti.length > 0) {
        await admin.from("percorsi").delete().eq("evento_id", evento.id)
        await admin.from("percorsi").insert(percorsiCorretti.map(p => ({ evento_id: evento.id, nome_percorso: p.nome ?? "Percorso unico", km: p.km ?? null, dislivello_m: p.dislivello ?? null, tipologia_id: p.tipologia ? (TIPOLOGIA_ID_MAP[p.tipologia] ?? null) : null })))
      }

      aggiornati++
      log.push("OK " + evento.nome + ": aggiornato (" + (tipologiaFinale ?? "nessuna") + ")")
    } catch (e) {
      log.push("WARN " + evento.nome + ": errore - " + e)
    }
  }

  return Response.json({ messaggio: "Controllo completato: " + aggiornati + " aggiornati, " + disattivati + " disattivati", log })
}
