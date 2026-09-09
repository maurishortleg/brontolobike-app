import { createClient } from '@supabase/supabase-js';
import https from 'https';
import fs from 'fs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Leggo .env.local manualmente
const envPath = path.join(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);


// ─── CORREZIONI APPROVATE ─────────────────────────────────────────────────────

// ID da eliminare (doppioni)
const ID_DA_ELIMINARE = new Set([111, 179, 273, 196, 357]);

// Correzioni tipologia (ID → nuova tipologia)
const CORREZIONI_TIPOLOGIA = {
  64:  'Randonnée oltre i 120Km',
  159: 'Randonnée fino a 120Km',
  203: 'Gran/Medio Fondo',
  247: 'Pedalata Cicloturistica',
  267: 'Randonnée oltre i 120Km',
  268: 'Gravel',
  213: 'Gravel di GRAvelAND',
  381: 'Brontolo Bike Day',
};

// Correzioni km mancanti (ID → { km, km_effettivi })
const CORREZIONI_KM = {
  319: { km: 49, km_effettivi: 49 },
  389: { km: 66, km_effettivi: 66 },
};

// ─── FORMULA PUNTI ───────────────────────────────────────────────────────────
const TIPOLOGIE_INFO = {
  'Gran/Medio Fondo':           { coeff: 2,  fissi: null, ignora: false },
  'Randonnée fino a 120Km':     { coeff: 2,  fissi: null, ignora: false },
  'Randonnée oltre i 120Km':    { coeff: 1,  fissi: null, ignora: false },
  'Pedalata Cicloturistica':    { coeff: 2,  fissi: null, ignora: false },
  'Brevetto Permanente Strada': { coeff: 1,  fissi: null, ignora: false },
  'Brevetto Permanente Gravel': { coeff: 3,  fissi: null, ignora: false },
  'Percorso con Credenziale':   { coeff: 1,  fissi: null, ignora: false },
  'Ciclocross':                 { coeff: 4,  fissi: null, ignora: false },
  'MTB':                        { coeff: 4,  fissi: null, ignora: false },
  'Gravel':                     { coeff: 3,  fissi: null, ignora: false },
  'Gara in Circuito (CRIT)':    { coeff: 4,  fissi: null, ignora: false },
  'Gravel di GRAvelAND':        { coeff: 5,  fissi: null, ignora: false },
  'Trail':                      { coeff: 1,  fissi: null, ignora: false },
  'Brontolo Bike Day':          { coeff: 15, fissi: null, ignora: false },
  'Uva Fragola':                { coeff: 15, fissi: null, ignora: false },
  'Bike Camp Livigno':          { coeff: 1,  fissi: 1000, ignora: true  },
};

function calcolaPunti(tipologia, kmEff, dislivEff) {
  const info = TIPOLOGIE_INFO[tipologia];
  if (!info) { console.warn('Tipologia sconosciuta:', tipologia); return 0; }
  if (info.ignora) return info.fissi;
  return Math.ceil(parseFloat(kmEff || 0) * info.coeff + parseInt(dislivEff || 0) * 0.1);
}

// ─── PARSING CSV ─────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const headers = lines[0].replace(/"/g, '').split(',');
  return lines.slice(1).map(line => {
    // Parse CSV handling commas inside quotes
    const vals = [];
    let inQ = false, cur = '';
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    vals.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i] || '');
    return obj;
  });
}

function fetchCSV(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400) {
        return fetchCSV(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('📥 Scarico il CSV...');
  const csv = await fetchCSV(
    'https://docs.google.com/spreadsheets/d/1Uzozo81no1LgDEEPLc5vnOXkScc8dWUpB0JZlZ1kZrg/gviz/tq?tqx=out:csv&sheet=CalcoloPuntiSingoliEventi'
  );
  let rows = parseCSV(csv);
  console.log(`✅ ${rows.length} righe scaricate`);

  // ── Applica correzioni ──
  rows = rows.filter(r => !ID_DA_ELIMINARE.has(parseInt(r.ID_Partecipazione)));
  console.log(`✅ ${rows.length} righe dopo rimozione doppioni`);

  rows = rows.map(r => {
    const id = parseInt(r.ID_Partecipazione);
    if (CORREZIONI_TIPOLOGIA[id]) {
      r.TipologiaEventoEffettiva = CORREZIONI_TIPOLOGIA[id];
    }
    if (CORREZIONI_KM[id]) {
      r.KmUfficialiEffettivi = String(CORREZIONI_KM[id].km);
      r.KmEffettiviPerCAlcolo = String(CORREZIONI_KM[id].km_effettivi);
    }
    // Trim trailing spaces from tipologia
    r.TipologiaEventoEffettiva = (r.TipologiaEventoEffettiva || '').trim();
    return r;
  });

  // ── Leggo stagione attiva ──
  const { data: stagioni } = await sb.from('stagioni').select('*').eq('attiva', true).single();
  const stagione_id = stagioni.id;
  console.log(`📅 Stagione attiva: ${stagioni.anno} (id=${stagione_id})`);

  // ── Leggo tipologie per ID lookup ──
  const { data: tipologieDB } = await sb.from('tipologie_evento').select('id, nome');
  const tipologiaIdMap = {};
  tipologieDB.forEach(t => tipologiaIdMap[t.nome.trim()] = t.id);

  // ── Leggo atleti dal DB e costruisco mappa nome → id ──
  const { data: atletiDB } = await sb.from('atleti').select('id, nome_cognome');
  const atletiByName = {};
  atletiDB.forEach(a => {
    atletiByName[a.nome_cognome.toLowerCase().trim()] = a.id;
  });
  console.log(`✅ ${atletiDB.length} atleti caricati dal DB`);

  // Funzione per trovare atleta_id dal nome del CSV
  function trovaAtletaId(nomeCsv) {
    const key = nomeCsv.toLowerCase().trim();
    if (atletiByName[key]) return atletiByName[key];
    // Prova con apostrofo diverso
    const keyAlt = key.replace(/'/g, "'").replace(/'/g, "'");
    if (atletiByName[keyAlt]) return atletiByName[keyAlt];
    // Prova ricerca parziale
    const found = Object.keys(atletiByName).find(k => k === keyAlt || k.replace(/'/g, "'") === keyAlt);
    return found ? atletiByName[found] : null;
  }

  // ── Raccogli eventi unici ──
  // Chiave: ID_Evento_Sheet (se presente) oppure NomeEvento_Effettivo+DataEffettivaPartecipazione
  const eventiMap = new Map(); // key → { nome, data, url? }
  
  for (const r of rows) {
    const chiave = r.ID_Evento_Sheet || `MANUALE:${r.NomeEvento_Effettivo}:${r.DataEffettivaPartecipazione}`;
    if (!eventiMap.has(chiave)) {
      // Estrai data (formato DD/MM/YYYY HH.MM.SS)
      const dateParts = r.DataEffettivaPartecipazione.split(' ')[0].split('/');
      const dataISO = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
      eventiMap.set(chiave, {
        nome: r.NomeEvento_Effettivo.trim(),
        data_evento: dataISO,
        stagione_id,
      });
    }
  }

  console.log(`\n🗓️  ${eventiMap.size} eventi unici da creare/trovare...`);

  // ── Crea o trova eventi ──
  const eventoDbMap = new Map(); // chiave → evento_id in DB

  for (const [chiave, ev] of eventiMap) {
    // Cerca evento esistente per nome e data
    const { data: existing } = await sb.from('eventi')
      .select('id')
      .eq('nome', ev.nome)
      .eq('data_evento', ev.data_evento)
      .maybeSingle();

    if (existing) {
      eventoDbMap.set(chiave, existing.id);
    } else {
      const { data: created, error } = await sb.from('eventi').insert({
        nome: ev.nome,
        data_evento: ev.data_evento,
        stagione_id: ev.stagione_id,
      }).select('id').single();
      if (error) {
        console.error('Errore creazione evento:', ev.nome, error.message);
        continue;
      }
      eventoDbMap.set(chiave, created.id);
    }
  }
  console.log(`✅ ${eventoDbMap.size} eventi mappati`);

  // ── Raccogli percorsi unici (per evento+km+dislivello+tipologia) ──
  const percorsiMap = new Map(); // `eventoId:km:dislivello:tipologiaId` → percorso_id

  async function getOrCreatePercorso(evento_id, km, dislivello_m, tipologia_nome) {
    const tipologia_id = tipologiaIdMap[tipologia_nome] || tipologiaIdMap['Gravel'] || null;
    const key = `${evento_id}:${km}:${dislivello_m}:${tipologia_id}`;
    
    if (percorsiMap.has(key)) return percorsiMap.get(key);

    // Cerca percorso esistente
    const { data: existing } = await sb.from('percorsi')
      .select('id')
      .eq('evento_id', evento_id)
      .eq('km', km)
      .eq('dislivello_m', dislivello_m)
      .maybeSingle();

    if (existing) {
      percorsiMap.set(key, existing.id);
      return existing.id;
    }

    const { data: created, error } = await sb.from('percorsi').insert({
      evento_id,
      nome_percorso: 'Unico',
      km: parseFloat(km),
      dislivello_m: parseInt(dislivello_m) || 0,
      tipologia_id,
    }).select('id').single();

    if (error) {
      console.error('Errore creazione percorso:', error.message);
      return null;
    }
    percorsiMap.set(key, created.id);
    return created.id;
  }

  // ── Inserisci registrazioni ──
  console.log('\n📝 Inserisco registrazioni...');
  let ok = 0, skip = 0, err = 0;

  for (const r of rows) {
    const chiaveEvento = r.ID_Evento_Sheet || `MANUALE:${r.NomeEvento_Effettivo}:${r.DataEffettivaPartecipazione}`;
    const evento_id = eventoDbMap.get(chiaveEvento);
    if (!evento_id) { console.warn('Evento non trovato:', chiaveEvento); err++; continue; }

    const tipologia = r.TipologiaEventoEffettiva;
    const kmUfficiali = r.KmUfficialiEffettivi;
    const dislivUfficiale = r.DislivelloUfficialeEffettivo;

    const percorso_id = await getOrCreatePercorso(evento_id, kmUfficiali, dislivUfficiale, tipologia);
    if (!percorso_id) { err++; continue; }

    const completato = r.ConclusoComeDaProgramma_InputAtleta === 'Sì';
    const kmEff = r.KmEffettiviPerCAlcolo || kmUfficiali;
    const dislivEff = r.DislivelloEffettivoPerCalcolo || dislivUfficiale;
    const punti = calcolaPunti(tipologia, kmEff, dislivEff);

    const atleta_id = trovaAtletaId(r.NomeCognomeAtleta);
    if (!atleta_id) {
      console.warn(`⚠️  Atleta non trovato in DB: "${r.NomeCognomeAtleta}" (riga ${r.ID_Partecipazione})`);
      err++;
      continue;
    }

    const { error: regErr } = await sb.from('registrazioni').insert({
      atleta_id,
      percorso_id,
      stagione_id,
      completato,
      km_effettivi: parseFloat(kmEff) || null,
      dislivello_eff: parseInt(dislivEff) || null,
      punti,
    });

    if (regErr) {
      if (regErr.code === '23505') {
        // Unique constraint → doppione accettato dall'utente
        skip++;
      } else {
        console.error(`Errore riga ${r.ID_Partecipazione} (${r.NomeCognomeAtleta}):`, regErr.message);
        err++;
      }
    } else {
      ok++;
    }
  }

  console.log(`\n✅ Importazione completata:`);
  console.log(`   📗 Inserite: ${ok}`);
  console.log(`   ⏭️  Duplicate skippate: ${skip}`);
  console.log(`   ❌ Errori: ${err}`);

  // ── Verifica finale ──
  const { count } = await sb.from('registrazioni').select('*', { count: 'exact', head: true });
  console.log(`\n📊 Totale registrazioni in DB: ${count}`);
}

main().catch(console.error);
