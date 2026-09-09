import { redirect } from "next/navigation";
import { StoreProvider } from "@/lib/store";
import { MonthProvider } from "@/lib/month";
import { SessionProvider } from "@/lib/session";
import { accountFrom } from "@/lib/account";
import { AppShell } from "@/components/AppShell";
import { currentUser } from "@/lib/supabase/server";
import { SpeedInsights } from "@vercel/speed-insights/next"

/**
 * Tutte le pagine dell'app vivono qui dentro, e qui dentro si entra solo con
 * una sessione. Il middleware fa gia' da filtro; questo controllo lo raddoppia
 * sul server, perche' e' il layout a decidere cosa viene renderizzato.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/accedi");

  return (
    <SessionProvider account={accountFrom(user)}>
      <StoreProvider>
        <MonthProvider>
          <AppShell>{children}</AppShell>
        </MonthProvider>
      </StoreProvider>
      <SpeedInsights />
    </SessionProvider>
  );
}
