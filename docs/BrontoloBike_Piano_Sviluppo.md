# BrontoloBike – Piano di Sviluppo a Blocchi

## Come funziona questo piano

Ogni blocco è pensato per stare entro circa 2 ore di lavoro e termina con un risultato concreto e verificabile (qualcosa che funziona, non solo codice scritto a metà). Puoi affrontare un blocco per sessione, anche a distanza di giorni: a inizio di ogni sessione, fai leggere a Claude Code sia il documento dei requisiti sia questo piano, così riparte sempre dallo stato reale del progetto, senza bisogno di rispiegare nulla a voce.

## Servizi web utilizzati

| Servizio | Funzione | Costo |
|---|---|---|
| GitHub | Versionamento del codice | Gratuito |
| Vercel | Hosting e deploy automatico | Gratuito (piano Hobby) |
| Supabase | Database (Postgres) + Autenticazione Google/Facebook | Gratuito (piano Free) |
| Tavily o Brave Search API | Ricerca AI degli eventi sul web | Soglia mensile gratuita, poi a consumo |

**Nota sul dominio**: un dominio personalizzato (es. brontolobike.it) ha un costo reale di acquisto annuale (circa 10-15€), non rientra nei servizi gratuiti. In alternativa, Vercel fornisce gratuitamente un sottodominio del tipo `brontolobike.vercel.app`, perfettamente funzionante. Consiglio di partire con il sottodominio gratuito e valutare il dominio proprio solo più avanti, se il club vuole investire quella piccola cifra.

Supabase è stato scelto perché gestisce in un unico servizio gratuito sia il database che il login con Google e Facebook, evitando di dover configurare l'autenticazione OAuth manualmente da zero.

## Blocchi di lavoro

- [x] **Blocco 0 – Avvio progetto** (~1-1,5h)
  Creazione del progetto (Next.js), repository GitHub collegato, deploy automatico su Vercel, creazione del progetto Supabase. Risultato: una pagina vuota online, raggiungibile da un URL pubblico.

- [x] **Blocco 1 – Schema dati e importazione atleti** (~2h)
  Progettazione delle tabelle (Atleti, Eventi, Percorsi, Registrazioni, Tipologie evento, Stagioni) su Supabase. Importazione dei 377 atleti dal file Excel fornito. Risultato: i dati del roster sono nel database e consultabili.

- [ ] **Blocco 2 – Autenticazione** (~2h)
  Configurazione login Google e Facebook tramite Supabase Auth, più la modalità senza credenziali (selezione nome dalla lista atleti). Risultato: un utente può accedere con tutte e tre le modalità.

- [ ] **Blocco 3 – Registrazione evento e calcolo punteggio** (~2h)
  Form di inserimento manuale evento (nome, tipologia, km, dislivello, percorsi multipli, stato completato/parziale) e implementazione della formula di punteggio con arrotondamento per eccesso ed eccezione PuntiFissi. Risultato: un atleta può registrare un evento e vedere il punteggio calcolato correttamente.

- [ ] **Blocco 4 – Ricerca AI eventi** (~2h)
  Integrazione dell'API di ricerca scelta (Tavily o Brave), interfaccia per proporre eventi trovati come opzioni selezionabili, con fallback all'inserimento manuale del Blocco 3 se non trova nulla. Risultato: la ricerca AI propone eventi reali selezionabili dall'atleta.

- [ ] **Blocco 5 – Calendario** (~1,5-2h)
  Vista calendario mensile, con apertura della lista eventi del giorno al click su una data. Risultato: calendario navigabile con dettagli percorso/dislivello per ogni evento registrato.

- [ ] **Blocco 6 – Statistiche e classifiche** (~2h)
  Classifica generale, aggregazione punti mensile, confronto tra atleti, lista personale eventi. Risultato: tutte le viste statistiche previste sono consultabili e corrette.

- [ ] **Blocco 7 – Scheda atleta** (~1,5h)
  Pagina di dettaglio atleta con categoria, punti totali, stato Finisher, storico eventi, e gestione del cambio categoria per la stagione successiva. Risultato: scheda atleta completa e funzionante.

- [ ] **Blocco 8 – Pannello amministratore** (~2h)
  Accesso riservato all'admin per modificare eventi, punteggi, categorie e anagrafica atleti. Risultato: l'admin può correggere qualsiasi dato dal pannello dedicato.

- [ ] **Blocco 9 – Rifinitura e deploy finale** (~1,5-2h)
  Controllo responsive (mobile/desktop), test end-to-end di tutti i flussi, eventuale configurazione del dominio personalizzato, pulizia finale. Risultato: app pronta per essere usata dal club.

Il totale stimato è di circa 18-20 ore di lavoro effettivo, suddivise su 9-10 sessioni da 2 ore. Se un blocco richiede più tempo del previsto è normale: meglio chiuderlo bene su due sessioni che lasciarlo a metà.

## Come iniziare con Claude Code

Claude Code non è "un'altra chat" nello stesso senso di questa: è un programma a parte (un'app da terminale, o un'estensione per VS Code) che lavora direttamente sui file del progetto sul tuo computer, non dentro il browser.

Passaggi pratici:

1. Installa Claude Code (l'app da terminale o l'estensione VS Code, a tua scelta)
2. Crea sul tuo computer una cartella per il progetto, ad esempio `brontolobike-app`
3. All'interno crea una sottocartella `docs/` e salva lì sia `BrontoloBike_Requisiti.md` sia questo file `BrontoloBike_Piano_Sviluppo.md`
4. Apri un terminale dentro la cartella `brontolobike-app` e avvia Claude Code
5. Come primo messaggio, chiedi a Claude Code di leggere entrambi i file in `docs/` e di iniziare con il Blocco 0

Da quel momento, ogni nuova sessione di lavoro (anche se passano giorni) si apre semplicemente entrando di nuovo nella stessa cartella e chiedendo di continuare dal blocco successivo: i file restano lì, quindi nulla va ripetuto a voce.

## Tracciamento avanzamento

Aggiorna le caselle dei blocchi sopra (da `[ ]` a `[x]`) man mano che li completi, così questo file diventa anche il registro di avanzamento del progetto, consultabile in qualsiasi momento futuro.
