import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Usa rpc per creare una funzione helper temporanea non e possibile senza SQL diretto
// Prova via fetch diretto alla Supabase REST API SQL endpoint
const url = process.env.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1/rpc/exec_ddl";
const sql = "ALTER TABLE eventi_ricercati ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(); DROP TRIGGER IF EXISTS update_eventi_ricercati_updated_at ON eventi_ricercati; CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF TG_OP = ''UPDATE'' THEN BEGIN NEW.updated_at = NOW(); EXCEPTION WHEN undefined_column THEN END; END IF; RETURN NEW; END; $$;";

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY, "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY },
  body: JSON.stringify({ query: sql })
});
const text = await res.text();
console.log("Response:", res.status, text.slice(0, 200));
