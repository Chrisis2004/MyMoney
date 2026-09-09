import { NextResponse } from "next/server";
import { dataFilePath, loadData, saveData } from "@/lib/dataFile";

// Il file cambia a ogni modifica: niente cache, niente prerender.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = { "Cache-Control": "no-store" };

function failure(message: string, err: unknown, status = 500) {
  console.error(message, err);
  const detail = err instanceof Error ? err.message : String(err);
  return NextResponse.json(
    { error: message, detail, path: dataFilePath },
    { status, headers: noStore },
  );
}

export async function GET() {
  try {
    const { data, created } = await loadData();
    return NextResponse.json({ path: dataFilePath, created, data }, { headers: noStore });
  } catch (err) {
    return failure("Non riesco a leggere il file dei dati.", err);
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
    const saved = await saveData(body as never);
    return NextResponse.json(
      { ok: true, path: dataFilePath, savedAt: new Date().toISOString(), data: saved },
      { headers: noStore },
    );
  } catch (err) {
    return failure("Non riesco a scrivere il file dei dati.", err);
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
