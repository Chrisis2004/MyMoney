import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Registrazione - mymoney" };

export default function RegistrazionePage() {
  return (
    <Suspense fallback={null}>
      <AuthForm mode="registrazione" />
    </Suspense>
  );
}
