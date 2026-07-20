-- ============================================================
-- BrontoloBike – Fix RLS (Row Level Security)
-- Eseguire nel SQL Editor di Supabase (una volta sola).
-- È idempotente: DROP IF EXISTS prima di ogni CREATE.
-- ============================================================

-- -------------------------
-- REGISTRAZIONI: policy mancanti
-- -------------------------

-- DELETE: solo il proprietario della registrazione può eliminarla
-- (gli admin usano il service_role dal backend, che bypassa RLS)
DROP POLICY IF EXISTS "Delete registrazioni proprio" ON registrazioni;
CREATE POLICY "Delete registrazioni proprio"
  ON registrazioni
  FOR DELETE
  USING (registrato_da = auth.uid());

-- UPDATE: solo il proprietario può modificare la propria registrazione
-- (sostituisce la policy generica "Modifica registrazioni auth")
DROP POLICY IF EXISTS "Modifica registrazioni auth" ON registrazioni;
DROP POLICY IF EXISTS "Update registrazioni proprio" ON registrazioni;
CREATE POLICY "Update registrazioni proprio"
  ON registrazioni
  FOR UPDATE
  USING (registrato_da = auth.uid());

-- -------------------------
-- ATLETI: blocco scrittura diretta
-- Nessun client (anonimo o autenticato) può modificare atleti
-- direttamente via API Supabase. Le modifiche passano solo per
-- le API Next.js admin che usano il service_role key.
-- -------------------------
DROP POLICY IF EXISTS "No insert atleti client" ON atleti;
DROP POLICY IF EXISTS "No update atleti client" ON atleti;
DROP POLICY IF EXISTS "No delete atleti client" ON atleti;

-- Supabase non supporta policy di tipo DENY esplicito.
-- Invece: non creiamo policy permissive per INSERT/UPDATE/DELETE,
-- che significa che per default sono BLOCCATE (RLS nega tutto ciò
-- che non è esplicitamente permesso).
-- Verifica che non esistano policy di scrittura indesiderate:
DROP POLICY IF EXISTS "Insert atleti" ON atleti;
DROP POLICY IF EXISTS "Update atleti" ON atleti;
DROP POLICY IF EXISTS "Delete atleti" ON atleti;

-- -------------------------
-- EVENTI: blocco scrittura diretta dal client
-- -------------------------
DROP POLICY IF EXISTS "Insert eventi" ON eventi;
DROP POLICY IF EXISTS "Update eventi" ON eventi;
DROP POLICY IF EXISTS "Delete eventi" ON eventi;

-- INSERT eventi: solo utenti autenticati possono creare eventi
-- (necessario per il flusso di registrazione dal frontend)
DROP POLICY IF EXISTS "Insert eventi auth" ON eventi;
CREATE POLICY "Insert eventi auth"
  ON eventi
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- -------------------------
-- PERCORSI: scrittura consentita solo agli autenticati (per registrazione)
-- -------------------------
DROP POLICY IF EXISTS "Insert percorsi" ON percorsi;
DROP POLICY IF EXISTS "Update percorsi" ON percorsi;
DROP POLICY IF EXISTS "Delete percorsi" ON percorsi;

DROP POLICY IF EXISTS "Insert percorsi auth" ON percorsi;
CREATE POLICY "Insert percorsi auth"
  ON percorsi
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- -------------------------
-- EVENTI_RICERCATI: lettura pubblica + scrittura solo via service_role
-- (questa tabella è popolata dalla API cerca-evento, mai dal client diretto)
-- -------------------------
ALTER TABLE IF EXISTS eventi_ricercati ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lettura pubblica eventi_ricercati" ON eventi_ricercati;
CREATE POLICY "Lettura pubblica eventi_ricercati"
  ON eventi_ricercati
  FOR SELECT
  USING (true);

-- Nessuna policy di INSERT/UPDATE/DELETE per client:
-- vengono gestiti esclusivamente dal service_role nel backend.
DROP POLICY IF EXISTS "Insert eventi_ricercati" ON eventi_ricercati;
DROP POLICY IF EXISTS "Update eventi_ricercati" ON eventi_ricercati;
DROP POLICY IF EXISTS "Delete eventi_ricercati" ON eventi_ricercati;

-- ============================================================
-- RIEPILOGO delle policy attive dopo questo script:
--
-- atleti:           SELECT (pubblica)
-- stagioni:         SELECT (pubblica)
-- tipologie_evento: SELECT (pubblica)
-- eventi:           SELECT (pubblica), INSERT (autenticati)
-- percorsi:         SELECT (pubblica), INSERT (autenticati)
-- registrazioni:    SELECT (pubblica), INSERT (autenticati),
--                   UPDATE (solo proprietario), DELETE (solo proprietario)
-- eventi_ricercati: SELECT (pubblica)
--
-- Tutte le operazioni admin (UPDATE/DELETE su atleti, DELETE admin
-- su registrazioni altrui, ecc.) passano per il service_role key
-- nel backend Next.js, che bypassa RLS correttamente.
-- ============================================================
