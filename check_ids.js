const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/Mauri/Downloads/Import di Campionato Sociale BB 2026.xlsx');

function sheetToJson(name) {
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
}

const calcolo = sheetToJson('CalcoloPuntiSingoliEventi').filter(r => r['ID_Atleta'] !== '');

// Lista atleti unici con nome
const atleti = {};
for (const r of calcolo) {
  if (r['ID_Atleta']) atleti[r['ID_Atleta']] = r['NomeCognomeAtleta'];
}

console.log('Atleti unici nell\'Excel (' + Object.keys(atleti).length + '):');
Object.entries(atleti).sort((a,b) => a[1].localeCompare(b[1])).forEach(([id, nome]) => {
  console.log(id + ' | ' + nome);
});
