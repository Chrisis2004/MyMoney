import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * Il carattere del logo, esteso a tutta l'app. E' la variabile font di Google:
 * senza `weight` arriva l'intero asse dei pesi, cosi' il 500 del corpo del
 * testo e i 600/700 dei titoli e dei numeri escono tutti dallo stesso file,
 * senza scaricarne uno per peso. Next lo ospita in proprio: nessuna chiamata
 * a Google dal browser di chi usa l'app.
 */
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "mymoney",
  description: "Budget mensile, transazioni, spese fisse e andamento del risparmio.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

/**
 * Applica il tema salvato prima del primo paint, cosi' la pagina non lampeggia
 * in chiaro per poi passare a scuro.
 */
const themeBootstrap = `
try {
  var t = localStorage.getItem("gestione-risparmio:theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) {}
`;

/**
 * Il guscio minimo. Lo store e la navigazione stanno nel gruppo (app), cosi'
 * le pagine di accesso non montano il provider che carica i dati: senza
 * sessione andrebbe in 401 e rimbalzerebbe di nuovo qui.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={jetBrainsMono.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
