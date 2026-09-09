import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Client per il browser. Legge la sessione dai cookie scritti dal server, cosi'
 * le pagine renderizzate sul server e quelle nel browser vedono lo stesso
 * utente. La chiave anonima puo' stare nel bundle: da sola non apre niente,
 * sono le policy RLS a decidere cosa e' leggibile.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
