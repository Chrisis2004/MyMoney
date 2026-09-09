import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Client per Route Handler e Server Component. La sessione viaggia nei cookie:
 * `setAll` li riscrive quando il token viene rinnovato.
 */
export async function createClient() {
  const store = await cookies();

  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Nei Server Component i cookie sono di sola lettura: il rinnovo lo
          // porta a termine il middleware, che gira prima e puo' scrivere.
        }
      },
    },
  });
}

/**
 * L'utente della richiesta, verificato contro Supabase (non ci si fida del solo
 * cookie). `null` quando non c'e' sessione valida.
 */
export async function currentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}
