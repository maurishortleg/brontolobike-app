import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Leggi il record corrente
const { data: row } = await sb.from("eventi_ricercati").select("*").eq("id", 32).single();
console.log("Row corrente:", JSON.stringify(row));

// Delete e re-insert con tipologia aggiornata
const { error: de } = await sb.from("eventi_ricercati").delete().eq("id", 32);
if (de) { console.error("Delete error:", de.message); process.exit(1); }

const newRow = { ...row, tipologia: "Gran/Medio Fondo" };
const { error: ie } = await sb.from("eventi_ricercati").insert(newRow);
if (ie) { console.error("Insert error:", ie.message); } else { console.log("OK: tipologia aggiornata a Gran/Medio Fondo"); }
