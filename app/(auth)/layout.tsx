/** Le pagine di accesso: nessuna navigazione, nessuno store, solo il modulo. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4 py-10">
      <p className="mb-5 text-center text-sm font-semibold tracking-tight text-ink">
        mymoney
      </p>
      {children}
    </div>
  );
}
