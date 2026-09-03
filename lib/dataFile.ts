import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
  copyFile,
  access,
} from "node:fs/promises";
import path from "node:path";
import type { AppData } from "./types";
import { seedData } from "./seed";
import { normalizeAppData, clone } from "./normalize";

/**
 * Il file dei dati. Di default sta in `data/` dentro il progetto; con
 * RISPARMIO_DATA_FILE si puo' puntare altrove (per esempio una cartella
 * sincronizzata su iCloud o OneDrive).
 */
export const dataFilePath = process.env.RISPARMIO_DATA_FILE
  ? path.resolve(process.env.RISPARMIO_DATA_FILE)
  : path.join(process.cwd(), "data", "gestione-risparmio.json");

const backupPath = `${dataFilePath}.bak`;
const tempPath = `${dataFilePath}.tmp`;
/** Istantanee giornaliere: un solo `.bak` verrebbe bruciato dal salvataggio successivo. */
const snapshotDir = path.join(path.dirname(dataFilePath), "backups");
const SNAPSHOTS_TO_KEEP = 30;

const exists = (p: string) =>
  access(p).then(
    () => true,
    () => false,
  );

/**
 * Le scritture sono serializzate: due salvataggi ravvicinati non devono
 * sovrapporsi sullo stesso file temporaneo.
 */
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job);
  queue = next.catch(() => undefined);
  return next;
}

/**
 * Conserva lo stato con cui e' cominciata la giornata: una copia al giorno,
 * scritta al primo salvataggio, potate le piu' vecchie oltre il limite.
 */
async function snapshotOncePerDay() {
  const day = new Date().toISOString().slice(0, 10);
  const target = path.join(snapshotDir, `${day}.json`);
  if (await exists(target)) return;
  await mkdir(snapshotDir, { recursive: true });
  await copyFile(dataFilePath, target);

  const files = (await readdir(snapshotDir)).filter((f) => f.endsWith(".json")).sort();
  for (const stale of files.slice(0, Math.max(0, files.length - SNAPSHOTS_TO_KEEP))) {
    await rm(path.join(snapshotDir, stale), { force: true });
  }
}

export type LoadResult = {
  data: AppData;
  /** true quando il file non esisteva ed e' stato creato ora. */
  created: boolean;
};

/** Legge il file; se non c'e', lo crea con i dati iniziali del foglio Numbers. */
export async function loadData(): Promise<LoadResult> {
  try {
    const raw = await readFile(dataFilePath, "utf8");
    return { data: normalizeAppData(JSON.parse(raw)), created: false };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      const data = clone(seedData);
      await saveData(data);
      return { data, created: true };
    }
    // File illeggibile o JSON rotto: si prova il backup prima di arrendersi.
    if (await exists(backupPath)) {
      const raw = await readFile(backupPath, "utf8");
      return { data: normalizeAppData(JSON.parse(raw)), created: false };
    }
    throw err;
  }
}

/**
 * Scrittura atomica: prima il file temporaneo, poi una copia di sicurezza del
 * file corrente, infine il rename. Una interruzione a meta' non lascia mai il
 * file principale troncato.
 */
export async function saveData(data: AppData): Promise<AppData> {
  const clean = normalizeAppData(data);
  return serialize(async () => {
    await mkdir(path.dirname(dataFilePath), { recursive: true });
    await writeFile(tempPath, `${JSON.stringify(clean, null, 2)}\n`, "utf8");
    if (await exists(dataFilePath)) {
      await copyFile(dataFilePath, backupPath);
      // Se le istantanee falliscono il salvataggio deve comunque andare avanti.
      await snapshotOncePerDay().catch((err) =>
        console.error("Istantanea giornaliera non riuscita.", err),
      );
    }
    await rename(tempPath, dataFilePath);
    return clean;
  });
}
