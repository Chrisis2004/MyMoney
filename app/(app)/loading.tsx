import { PageSkeleton } from "@/components/ui";

/**
 * Mostrato mentre Next carica il codice della pagina verso cui si sta
 * navigando. Il guscio — intestazione, mese, menu — resta al suo posto: cambia
 * solo il contenuto, che e' proprio quello che si sta aspettando.
 */
export default function Loading() {
  return <PageSkeleton />;
}
