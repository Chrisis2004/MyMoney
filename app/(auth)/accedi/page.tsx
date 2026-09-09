import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Accedi - mymoney" };

export default function AccediPage() {
  // useSearchParams dentro AuthForm vuole un confine di Suspense.
  return (
    <Suspense fallback={null}>
      <AuthForm mode="accedi" />
    </Suspense>
  );
}
