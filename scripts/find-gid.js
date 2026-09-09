const https = require('https');
const fs = require('fs');

const url = 'https://docs.google.com/spreadsheets/d/1Uzozo81no1LgDEEPLc5vnOXkScc8dWUpB0JZlZ1kZrg/edit';
https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    fs.writeFileSync('page_source.txt', data, 'utf8');
    console.log('HTML salvato, lunghezza:', data.length);
    
    // Cerca tutti i numeri a 9+ cifre (GID) vicini a nomi di fogli
    const names = ['CalcoloPuntiSingoliEventi', 'TipologieEventi', 'Atleti'];
    names.forEach(name => {
      const idx = data.indexOf(name);
      if (idx > -1) {
        // Cerca numeri lunghi entro 500 caratteri prima e dopo
        const ctx = data.substring(Math.max(0, idx - 300), idx + 300);
        const nums = ctx.match(/\d{7,12}/g) || [];
        console.log(`\nFoglio "${name}" - numeri vicini:`, [...new Set(nums)].join(', '));
      }
    });
    
    // Cerca pattern doc-tab o sheet-tab con ID
    const tabPattern = data.match(/docs-sheet-tab[^>]*id="[^"]*"[^>]*>/g) || [];
    console.log('\nTab con ID:', tabPattern.slice(0, 10));
    
    // Cerca tutti i "sheetId" nel JSON
    const sheetIds = data.match(/"sheetId":(\d+)/g) || [];
    console.log('\nsheetId trovati:', [...new Set(sheetIds)].join(', '));
  });
}).on('error', e => console.error(e.message));
