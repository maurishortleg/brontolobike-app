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

console.log('=== DatiPartecipazioniInserite ===');
console.log('Righe:', partecipazioni.length);
console.log('Colonne:', Object.keys(partecipazioni[0] || {}));
console.log('Prime 5 righe:');
partecipazioni.slice(0, 5).forEach(r => console.log(JSON.stringify(r)));

console.log('\n=== CalcoloPuntiSingoliEventi ===');
console.log('Righe:', calcolo.length);
console.log('Colonne:', Object.keys(calcolo[0] || {}));
console.log('Prime 5 righe:');
calcolo.slice(0, 5).forEach(r => console.log(JSON.stringify(r)));

// Analisi DatiPartecipazioniInserite
console.log('\n=== ANALISI DatiPartecipazioniInserite ===');
const nomiAtleti = [...new Set(partecipazioni.map(r => r['Nome Atleta'] || r['NomeAtleta'] || r['Atleta'] || Object.values(r)[0]))];
console.log('Atleti unici:', nomiAtleti.length, nomiAtleti.slice(0, 10));

const nomiEventi = [...new Set(partecipazioni.map(r => r['Nome Evento'] || r['NomeEvento'] || r['Evento'] || Object.values(r)[1]))];
console.log('Eventi unici:', nomiEventi.length, nomiEventi.slice(0, 10));

// Analisi CalcoloPuntiSingoliEventi
console.log('\n=== ANALISI CalcoloPuntiSingoliEventi ===');
console.log('Tutte le colonne:', Object.keys(calcolo[0] || {}));
calcolo.slice(0, 10).forEach(r => console.log(JSON.stringify(r)));
