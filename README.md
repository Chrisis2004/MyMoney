# Gestione risparmio

App Next.js che rifà quello che faceva il foglio Numbers *Budget mensile — Settembre 2026*,
ma su più mesi: transazioni, budget per categoria, spese fisse ricorrenti e andamento del
risparmio nel tempo.

## Avvio

```bash
bun install
bun run dev      # http://localhost:3000
```

Build di produzione:

```bash
bun run build
bun run start
```

> Non lanciare `bun run build` mentre `bun run dev` è attivo: le due cose scrivono nella
> stessa cartella `.next` e il dev server si rompe. Se succede: ferma il dev server,
> `rm -rf .next`, riavvia.

## Dove stanno i dati

In un file JSON sul disco, riscritto a ogni modifica:

```
data/gestione-risparmio.json          # i tuoi dati
data/gestione-risparmio.json.bak      # la versione immediatamente precedente
data/backups/AAAA-MM-GG.json          # com'erano all'inizio di quel giorno (ultimi 30)
```

Il salvataggio è automatico: dopo ogni modifica parte una scrittura (raggruppata su
400 ms, così una raffica di modifiche produce una sola scrittura). L'indicatore in alto a
destra dice *Salvo… / Salvato / Non salvato*; se una scrittura fallisce compare una barra
rossa con **Riprova**, e le modifiche restano nella pagina finché non la chiudi.

Dettagli che contano:

- **Scrittura atomica.** Si scrive su un file temporaneo, si copia il file corrente in
  `.bak`, poi si rinomina. Un'interruzione a metà non lascia il file troncato.
- **Niente scritture prima di aver letto.** Un flag interno si alza solo dopo una lettura
  riuscita; finché è basso nessuna scrittura può partire, nemmeno quella di chiusura
  pagina. Senza questo controllo una lettura fallita seguita dalla chiusura della scheda
  spediva lo stato iniziale e cancellava il file.
- **Se la lettura fallisce l'app non scrive.** Compare una schermata d'errore con
  *Riprova*: meglio non poter lavorare che sovrascrivere un file valido con dati parziali.
- **I dati in arrivo vengono validati** (`lib/normalize.ts`) prima di finire sul file: le
  righe malformate vengono scartate, non salvate.
- **Alla chiusura della pagina** l'ultima modifica non ancora scritta parte con
  `navigator.sendBeacon`, così non si perde.
- **Una scheda per volta.** Due schede aperte sugli stessi dati si sovrascrivono a vicenda:
  vince l'ultima che scrive.
- **Spostare il file:** imposta `RISPARMIO_DATA_FILE` con un percorso assoluto (per esempio
  una cartella iCloud o OneDrive) e riavvia. `data/` è escluso da git.

Restano nel browser solo due preferenze di interfaccia: il tema chiaro/scuro (serve prima
del primo paint, quindi deve stare lì) e il mese selezionato.

Da **Impostazioni** puoi comunque esportare un backup JSON, ripristinarlo, ed
esportare/importare le transazioni in CSV (`Data;Descrizione;Categoria;Importo;Note`),
formato leggibile da Numbers ed Excel.

## Pagine

| Pagina | Cosa fa |
|---|---|
| **Riepilogo** | Entrate, uscite, non contabilizzate, quanto resta. Grafico Budget vs Effettivo, distribuzione del budget e la tabella *Riepilogo per categoria* del foglio originale. Da qui si scarica il riepilogo in Word. |
| **Transazioni** | Aggiunta, modifica, cancellazione, ricerca e filtro per categoria del mese selezionato. Tabella separata per i movimenti non contabilizzati. |
| **Budget** | Il piano del mese, con *Copia dal mese precedente* e *Allinea alle spese fisse*. Qui si registrano anche le entrate extra. |
| **Spese fisse** | Affitto, bollette, abbonamenti. Il pulsante *Genera* crea in un colpo solo le transazioni del mese, senza duplicare quelle già registrate. |
| **Andamento** | Giorno per giorno del mese selezionato, poi entrate vs uscite mese per mese, con tabella. |
| **Impostazioni** | Categorie, entrate predefinite, percorso del file dati, backup, import/export, azzeramento. |

Il mese si sceglie con le frecce in alto ed è condiviso da tutte le pagine.

## Entrate: fisse ed extra

Due cose diverse, tenute separate.

- **Entrate fisse del mese** — un solo importo, lo stipendio, quello su cui pianifichi. Non
  ha una data. Si imposta nella pagina Budget; il valore predefinito per i mesi senza un
  importo proprio sta in Impostazioni.
- **Entrate extra** — occasionali e **datate**: un regalo, un aiuto in famiglia, un
  rimborso. Si aggiungono dalla pagina Budget con data, descrizione, importo e note.

Le entrate del mese sono la somma delle due, e il riquadro *Entrate* nel Riepilogo mostra la
scomposizione quando ci sono extra. Avere una data le rende utili nel grafico giorno per
giorno, dove fanno salire la linea a gradino nel giorno in cui arrivano.

Le entrate extra stanno nel backup JSON ma **non** nell'export CSV, che riguarda le sole
transazioni.

## Riepilogo in Word

Il pulsante **Scarica riepilogo Word** in cima al Riepilogo produce un `.docx` del mese
visualizzato: sintesi (entrate fisse ed extra, uscite, non contabilizzate, quanto resta,
tasso di risparmio), tabella per categoria con totali, entrate extra, movimenti e — se ce ne
sono — movimenti non contabilizzati.

È un documento Word **vero**, generato con la libreria `docx`, non un HTML rinominato: Word
lo apre senza avvisi di compatibilità e le tabelle sono tabelle modificabili. Il file si
chiama `Budget mensile - Settembre 2026.docx`.

Lo costruisce il server leggendo il file dei dati (`GET /api/riepilogo?mese=AAAA-MM`), non lo
stato della pagina. Per questo il pulsante si disabilita quando un salvataggio è in errore:
il documento non corrisponderebbe a quello che vedi a schermo.

## Movimenti non contabilizzati

Le spese straordinarie — l'acquisto di un'auto, una una tantum — falserebbero il budget del
mese. La spunta **Non contabilizzare nel budget** in fase di inserimento le tiene fuori:

- non entrano nell'*Effettivo* delle categorie né nelle *Uscite* del mese, quindi non
  toccano il confronto con il budget né i grafici;
- finiscono in una tabella a parte nella pagina Transazioni, con il proprio totale;
- il riquadro **Non contabilizzate** nel Riepilogo ne mostra la somma;
- *Resta* continua a essere una lettura del budget e non le sottrae — quando ce ne sono, il
  riquadro lo dice esplicitamente.

Un movimento si sposta fra le due tabelle in qualsiasi momento con **Escludi** /
**Contabilizza**. Nel CSV il flag viaggia nella colonna `Contabilizzata` (`No` = fuori
budget); se la colonna manca il movimento è contabilizzato.

## Dati iniziali

`lib/seed.ts` contiene quanto ricavato dal foglio Numbers: le 11 categorie, il budget di
settembre 2026 (totale 2.075,00 €), le 14 spese fisse e le entrate mensili di 5.026,60 €.
Le percentuali di distribuzione coincidono con il grafico a torta dell'originale.

Le tre transazioni di settembre nel seed sono ricostruite solo in parte dal file `.numbers`
(importi 22, 5 e 11 €): descrizione e categoria vanno verificate. Le note lo segnalano.

## Struttura

```
app/              una cartella per pagina (App Router)
app/api/dati/     GET legge il file, PUT/POST lo riscrivono
app/api/riepilogo/ genera il .docx del mese
lib/report.ts     costruzione del documento Word
components/       AppShell, primitivi UI, grafici, tabella riepilogo
lib/dataFile.ts   lettura/scrittura atomica del file (solo server)
lib/normalize.ts  validazione dei dati in ingresso (client e server)
lib/store.tsx     stato dell'app e salvataggio automatico
lib/calc.ts       calcoli derivati; lib/format.ts formattazione it-IT
```

I calcoli (riepilogo per categoria, totali del mese, mesi noti) stanno in `lib/calc.ts` e
sono funzioni pure sui dati: le pagine non fanno aritmetica per conto loro.

## Il grafico giorno per giorno

L'entrata fissa è un valore **mensile e senza data**: una linea "entrate del giorno" sarebbe
piatta a zero e non direbbe nulla. Il grafico la usa quindi come **livello di partenza**
(tratteggiato finché non ci sono extra) e ci fa salire contro le **uscite cumulate**
dall'inizio del mese. Le **entrate extra**, che invece una data ce l'hanno, alzano la linea
a gradino nel giorno in cui arrivano — con un punto a segnarlo. Così entrambe le serie hanno
un significato in ogni giorno, e a colpo d'occhio si vede se e quando si va a sbattere
contro il tetto del mese.

Nel mese in corso la linea si ferma a oggi: prolungarla piatta fino a fine mese direbbe
"da qui in poi non spendo più", che non è un dato. Il passaggio del mouse su un giorno dà
speso nel giorno, cumulato e quanto resta. I movimenti non contabilizzati restano fuori,
come ovunque.

## Note sui grafici

Palette validata per contrasto e daltonismo in tema chiaro e scuro (`scripts/validate_palette.js`
della skill dataviz), inclusa la giunzione dove l'anello si chiude.

La ciambella mostra **sei categorie nominate più "Altro"**. Il limite non è estetico: oltre
la sesta servono tinte che nell'anello si toccano senza essere distinguibili — in tema scuro
la settima (violetto) accostata alla prima (blu) misura ΔE 1,9 in protanopia, cioè lo stesso
colore. L'elenco sotto la ciambella riporta comunque **tutte** le categorie con importo e
percentuale, e fa da legenda: nessun dato si perde dentro "Altro" e l'identità non è mai
affidata al solo colore.

Lo stato del budget (nel budget / quasi esaurito / fuori budget) è sempre icona **e**
etichetta.
