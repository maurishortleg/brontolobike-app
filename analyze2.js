const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/Mauri/Downloads/Import di Campionato Sociale BB 2026.xlsx');

function sheetToJson(name) {
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
}

function excelDateToISO(serial) {
  if (typeof serial !== 'number' || serial === 0) return null;
  const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return date.toISOString().split('T')[0];
}

const partecipazioni = sheetToJson('DatiPartecipazioniInserite');
const calcolo = sheetToJson('CalcoloPuntiSingoliEventi');

// ---- Analisi eventi nel foglio calcolo ----
const eventiUnici = {};
for (const r of calcolo) {
  const id = r['ID_Evento_Sheet'];
  if (!eventiUnici[id]) {
    eventiUnici[id] = {
      id,
      nome: r['NomeEvento_Effettivo'],
      data: excelDateToISO(r['DataEffettivaPartecipazione']),
      tipologia: r['TipologiaEventoEffettiva'],
      km: r['KmUfficialiEffettivi'],
      dislivello: r['DislivelloUfficialeEffettivo'],
    };
  }
}
console.log('=== EVENTI UNICI (' + Object.keys(eventiUnici).length + ') ===');
Object.values(eventiUnici).forEach(e => console.log(JSON.stringify(e)));

// ---- Analisi atleti nel foglio calcolo ----
const atletiUnici = [...new Set(calcolo.map(r => r['ID_Atleta']))];
console.log('\n=== ATLETI UNICI nel calcolo:', atletiUnici.length);

// ---- Incoerenze: atleti nel calcolo NON nel partecipazioni ----
const atletiPartecipazioni = [...new Set(partecipazioni.map(r => r['ID_Atleta_Selezionato']))];
const soloInCalcolo = atletiUnici.filter(a => !atletiPartecipazioni.includes(a));
console.log('\nAtleti SOLO in CalcoloPunti (non in Partecipazioni):', soloInCalcolo);

// ---- Righe nel calcolo ma non in partecipazioni ----
const idsPartecipazioni = new Set(partecipazioni.map((_, i) => i + 1));
console.log('\nRighe calcolo:', calcolo.length, '| Righe partecipazioni:', partecipazioni.length);
console.log('Differenza righe:', calcolo.length - partecipazioni.length);

// ---- ID partecipazione massimo ----
const maxId = Math.max(...calcolo.map(r => r['ID_Partecipazione']));
console.log('ID_Partecipazione max:', maxId, '(ci sono', calcolo.length, 'righe -> gap:', maxId - calcolo.length, ')');

// ---- Punteggi: statistiche ----
const punti = calcolo.map(r => r['PuntiEventoCalcolati']).filter(p => typeof p === 'number');
console.log('\nPunti: min=' + Math.min(...punti) + ' max=' + Math.max(...punti));
const zeroPunti = calcolo.filter(r => r['PuntiEventoCalcolati'] === 0 || r['PuntiEventoCalcolati'] === '');
console.log('Righe con 0 punti o vuoti:', zeroPunti.length);
zeroPunti.forEach(r => console.log(' -', r['ID_Atleta'], r['NomeCognomeAtleta'], r['NomeEvento_Effettivo'], r['PuntiEventoCalcolati']));

// ---- Duplicati: stesso atleta stesso evento ----
const chiavi = calcolo.map(r => r['ID_Atleta'] + '|' + r['ID_Evento_Sheet']);
const duplicati = chiavi.filter((c, i) => chiavi.indexOf(c) !== i);
console.log('\nDuplicati (stesso atleta + stesso evento):', duplicati.length);
duplicati.forEach(d => {
  const rows = calcolo.filter(r => r['ID_Atleta'] + '|' + r['ID_Evento_Sheet'] === d);
  rows.forEach(r => console.log(' -', r['ID_Atleta'], r['NomeCognomeAtleta'], r['NomeEvento_Effettivo'], 'pt:', r['PuntiEventoCalcolati']));
});

// ---- Tipologie presenti ----
const tipologie = [...new Set(calcolo.map(r => r['TipologiaEventoEffettiva']))];
console.log('\nTipologie eventi:', tipologie);

// ---- Mesi coperti ----
const mesi = [...new Set(calcolo.map(r => r['NomeMeseEvento']))];
console.log('Mesi coperti:', mesi);
