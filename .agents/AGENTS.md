# BrontoloBike App — Contesto di Progetto

## Cos'è questo progetto
Web app per la gestione del **campionato sociale ciclistico del team BrontoloBike**.
Permette agli atleti di registrare gli eventi a cui hanno partecipato, calcola automaticamente
il punteggio, mostra classifiche, statistiche e confronti.

📄 Requisiti completi: `docs/BrontoloBike_Requisiti.md`
📅 Piano di sviluppo: `docs/BrontoloBike_Piano_Sviluppo.md`

---

## Stack tecnico

| Livello | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Database + Auth | Supabase (Postgres + OAuth Google) |
| Styling | Tailwind CSS v4 |
| AI ricerca | Tavily API (ricerca web) + Google Gemini 2.5 Flash (estrazione dati) |
| Hosting | Vercel (deploy automatico da GitHub) |

---

## Struttura chiave

```
src/
  app/
    page.tsx              — Home (server component)
    registra/             — Registrazione evento (RegistraClient.tsx, 770 righe)
    classifica/           — Classifica generale
    calendario/           — Vista calendario mensile
    atleta/[id]/          — Scheda atleta
    miei-eventi/          — Lista eventi personali
    admin/                — Pannello admin (AdminClient.tsx)
    api/
      cerca-evento/       — Ricerca AI eventi (Tavily + Gemini)
      admin/atleti/       — CRUD admin atleti
      admin/registrazioni/— CRUD admin registrazioni
      admin/fonti/        — Gestione fonti eventi
      classifica/         — Dati classifica
      miei-eventi/        — Dati eventi personali
      ...altri endpoint
  lib/
    supabase-server.ts    — Client Supabase server-side (cookie-based)
    supabase-browser.ts   — Client Supabase browser-side
    supabase-admin.ts     — Client Supabase con service_role (solo API admin)
    is-admin.ts           — Check ruolo admin via ADMIN_EMAIL env var
    punteggio.ts          — Formula calcolo punti (Math.ceil)
    tavily.ts             — Integrazione Tavily (ricerca in 2 fasi)
    date-utils.ts         — Utilità date
  components/
    PageShell.tsx         — Layout comune pagine interne
supabase/
  schema.sql              — Schema DB completo (atleti, eventi, percorsi, registrazioni)
  rls_fix.sql             — Policy RLS aggiornate (da eseguire su Supabase SQL Editor)
```

---

## Stato avanzamento blocchi

- [x] **Blocco 0** — Avvio progetto (Next.js, GitHub, Vercel, Supabase)
- [x] **Blocco 1** — Schema dati + importazione 377 atleti
- [x] **Blocco 2** — Autenticazione (Google OAuth + modalità senza account; Facebook rimandato)
- [x] **Blocco 3** — Registrazione evento + calcolo punteggio
- [x] **Blocco 4** — Ricerca AI eventi (Tavily + Gemini Vision)
- [x] **Blocco SICUREZZA** — Fix sicurezza completo (vedi sezione dedicata)
- [ ] **Blocco 5** — Calendario (prossimo da fare)
- [ ] **Blocco 6** — Statistiche e classifiche
- [ ] **Blocco 7** — Scheda atleta
- [ ] **Blocco 8** — Pannello amministratore
- [ ] **Blocco 9** — Rifinitura e deploy finale

---

## Sicurezza — Fix applicati (sessione del 30/06/2026)

### A — `src/lib/is-admin.ts`
Email admin **mai hardcoded nel codice**. Usa solo variabili d'ambiente:
- `ADMIN_EMAIL` → singola email admin
- `ADMIN_EMAILS` → più email separate da virgola

### B — `supabase/rls_fix.sql` *(da applicare su Supabase SQL Editor)*
Policy RLS complete:
- `registrazioni` DELETE → solo il proprietario (`registrato_da = auth.uid()`)
- `registrazioni` UPDATE → solo il proprietario
- `atleti`, `eventi_ricercati`, `fonti_eventi` → nessuna policy di scrittura client (solo service_role)
- `eventi`, `percorsi` → INSERT consentito solo ad autenticati (necessario per il flusso di registrazione)

> ⚠️ Se non l'hai ancora fatto, esegui `supabase/rls_fix.sql` nel SQL Editor di Supabase.

### C — API admin (`src/app/api/admin/*/route.ts`)
Tutte le **scritture** nelle route admin usano `createSupabaseAdminClient()` (service_role).
Il check `isAdmin()` rimane sul client normale (per verificare l'identità).
Pattern corretto:
```ts
const supabase = await createSupabaseServerClient()  // per auth check
const { data: { user } } = await supabase.auth.getUser()
if (!isAdmin(user)) return Response.json({ error: 'Non autorizzato' }, { status: 403 })

const admin = createSupabaseAdminClient()  // per scritture
await admin.from('tabella').update(...).eq('id', id)
```

### D — `src/app/api/cerca-evento/route.ts`
Endpoint protetto contro abusi anonimi.
Accettato se: utente autenticato CON sessione Supabase, OPPURE body contiene `atleta_id`
(modalità senza account). Il `RegistraClient.tsx` già passa `atleta_id` nel body.

---

## Regole business principali

### Formula punteggio
```
Punti = CEIL( km × coefficiente_km + dislivello_m × 0.1 )
```
Eccezione: se `ignora_km_dislivello = true` → usa `punti_fissi` direttamente.
Implementata in `src/lib/punteggio.ts`.

### Categorie atleti
- **Amatori**: soglia Finisher = 9000 punti
- **Cicloturisti**: soglia Finisher = 4000 punti
- Categoria **fissa per tutta la stagione**; il cambio vale dalla stagione successiva.

### Autenticazione
- Google OAuth (funzionante)
- Facebook OAuth (rimandato al Blocco 9)
- Senza account: atleta seleziona il proprio nome dalla lista (nessun PIN, contesto di fiducia interna)
  - L'`atleta_id` scelto viene salvato in `localStorage` come `atleta_selezionato`

### Admin
- Identificato via `ADMIN_EMAIL` (env var)
- Può modificare qualsiasi dato senza approvazione preventiva
- Le operazioni admin usano `service_role` key lato backend

---

## Variabili d'ambiente richieste

| Variabile | Dove ottenerla |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dashboard Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard Supabase → Settings → API (secret) |
| `ADMIN_EMAIL` | La tua email admin |
| `TAVILY_API_KEY` | app.tavily.com |
| `GOOGLE_AI_API_KEY` | aistudio.google.com/apikey |

---

## Design system

Palette ispirata alla maglia del team (definita in `src/app/globals.css`):
- `--bb-yellow: #D8FF00` (giallo neon)
- `--bb-pink:   #FF006E` (fucsia)
- `--bb-blue:   #0055CC` (blu elettrico)
- `--bb-orange: #FF5500` (arancio)
- `--bb-black:  #0A0A0A` (nero)

Classi CSS custom: `bb-btn-primary`, `bb-btn-outline`, `bb-card`, `bb-card-content`,
`bb-text-gradient`, `bb-stripe`, `bb-bg`.

---

## Note operative per l'AI

- **Leggi sempre** `docs/BrontoloBike_Requisiti.md` prima di implementare nuove feature
- **Controlla sempre** `docs/BrontoloBike_Piano_Sviluppo.md` per il blocco corrente
- Per le API admin: usa **sempre** `createSupabaseAdminClient()` per le scritture
- Il database ha una sola stagione attiva per volta (`stagioni.attiva = true`)
- Il campo `registrazioni.registrato_da` = `auth.uid()` dell'utente che ha inserito il dato
- Gli atleti "senza account" non hanno `user_id` sulla tabella `atleti` — si identificano
  solo tramite `atleta_id` in `localStorage`
- `RegistraClient.tsx` è il componente più grande (770 righe) — valuta di estrarne sotto-componenti
  se devi modificarlo in modo significativo
