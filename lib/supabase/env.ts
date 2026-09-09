/**
 * Le due variabili che servono ovunque. Sono raccolte qui perche' un errore di
 * configurazione deve saltare fuori con un messaggio comprensibile invece che
 * come un "fetch failed" a meta' di una query.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Manca la variabile ${name}. Copia .env.local.example in .env.local e ` +
        "riempila con URL e chiave del progetto Supabase.",
    );
  }
  return value;
}

export const supabaseUrl = () =>
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

export const supabaseAnonKey = () =>
  required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
