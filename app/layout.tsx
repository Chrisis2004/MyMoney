import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
