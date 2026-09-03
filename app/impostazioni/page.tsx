"use client";

import { useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { activeCategories } from "@/lib/calc";
import { formatDate, formatEur, parseAmount } from "@/lib/format";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import type { AppData, Transaction } from "@/lib/types";

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Divide una riga CSV rispettando le virgolette. */
function splitCsvLine(line: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ";" || ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** "14/09/2026" o "2026-09-14" -> "2026-09-14". Stringa vuota se non riconosciuta. */
function parseDate(raw: string) {
  const it = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (it) return `${it[3]}-${it[2].padStart(2, "0")}-${it[1].padStart(2, "0")}`;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso ? raw : "";
}

export default function SettingsPage() {
  const {
    data,
    filePath,
    savedAt,
    saveStatus,
    reload,
    addCategory,
    updateCategory,
    removeCategory,
    setDefaultIncome,
    addTransactions,
    replaceAll,
    resetToSeed,
    clearAll,
  } = useStore();

  const categories = useMemo(() => activeCategories(data), [data]);
  const archived = data.categories.filter((c) => c.archived);
  const [newCat, setNewCat] = useState("");
  const [newKind, setNewKind] = useState<"expense" | "saving">("expense");
  const [income, setIncomeField] = useState(String(data.defaultIncome).replace(".", ","));
  const [importReport, setImportReport] = useState<string | null>(null);
  const [confirmDanger, setConfirmDanger] = useState<null | "reset" | "clear">(null);
  const jsonInput = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);

  const exportJson = () =>
    download(
      `gestione-risparmio-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(data, null, 2),
      "application/json",
    );

  const exportCsv = () => {
    const cats = new Map(data.categories.map((c) => [c.id, c.name]));
    const header = "Data;Descrizione;Categoria;Importo;Note;Contabilizzata";
    const body = [...data.transactions]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((t) =>
        [
          formatDate(t.date),
          `"${t.description.replace(/"/g, '""')}"`,
          cats.get(t.categoryId) ?? "",
          String(t.amount).replace(".", ","),
          `"${(t.note ?? "").replace(/"/g, '""')}"`,
          t.excluded ? "No" : "Sì",
        ].join(";"),
      );
    download(
      `transazioni-${new Date().toISOString().slice(0, 10)}.csv`,
      // BOM: Excel e Numbers aprono cosi' il file in UTF-8 senza accenti rotti.
      `﻿${[header, ...body].join("\r\n")}`,
      "text/csv;charset=utf-8",
    );
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as AppData;
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.categories)) {
        setImportReport("Il file non sembra un backup di questa app.");
        return;
      }
      replaceAll(parsed);
      setImportReport(
        `Backup ripristinato: ${parsed.transactions?.length ?? 0} transazioni, ${parsed.categories.length} categorie.`,
      );
    } catch {
      setImportReport("Non riesco a leggere il file: JSON non valido.");
    }
  };

  const importCsv = async (file: File) => {
    const text = (await file.text()).replace(/^﻿/, "");
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      setImportReport("Il CSV non contiene righe.");
      return;
    }

    const byName = new Map(data.categories.map((c) => [c.name.toLowerCase(), c.id]));
    const fallback = categories[0]?.id;
    const created: Omit<Transaction, "id">[] = [];
    const problems: string[] = [];

    lines.slice(1).forEach((line, i) => {
      const [rawDate, description, category, rawAmount, note, counted] = splitCsvLine(line);
      const date = parseDate(rawDate ?? "");
      const amount = parseAmount(rawAmount ?? "");
      if (!date || !description || !Number.isFinite(amount) || amount <= 0) {
        problems.push(`riga ${i + 2}`);
        return;
      }
      const categoryId = byName.get((category ?? "").toLowerCase()) ?? fallback;
      if (!categoryId) {
        problems.push(`riga ${i + 2}`);
        return;
      }
      // Colonna assente nei CSV vecchi: in quel caso il movimento e' contabilizzato.
      const excluded = /^(no|false|0)$/i.test((counted ?? "").trim());
      created.push({
        date,
        description,
        categoryId,
        amount,
        note: note || undefined,
        ...(excluded ? { excluded: true } : {}),
      });
    });

    if (created.length) addTransactions(created);
    setImportReport(
      `Importate ${created.length} transazioni.` +
        (problems.length ? ` Saltate ${problems.length} righe (${problems.slice(0, 5).join(", ")}${problems.length > 5 ? "…" : ""}).` : ""),
    );
  };

  return (
    <div className="space-y-5">
      <Card
        title="Categorie"
        description="Le categorie di tipo accantonamento non contano come uscita: alimentano il risparmio."
      >
        <ul className="divide-y divide-hairline">
          {categories.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 py-2">
              <Input
                defaultValue={c.name}
                className="h-8 w-48 text-sm"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v) updateCategory(c.id, { name: v });
                  else e.target.value = c.name;
                }}
                aria-label={`Nome della categoria ${c.name}`}
              />
              <Select
                value={c.kind}
                className="h-8 w-40 text-xs"
                onChange={(e) =>
                  updateCategory(c.id, { kind: e.target.value as "expense" | "saving" })
                }
                aria-label={`Tipo della categoria ${c.name}`}
              >
                <option value="expense">Spesa</option>
                <option value="saving">Accantonamento</option>
              </Select>
              <span className="text-xs text-ink-muted">
                {data.transactions.filter((t) => t.categoryId === c.id).length} movimenti
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={() => removeCategory(c.id)}
              >
                Rimuovi
              </Button>
            </li>
          ))}
        </ul>

        {archived.length > 0 && (
          <p className="mt-3 text-xs text-ink-muted">
            Archiviate (hanno movimenti collegati, quindi non sono state cancellate):{" "}
            {archived.map((c) => c.name).join(", ")}.{" "}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => archived.forEach((c) => updateCategory(c.id, { archived: false }))}
            >
              Ripristina tutte
            </button>
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Nuova categoria" className="w-48">
            <Input
              value={newCat}
              placeholder="Viaggi"
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newCat.trim()) {
                  addCategory(newCat.trim(), newKind);
                  setNewCat("");
                }
              }}
            />
          </Field>
          <Field label="Tipo" className="w-44">
            <Select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as "expense" | "saving")}
            >
              <option value="expense">Spesa</option>
              <option value="saving">Accantonamento</option>
            </Select>
          </Field>
          <Button
            variant="primary"
            disabled={!newCat.trim()}
            onClick={() => {
              addCategory(newCat.trim(), newKind);
              setNewCat("");
            }}
          >
            Aggiungi
          </Button>
        </div>
      </Card>

      <Card
        title="Entrate predefinite"
        description="Usate per i mesi che non hanno un valore proprio."
      >
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Importo mensile" className="w-44">
            <Input
              inputMode="decimal"
              className="text-right"
              value={income}
              onChange={(e) => setIncomeField(e.target.value)}
              onBlur={(e) => {
                const v = parseAmount(e.target.value);
                if (Number.isFinite(v) && v >= 0) setDefaultIncome(Math.round(v * 100) / 100);
                else setIncomeField(String(data.defaultIncome).replace(".", ","));
              }}
            />
          </Field>
          <p className="pb-2 text-xs text-ink-muted">Attuale: {formatEur(data.defaultIncome)}</p>
        </div>
      </Card>

      <Card
        title="File dei dati"
        description="Tutto quello che inserisci finisce qui, riscritto a ogni modifica."
        action={
          <Button size="sm" onClick={reload}>
            Ricarica dal file
          </Button>
        }
      >
        <p className="break-all rounded-lg border border-hairline bg-sunken px-3 py-2 text-xs text-ink">
          {filePath ?? "percorso non disponibile"}
        </p>
        <p className="mt-2 text-xs text-ink-secondary">
          {saveStatus === "error"
            ? "L'ultimo salvataggio non è riuscito."
            : savedAt
              ? `Ultimo salvataggio: ${new Date(savedAt).toLocaleString("it-IT")}.`
              : "Nessuna modifica da salvare in questa sessione."}{" "}
          Accanto al file viene tenuta una copia <code>.bak</code> della versione precedente.
          Per spostarlo altrove (per esempio in una cartella sincronizzata) imposta la variabile
          d&apos;ambiente <code>RISPARMIO_DATA_FILE</code> e riavvia l&apos;app.
        </p>
        <p className="mt-2 text-xs text-ink-muted">
          Tieni aperta una sola scheda per volta: due schede che modificano gli stessi dati si
          sovrascrivono a vicenda.
        </p>
      </Card>

      <Card
        title="Backup e importazione"
        description="Copie da tenere fuori dalla cartella del progetto, o da riportare in Numbers."
      >
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportJson}>Esporta backup JSON</Button>
          <Button onClick={() => jsonInput.current?.click()}>Ripristina da JSON</Button>
          <Button onClick={exportCsv}>Esporta transazioni CSV</Button>
          <Button onClick={() => csvInput.current?.click()}>Importa transazioni CSV</Button>
        </div>
        <input
          ref={jsonInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importJson(f);
            e.target.value = "";
          }}
        />
        <input
          ref={csvInput}
          type="file"
          accept="text/csv,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importCsv(f);
            e.target.value = "";
          }}
        />
        <p className="mt-3 text-xs text-ink-muted">
          Il ripristino da JSON sostituisce il contenuto del file. Formato CSV atteso, separatore <code>;</code> o <code>,</code>:{" "}
          <code>Data;Descrizione;Categoria;Importo;Note;Contabilizzata</code>. Le date
          accettano <code>14/09/2026</code> o <code>2026-09-14</code>. In{" "}
          <code>Contabilizzata</code> un <code>No</code> segna il movimento come straordinario;
          se la colonna manca il movimento e&apos; contabilizzato. Le categorie sconosciute
          finiscono nella prima categoria disponibile.
        </p>
        {importReport && (
          <p className="mt-2 rounded-lg border border-hairline bg-sunken px-3 py-2 text-xs text-ink-secondary">
            {importReport}
          </p>
        )}
      </Card>

      <Card
        title="Azzeramento"
        description="Riscrivono subito il file dei dati: esporta prima un backup."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="danger"
            onClick={() => setConfirmDanger(confirmDanger === "clear" ? null : "clear")}
          >
            Svuota transazioni, budget e spese fisse
          </Button>
          <Button
            variant="danger"
            onClick={() => setConfirmDanger(confirmDanger === "reset" ? null : "reset")}
          >
            Ripristina i dati del foglio Numbers
          </Button>
        </div>
        {confirmDanger && (
          <div className="mt-3 rounded-lg border border-hairline-strong bg-sunken px-3 py-2.5">
            <p className="text-xs text-ink">
              {confirmDanger === "clear"
                ? "Cancella tutte le transazioni, i budget e le spese fisse. Le categorie restano."
                : "Sostituisce tutto con i dati iniziali importati dal foglio di Settembre 2026."}{" "}
              Confermi?
            </p>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  if (confirmDanger === "clear") clearAll();
                  else resetToSeed();
                  setConfirmDanger(null);
                  setImportReport(null);
                }}
              >
                Sì, procedi
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDanger(null)}>
                Annulla
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
