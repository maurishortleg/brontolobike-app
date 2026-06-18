import { readFileSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const wb = XLSX.readFile('C:/Users/Mauri/Downloads/Campionato Sociale BB 2027-Atleti.xlsx')
const ws = wb.Sheets['ElencoAtleti']
const atleti = XLSX.utils.sheet_to_json(ws)

const esc = (s) => String(s).replace(/'/g, "''")

const atletiValues = atleti.map((r, i) => {
  const id = `ATL_${String(1001 + i).padStart(4, '0')}`
  return `  ('${id}', '${esc(r.NomeCognomeAtleta)}', '${esc(r.GenereAtleta)}', '${esc(r.CategoriaAtleta)}', '${esc(r.CategoriaAtleta)}')`
}).join(',\n')

const sql = `-- ============================================================
-- BrontoloBike – Schema database
-- Eseguire nel SQL Editor di Supabase (una volta sola)
-- ============================================================

-- -------------------------
-- STAGIONI
-- -------------------------
CREATE TABLE IF NOT EXISTS stagioni (
  id        SERIAL PRIMARY KEY,
  anno      INTEGER NOT NULL UNIQUE,
  attiva    BOOLEAN NOT NULL DEFAULT false
);

INSERT INTO stagioni (anno, attiva) VALUES (2027, true);

-- -------------------------
-- ATLETI
-- -------------------------
CREATE TABLE IF NOT EXISTS atleti (
  id                  TEXT PRIMARY KEY,
  nome_cognome        TEXT NOT NULL,
  genere              TEXT NOT NULL CHECK (genere IN ('Uomo', 'Donna')),
  categoria_corrente  TEXT NOT NULL CHECK (categoria_corrente IN ('AMATORI', 'CICLOTURISTI')),
  categoria_prossima  TEXT NOT NULL CHECK (categoria_prossima IN ('AMATORI', 'CICLOTURISTI')),
  user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO atleti (id, nome_cognome, genere, categoria_corrente, categoria_prossima) VALUES
${atletiValues}
ON CONFLICT (id) DO NOTHING;

-- -------------------------
-- TIPOLOGIE EVENTO
-- -------------------------
CREATE TABLE IF NOT EXISTS tipologie_evento (
  id                    SERIAL PRIMARY KEY,
  nome                  TEXT NOT NULL UNIQUE,
  coefficiente_km       NUMERIC(4,1) NOT NULL DEFAULT 1,
  punti_fissi           INTEGER,
  ignora_km_dislivello  BOOLEAN NOT NULL DEFAULT false
);

INSERT INTO tipologie_evento (nome, coefficiente_km, punti_fissi, ignora_km_dislivello) VALUES
  ('Gran/Medio Fondo',             2,  NULL,  false),
  ('Randonnée fino a 120Km',       2,  NULL,  false),
  ('Randonnée oltre i 120Km',      1,  NULL,  false),
  ('Pedalata Cicloturistica',      2,  NULL,  false),
  ('Brevetto Permanente Strada',   1,  NULL,  false),
  ('Brevetto Permanente Gravel',   3,  NULL,  false),
  ('Percorso con Credenziale',     1,  NULL,  false),
  ('Ciclocross',                   4,  NULL,  false),
  ('MTB',                          4,  NULL,  false),
  ('Gravel',                       3,  NULL,  false),
  ('Gara in Circuito (CRIT)',      4,  NULL,  false),
  ('Gravel di GRAvelAND',          5,  NULL,  false),
  ('Trail',                        1,  NULL,  false),
  ('Brontolo Bike Day',           15,  NULL,  false),
  ('Uva Fragola',                 15,  NULL,  false),
  ('Bike Camp Livigno',            1,  1000,  true)
ON CONFLICT (nome) DO NOTHING;

-- -------------------------
-- EVENTI
-- -------------------------
CREATE TABLE IF NOT EXISTS eventi (
  id            SERIAL PRIMARY KEY,
  nome          TEXT NOT NULL,
  data_evento   DATE,
  stagione_id   INTEGER NOT NULL REFERENCES stagioni(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------
-- PERCORSI (corto/medio/lungo di un evento)
-- -------------------------
CREATE TABLE IF NOT EXISTS percorsi (
  id              SERIAL PRIMARY KEY,
  evento_id       INTEGER NOT NULL REFERENCES eventi(id) ON DELETE CASCADE,
  nome_percorso   TEXT NOT NULL DEFAULT 'Unico',
  km              NUMERIC(6,1) NOT NULL,
  dislivello_m    INTEGER NOT NULL DEFAULT 0
);

-- -------------------------
-- REGISTRAZIONI
-- -------------------------
CREATE TABLE IF NOT EXISTS registrazioni (
  id              SERIAL PRIMARY KEY,
  atleta_id       TEXT NOT NULL REFERENCES atleti(id),
  percorso_id     INTEGER NOT NULL REFERENCES percorsi(id),
  stagione_id     INTEGER NOT NULL REFERENCES stagioni(id),
  completato      BOOLEAN NOT NULL DEFAULT true,
  km_effettivi    NUMERIC(6,1),
  dislivello_eff  INTEGER,
  punti           INTEGER NOT NULL DEFAULT 0,
  note            TEXT,
  registrato_da   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (atleta_id, percorso_id, stagione_id)
);

-- -------------------------
-- ROW LEVEL SECURITY (base)
-- -------------------------
ALTER TABLE atleti           ENABLE ROW LEVEL SECURITY;
ALTER TABLE stagioni         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipologie_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventi           ENABLE ROW LEVEL SECURITY;
ALTER TABLE percorsi         ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrazioni    ENABLE ROW LEVEL SECURITY;

-- Lettura pubblica per tutti (anche non autenticati)
CREATE POLICY "Lettura pubblica atleti"           ON atleti           FOR SELECT USING (true);
CREATE POLICY "Lettura pubblica stagioni"         ON stagioni         FOR SELECT USING (true);
CREATE POLICY "Lettura pubblica tipologie"        ON tipologie_evento FOR SELECT USING (true);
CREATE POLICY "Lettura pubblica eventi"           ON eventi           FOR SELECT USING (true);
CREATE POLICY "Lettura pubblica percorsi"         ON percorsi         FOR SELECT USING (true);
CREATE POLICY "Lettura pubblica registrazioni"    ON registrazioni    FOR SELECT USING (true);

-- Scrittura registrazioni: solo utenti autenticati
CREATE POLICY "Inserimento registrazioni auth"    ON registrazioni    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Modifica registrazioni auth"       ON registrazioni    FOR UPDATE USING (auth.role() = 'authenticated');
`

writeFileSync('supabase/schema.sql', sql)
console.log('Schema SQL generato in supabase/schema.sql')
console.log('Atleti inclusi:', atleti.length)
