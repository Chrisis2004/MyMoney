import { Logo } from "@/components/ui";

/** Le pagine di accesso: nessuna navigazione, nessuno store, solo il modulo. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4 py-10">
      {/* Qui il marchio e' l'unica cosa che dice dove si e' finiti, quindi sta
          piu' in grande che nell'intestazione dell'app. */}
      <div className="mb-6 flex justify-center">
        <Logo className="h-6" priority />
      </div>
      {children}
    </div>
  );
}
