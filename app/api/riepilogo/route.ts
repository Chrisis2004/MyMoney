import { NextResponse } from "next/server";
import { loadData } from "@/lib/dataFile";
import { buildMonthReport, reportFileName } from "@/lib/report";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("mese") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "Mese non valido: atteso il formato AAAA-MM." },
      { status: 400 },
    );
  }

  try {
    const { data } = await loadData();
    const buffer = await buildMonthReport(data, month);
    const name = reportFileName(month);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": DOCX,
        // filename* copre gli accenti; filename resta come ripiego ASCII.
        "Content-Disposition": `attachment; filename="riepilogo-${month}.docx"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Riepilogo Word non generato.", err);
    return NextResponse.json(
      { error: "Non riesco a generare il riepilogo.", detail: String(err) },
      { status: 500 },
    );
  }
}
