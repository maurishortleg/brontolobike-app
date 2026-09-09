# BrontoloBike – Documento dei Requisiti: App Campionato Sociale

## 1. Obiettivo del progetto

Web app per la gestione del campionato sociale ciclistico del team BrontoloBike. Permette agli atleti di registrare gli eventi a cui hanno partecipato, calcola automaticamente il punteggio, mostra classifiche, statistiche e confronti tra atleti.

## 2. Categorie atleti

- **Amatori**: soglia Finisher a 9000 punti
- **Cicloturisti**: soglia Finisher a 4000 punti
- La formula di calcolo punteggio è identica per entrambe le categorie
- La categoria è **fissa per tutta la durata della stagione**: un eventuale cambio (es. da Cicloturista ad Amatore) si applica solo alla stagione successiva, non a quella in corso
- L'amministratore (o l'atleta stesso, da scheda personale) può impostare/modificare la categoria in vista della stagione successiva

## 3. Modello dati – Atleti

Dati importati dal roster esistente (377 atleti: 323 Amatori, 54 Cicloturisti):

| Campo | Esempio | Note |
|---|---|---|
| ID_Atleta | ATL_1001 | Identificativo univoco |
| NomeCognomeAtleta | Abate Orazio | |
| GenereAtleta | Uomo / Donna | |
| CategoriaAtleta | AMATORI / CICLOTURISTI | Fissa per la stagione, modificabile solo per quella successiva |

Il file Excel fornito va usato come dato di importazione iniziale nel database dell'app.

## 4. Autenticazione

Tre modalità di accesso, tutte attive contemporaneamente:

1. Login con Google (OAuth)
2. Login con Facebook (OAuth)
3. Accesso senza credenziali: l'atleta seleziona il proprio nome dalla lista precaricata (roster) e registra gli eventi a nome proprio, senza creare un account

**Decisione**: nessuna protezione aggiuntiva (PIN o simili). Il club opera in un contesto di fiducia interna, quindi questo rischio è accettato consapevolmente.

## 5. Tipologie di evento e formula di calcolo punteggio

### Formula generale

```
Punti = ARROTONDA PER ECCESSO ( (Km_percorsi × CoefficienteKm) + (Dislivello_metri × 0,10) )
```

**Eccezione**: se la tipologia ha `IgnoraKmDislivello = Sì`, si assegnano direttamente i `PuntiFissi` previsti, ignorando completamente km e dislivello.

Regole confermate:
- L'arrotondamento è sempre **per eccesso** (verso l'intero superiore)
- La formula è **identica** per Amatori e Cicloturisti
- Il campo PuntiFissi deve restare **configurabile per ogni tipologia** (oggi usato solo per il Bike Camp Livigno, ma utilizzabile in futuro anche per altri eventi)

### Tabella tipologie evento (regolamento attuale del club)

| Tipologia Evento | Coefficiente Km | Punti Fissi | Ignora Km/Dislivello |
|---|---|---|---|
| Gran/Medio Fondo | 2 | – | No |
| Randonnée fino a 120Km | 2 | – | No |
| Randonnée oltre i 120Km | 1 | – | No |
| Pedalata Cicloturistica | 2 | – | No |
| Brevetto Permanente Strada | 1 | – | No |
| Brevetto Permanente Gravel | 3 | – | No |
| Percorso con Credenziale | 1 | – | No |
| Ciclocross | 4 | – | No |
| MTB | 4 | – | No |
| Gravel | 3 | – | No |
| Gara in Circuito (CRIT) | 4 | – | No |
| Gravel di GRAvelAND | 5 | – | No |
| Trail | 1 | – | No |
| Brontolo Bike Day | 15 | – | No |
| Uva Fragola | 15 | – | No |
| Bike Camp Livigno | 1 | 1000 | Sì |

### Esempio di calcolo

Gran/Medio Fondo, 80 km, 1500 m di dislivello:
`(80 × 2) + (1500 × 0,10) = 160 + 150 = 310 punti`

## 6. Eventi parziali (non conclusi)

Alla registrazione di un evento, il sistema chiede sempre: *"Hai completato l'evento?"*

- **Sì** → si usano km e dislivello ufficiali del percorso (da ricerca AI o inserimento manuale)
- **No** → si apre un campo di inserimento manuale dove l'atleta indica i km effettivamente percorsi e il dislivello scalato (proporzionale al tratto realmente completato)

La formula di calcolo (coefficiente km + 10% dislivello) si applica sempre ai valori effettivi inseriti, non a quelli del percorso completo.

Gli eventi parziali **non richiedono alcuna approvazione amministrativa**: contano subito nel punteggio non appena registrati. L'amministratore può comunque correggerli o annullarli in un secondo momento se necessario (vedi sezione 13, Ruolo amministratore).

## 7. Ricerca e inserimento eventi

- Ricerca AI automatica sul web per trovare eventi ciclistici rilevanti, proposti come opzioni selezionabili (accettato un possibile piccolo costo ricorrente oltre la soglia gratuita dell'API di ricerca)
- Se la ricerca AI non produce il risultato che l'atleta sta cercando, l'atleta può inserire l'evento manualmente specificando: nome evento, tipologia evento (selezionata dall'elenco di cui alla sezione 5), km del percorso, dislivello del percorso

**Confermato, gestito fin dal lancio**: un evento può avere più percorsi alternativi (es. corto/medio/lungo), ciascuno con propri km e dislivello. Al momento della registrazione, l'atleta seleziona quale percorso specifico ha effettivamente svolto; il calcolo del punteggio si applica solo ai dati di quel percorso.

## 8. Calendario

- Vista calendario mensile
- Cliccando su una data si apre la lista degli eventi registrati in quel giorno, con dettagli su lunghezza e dislivello di ciascun percorso

## 9. Statistiche e classifiche

Sulla base dei fogli già in uso dal club, l'app deve riprodurre almeno:

- **Classifica generale**: atleta, categoria, punti totali (equivalente al foglio ClassificaGenerale)
- **Aggregazione punti mensile** per atleta (equivalente al foglio AggregazionePuntiMensiliAtleta)
- **Confronto diretto** tra due o più atleti selezionati
- **Lista personale** degli eventi registrati da ciascun atleta

## 10. Scheda atleta

Ogni atleta ha una scheda di dettaglio con: nome, categoria attuale (modificabile rapidamente), punti totali, stato Finisher (raggiunto o no, con soglia di riferimento), storico eventi registrati.

## 11. Hosting e stack tecnico

- App web reale, non un semplice prototipo
- Hosting esterno gratuito (es. Vercel o Netlify) con dominio proprio
- Sviluppo tramite **Claude Code** (non tramite chat artifact), per gestire backend, database persistente, autenticazione OAuth reale e deploy
- Necessario un database gratuito compatibile (es. piano free di Supabase o Firebase) per la persistenza reale di atleti, eventi e punteggi

## 12. Vincoli di costo

Tutti i servizi devono restare gratuiti, con la sola eccezione accettata della ricerca AI eventi, per cui è tollerato un piccolo costo ricorrente oltre la soglia gratuita.

## 13. Ruolo amministratore

Un ruolo amministratore unico (il gestore del campionato) ha accesso a funzionalità aggiuntive rispetto agli atleti normali:

- Modifica di qualsiasi dato: eventi registrati, punteggi assegnati, categoria di un atleta, anagrafica del roster
- Possibilità di correggere o annullare un punteggio già conteggiato, anche a posteriori
- Nessuna approvazione preventiva richiesta sugli eventi manuali o parziali inseriti dagli atleti: l'admin interviene solo se necessario correggere errori o casi anomali, non come passaggio obbligato

## 14. Stato del documento

Tutti i punti precedentemente aperti sono stati chiariti e confermati:

- Percorsi multipli per evento (corto/medio/lungo): gestiti fin dal lancio
- Cambio categoria: la categoria resta fissa per l'intera stagione, il cambio vale solo dalla stagione successiva
- Modalità senza login: nessuna protezione aggiuntiva, contesto di fiducia interna
- Ruolo amministratore: presente, senza obbligo di approvazione sui parziali

Il documento è considerato completo dal punto di vista dei requisiti funzionali e di business. I prossimi passi naturali sono la definizione dello schema dati tecnico (tabelle/relazioni) e l'impostazione del progetto in Claude Code.
