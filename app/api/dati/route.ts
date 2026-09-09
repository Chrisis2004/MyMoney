import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadAppData, saveAppData } from "@/lib/supabase/repository";

// I dati cambiano a ogni modifica e dipendono da chi ha fatto l'accesso:
// niente cache, niente prerender.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = { "Cache-Control": "no-store" };

function failure(message: string, err: unknown, status = 500) {
  console.error(message, err);
  const detail = err instanceof Error ? err.message : String(err);
  return NextResponse.json({ error: message, detail }, { status, headers: noStore });
}

const unauthorized = () =>
  NextResponse.json(
    { error: "Sessione scaduta. Accedi di nuovo." },
    { status: 401, headers: noStore },
  );

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const data = await loadAppData(supabase, user.id);
    return NextResponse.json({ account: user.email ?? null, data }, { headers: noStore });
  } catch (err) {
    return failure("Non riesco a leggere i dati.", err);
  }
}

async function write(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch (err) {
    return failure("Corpo della richiesta non valido.", err, 400);
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const saved = await saveAppData(supabase, user.id, body as never);
    return NextResponse.json(
      { ok: true, savedAt: new Date().toISOString(), data: saved },
      { headers: noStore },
    );
  } catch (err) {
    return failure("Non riesco a salvare i dati.", err);
  }
}

export async function PUT(request: Request) {
  return write(request);
}

// sendBeacon, usato per non perdere l'ultima modifica quando si chiude la
// pagina, sa fare solo POST.
export async function POST(request: Request) {
  return write(request);
}
