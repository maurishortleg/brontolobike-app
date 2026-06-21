-- Tabella siti fonte per la scoperta automatica degli eventi
CREATE TABLE IF NOT EXISTS fonti_eventi (
  id        SERIAL PRIMARY KEY,
  nome      TEXT NOT NULL,
  dominio   TEXT NOT NULL,
  url       TEXT NOT NULL,
  queries   TEXT[] NOT NULL DEFAULT '{}',
  attiva    BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fonti_eventi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lettura pubblica fonti"   ON fonti_eventi FOR SELECT USING (true);
CREATE POLICY "Admin gestione fonti"     ON fonti_eventi FOR ALL
  USING (auth.jwt() ->> 'email' = 'gambacorta.m@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'gambacorta.m@gmail.com');

-- Inserisci i 5 siti già configurati nel codice
INSERT INTO fonti_eventi (nome, dominio, url, queries) VALUES
(
  'Audax Italia',
  'audaxitalia.it',
  'https://www.audaxitalia.it/',
  ARRAY[
    'site:audaxitalia.it brevetto permanente 2026 italia km dislivello iscrizioni',
    'site:audaxitalia.it randonnee 2026 italia percorso km',
    'site:audaxitalia.it calendario 2026 italia'
  ]
),
(
  'GravelLand',
  'gravelland.it',
  'https://www.gravelland.it/',
  ARRAY[
    'site:gravelland.it 2026 percorsi km dislivello iscrizioni italia',
    'site:gravelland.it uva fragola greenland 2026 km dislivello',
    'site:gravelland.it eventi 2026 italia'
  ]
),
(
  'Endu',
  'endu.net',
  'https://www.endu.net/',
  ARRAY[
    'site:endu.net ciclismo gravel granfondo 2026 italia km dislivello percorsi',
    'site:endu.net cycling event 2026 italy km elevation',
    'site:endu.net calendario ciclismo 2026 italia'
  ]
),
(
  'Battistrada',
  'battistrada.com',
  'https://battistrada.com/en/cycling-calendar/',
  ARRAY[
    'site:battistrada.com cycling event 2026 italy km elevation route',
    'site:battistrada.com granfondo gravel 2026 italia percorso km',
    'site:battistrada.com cycling calendar 2026 italy'
  ]
),
(
  'Granfondo',
  'granfondo.it',
  'https://www.granfondo.it/',
  ARRAY[
    'site:granfondo.it granfondo 2026 italia km dislivello percorso iscrizioni',
    'site:granfondo.it gara ciclistica 2026 italia km',
    'site:granfondo.it calendario 2026 italia'
  ]
);
