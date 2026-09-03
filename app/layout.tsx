import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { MonthProvider } from "@/lib/month";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Gestione risparmio",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-screen">
        <StoreProvider>
          <MonthProvider>
            <AppShell>{children}</AppShell>
          </MonthProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
