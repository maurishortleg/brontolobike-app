const XLSX = require('xlsx');
const fs = require('fs');

const wb = XLSX.readFile('C:/Users/Mauri/Downloads/Import di Campionato Sociale BB 2026.xlsx');
function sheetToJson(name) {
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
}
function excelDateToISO(serial) {
  if (typeof serial !== 'number' || serial === 0) return null;
  return new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().split('T')[0];
}
function esc(s) { return String(s).trim().replace(/'/g, "''"); }

let righe = sheetToJson('CalcoloPuntiSingoliEventi').filter(r => r['ID_Atleta'] !== '');

// ===== CORREZIONI =====

// 1. Normalizza varianti Greenland Varese → "Greenland Varese"
righe = righe.map(r => {
  const n = r['NomeEvento_Effettivo'].trim();
  if (['Greenlands Varese', 'Greenland Varese 2026', 'Greenland Varese'].includes(n)) {
    return { ...r, NomeEvento_Effettivo: 'Greenland Varese' };
  }
  return r;
});

// 2. Rimuovi Bruschi Manuela duplicata (tieni km=61/257pt, rimuovi km=60/254pt)
let bruschiGreenlandRemosso = false;
righe = righe.filter(r => {
  if (r['NomeCognomeAtleta'] === 'Bruschi Manuela' &&
      r['NomeEvento_Effettivo'].trim() === 'Greenland Varese' &&
      r['KmUfficialiEffettivi'] === 60 &&
      r['PuntiEventoCalcolati'] === 254) {
    if (!bruschiGreenlandRemosso) { bruschiGreenlandRemosso = true; return false; }
  }
  return true;
});

// 3. Rimuovi "Gravel Colli Novarese" (0pt) di Macchi Guido
righe = righe.filter(r => !(
  r['NomeCognomeAtleta'] === 'Macchi Guido' &&
  r['NomeEvento_Effettivo'].trim() === 'Gravel Colli Novarese'
));

// 4. OMG manuale → collega agli eventi ufficiali
//    Milanato 93km → EVE_9010 (OMG 93)
//    Bresciani 77km → EVE_9011 (OMG 77)
righe = righe.map(r => {
  if (r['NomeEvento_Effettivo'].trim() === 'OMG' && !r['ID_Evento_Sheet']) {
    if (r['NomeCognomeAtleta'] === 'Milanato Valerio') {
      return { ...r, ID_Evento_Sheet: 'EVE_9010', NomeEvento_Effettivo: 'OMG 93' };
    }
    if (r['NomeCognomeAtleta'] === 'Bresciani Sergio Diomiro') {
      return { ...r, ID_Evento_Sheet: 'EVE_9011', NomeEvento_Effettivo: 'OMG 77' };
    }
  }
  return r;
});

// ===== COSTRUZIONE MAPPA EVENTI =====
function evKey(r) {
  if (r['ID_Evento_Sheet']) return r['ID_Evento_Sheet'];
  const data = excelDateToISO(r['DataEffettivaPartecipazione']) || '';
  return 'MANUAL|' + r['NomeEvento_Effettivo'].trim() + '|' + data;
}

const eventiMap = {};
for (const r of righe) {
  const key = evKey(r);
  if (!eventiMap[key]) {
    eventiMap[key] = {
      nome: r['NomeEvento_Effettivo'].trim(),
      data: excelDateToISO(r['DataEffettivaPartecipazione']),
      km: r['KmUfficialiEffettivi'] || r['KmEffettiviPerCAlcolo'] || 0,
      dislivello: r['DislivelloUfficialeEffettivo'] || r['DislivelloEffettivoPerCalcolo'] || 0,
    };
  }
}

console.log('Eventi unici dopo correzioni:', Object.keys(eventiMap).length);
console.log('Registrazioni dopo correzioni:', righe.length);

// ===== GENERAZIONE SQL =====
const STAGIONE_ID = 1;
const sql = [];

sql.push('-- ===== EVENTI E PERCORSI =====');
for (const [key, ev] of Object.entries(eventiMap)) {
  sql.push("INSERT INTO eventi (nome, data_evento, stagione_id)");
  sql.push("VALUES ('" + esc(ev.nome) + "', '" + ev.data + "', " + STAGIONE_ID + ");");
  sql.push("INSERT INTO percorsi (evento_id, nome_percorso, km, dislivello_m)");
  sql.push("SELECT id, '" + esc(ev.nome) + "', " + ev.km + ", " + ev.dislivello);
  sql.push("FROM eventi WHERE nome = '" + esc(ev.nome) + "' AND stagione_id = " + STAGIONE_ID + " ORDER BY id DESC LIMIT 1;");
  sql.push('');
}

sql.push('-- ===== REGISTRAZIONI =====');
function safeNum(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }
for (const r of righe) {
  const ev = eventiMap[evKey(r)];
  const nomeAtleta = esc(r['NomeCognomeAtleta']);
  const completato = r['ConclusoComeDaProgramma_InputAtleta'] === 'Sì' ? 'true' : 'false';
  const kmEff = safeNum(r['KmEffettiviPerCAlcolo']) || safeNum(r['KmUfficialiEffettivi']);
  const dislivEff = safeNum(r['DislivelloEffettivoPerCalcolo']) || safeNum(r['DislivelloUfficialeEffettivo']);
  const punti = safeNum(r['PuntiEventoCalcolati']);

  sql.push('INSERT INTO registrazioni (atleta_id, percorso_id, stagione_id, completato, km_effettivi, dislivello_eff, punti)');
  sql.push('SELECT a.id, p.id, ' + STAGIONE_ID + ', ' + completato + ', ' + kmEff + ', ' + dislivEff + ', ' + punti);
  sql.push('FROM atleti a, percorsi p JOIN eventi e ON p.evento_id = e.id');
  sql.push("WHERE LOWER(TRIM(a.nome_cognome)) = LOWER('" + nomeAtleta + "')");
  sql.push("  AND e.nome = '" + esc(ev.nome) + "' AND e.stagione_id = " + STAGIONE_ID + " AND p.km = " + ev.km);
  sql.push('ON CONFLICT DO NOTHING;');
  sql.push('');
}

fs.writeFileSync('C:/Users/Mauri/Desktop/import_bb2026.sql', sql.join('\n'));
console.log('SQL scritto: ' + sql.length + ' righe');
