/**
 * Importazione una tantum del file locale su Supabase.
 *
 *   bun run importa -- --email tua@email.it --password laTuaPassword
 *
 * In alternativa si possono usare le variabili RISPARMIO_EMAIL e
 * RISPARMIO_PASSWORD, cosi' la password non finisce nella cronologia della
 * shell. Con --file si indica un JSON diverso da quello predefinito, per
 * esempio una delle istantanee in data/backups.
 *
 * Lo script entra come utente normale: scrive attraverso le stesse policy RLS
 * dell'app, non serve la service key. Rilanciarlo non fa danni, riallinea e
 * basta: saveAppData confronta con quello che c'e' gia' e tocca solo le
 * differenze.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { normalizeAppData } from "../lib/normalize";
import { saveAppData } from "../lib/supabase/repository";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function richiesto(valore: string | undefined, cosa: string): string {
  if (!valore) {
    console.error(`Manca ${cosa}.`);
    process.exit(1);
  }
  return valore;
}

const url = richiesto(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
const anonKey = richiesto(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
);
const email = richiesto(arg("email") ?? process.env.RISPARMIO_EMAIL, "l'email (--email)");
const password = richiesto(
  arg("password") ?? process.env.RISPARMIO_PASSWORD,
  "la password (--password)",
);

const file = path.resolve(
  arg("file") ?? path.join(process.cwd(), "data", "gestione-risparmio.json"),
);

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log(`Leggo ${file}`);
const data = normalizeAppData(JSON.parse(await readFile(file, "utf8")));
console.log(
  `Trovati: ${data.categories.length} categorie, ${data.transactions.length} transazioni, ` +
    `${data.budgets.length} righe di budget, ${data.fixedExpenses.length} spese fisse, ` +
    `${data.incomes.length} entrate mensili, ${data.extraIncomes.length} entrate extra.`,
);

const { data: sessione, error: erroreAccesso } = await supabase.auth.signInWithPassword({
  email,
  password,
});
if (erroreAccesso || !sessione.user) {
  console.error(`Accesso non riuscito: ${erroreAccesso?.message ?? "utente assente"}`);
  process.exit(1);
}
console.log(`Entrato come ${sessione.user.email}`);

try {
  await saveAppData(supabase, sessione.user.id, data);
  console.log("Fatto: i dati sono su Supabase.");
} catch (err) {
  console.error("Importazione non riuscita.", err);
  process.exit(1);
}
