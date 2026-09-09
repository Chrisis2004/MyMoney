# mymoney

App Next.js che rifà quello che faceva il foglio Numbers *Budget mensile — Settembre 2026*,
ma su più mesi: transazioni, budget per categoria, spese fisse ricorrenti e andamento del
risparmio nel tempo.

## Avvio

L'app si appoggia a Supabase: database Postgres per i dati, autenticazione via email e
password. Serve un progetto Supabase e due variabili d'ambiente.

**1. Crea lo schema.** Apri il progetto su [supabase.com](https://supabase.com), vai in
*SQL Editor*, incolla il contenuto di [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
ed esegui. Crea le tabelle, le policy RLS e il trigger che dà a ogni nuovo account le
categorie di partenza.

**2. Disattiva la conferma via email.** In *Authentication → Sign In / Providers → Email*
togli *Confirm email*, così ci si registra e si entra subito. Lasciandola attiva l'app
funziona lo stesso, ma dopo la registrazione bisogna aprire il link ricevuto per posta.

**3. Configura le variabili.** Copia `.env.local.example` in `.env.local` e riempilo con i
valori del progetto:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

- **URL** — *Project Settings → Data API → Project URL*. Solo schema e host, senza percorsi:
  `supabase-js` aggiunge da sé `/auth/v1` e `/rest/v1`. Lasciandoci dentro un `/rest/v1`
  la registrazione fallisce con `PGRST125: Invalid path specified in request URL`, perché
  la chiamata di autenticazione finisce su PostgREST invece che su GoTrue.
- **Chiave** — *Project Settings → API Keys → Publishable key* (`sb_publishable_…`, quella
  che un tempo si chiamava `anon`). È pensata per stare nel browser: da sola non apre
  niente, sono le policy RLS a decidere cosa ciascun account può vedere.

> Non usare qui la **Secret key** (`sb_secret_…`, già `service_role`). Scavalca le RLS, e
> in una variabile `NEXT_PUBLIC_` finisce nel bundle JavaScript che il browser scarica:
> chiunque apra la pagina potrebbe leggere e modificare i dati di tutti gli account. Se
> succede: revocala da *API Keys*, ripulisci `.next`, riparti con quella pubblicabile.

**4. Avvia.**

```bash
bun install
bun run dev      # http://localhost:3000
```

La prima volta vai su `/registrazione` e crea il tuo account: nome, cognome, email e
password.

Build di produzione:

```bash
bun run build
bun run start
```

> Non lanciare `bun run build` mentre `bun run dev` è attivo: le due cose scrivono nella
> stessa cartella `.next` e il dev server si rompe. Se succede: ferma il dev server,
> `rm -rf .next`, riavvia.

### Portare dentro i dati del vecchio file

Chi arriva dalla versione che salvava su file lancia una volta sola, dopo essersi
registrato:

```bash
bun run importa -- --email tua@email.it --password laTuaPassword
```

Legge `data/gestione-risparmio.json` (con `--file` se ne indica un altro, per esempio una
delle istantanee in `data/backups/`) e lo riversa sul proprio account. Entra come utente
normale, quindi passa dalle stesse policy RLS dell'app: nessuna service key in giro.
Rilanciarlo è innocuo, riallinea e basta.

## Dove stanno i dati

Su Supabase, una tabella per concetto, ogni riga intestata a un utente:

| Tabella | Cosa contiene |
|---|---|
| `settings` | Le preferenze dell'account: per ora l'entrata mensile predefinita. Una riga per utente. |
| `categories` | Le categorie, con ordine di visualizzazione e tipo (`expense` o `saving`). |
| `fixed_expenses` | Le spese fisse ricorrenti da cui si generano i movimenti del mese. |
| `transactions` | I movimenti: data, descrizione, categoria, importo, provenienza, flag *non contabilizzato*. |
| `budgets` | Il budget di una categoria in un mese preciso. Una riga per coppia mese+categoria. |
| `incomes` | L'entrata fissa di un mese. Manca il mese: vale `settings.default_income`. |
| `extra_incomes` | Le entrate occasionali con una data. |

Nome e cognome non hanno una tabella: stanno nei metadati dell'utente Supabase
(`auth.users.raw_user_meta_data`, letti da `lib/account.ts`). Sono dati dell'identità, non
dell'app, arrivano già dentro la sessione verificata — quindi il nome in alto a destra c'è
al primo paint, senza una lettura in più a ogni pagina — e restano attaccati all'account
anche se un giorno i dati venissero azzerati. Si modificano da *Impostazioni → Account*, che
scrive con `supabase.auth.updateUser`.

Gli id restano testuali e generati dal client (`groceries`, `tx-a1b2`) e la chiave primaria
è composta `(user_id, id)`: due account possono avere la stessa categoria `groceries` senza
interferire.

### Permessi

Su ogni tabella la Row Level Security è attiva e c'è una sola policy, valida per
select/insert/update/delete:

```sql
using (auth.uid() = user_id) with check (auth.uid() = user_id)
```

`using` decide quali righe esistenti l'utente può vedere e toccare, `with check` cosa gli è
concesso scrivere — in particolare non può intestare righe a qualcun altro. Senza RLS la
chiave anonima, che sta nel browser, leggerebbe i dati di tutti.

Un account appena creato riceve dal trigger `handle_new_user` la riga di `settings` e le
undici categorie di partenza, altrimenti la prima schermata sarebbe vuota e nessuna spesa
registrabile.

### Come salva

Il salvataggio è automatico: dopo ogni modifica parte una scrittura (raggruppata su 400 ms,
così una raffica di modifiche produce una sola richiesta). L'indicatore in alto a destra
dice *Salvo… / Salvato / Non salvato*; se una scrittura fallisce compare una barra rossa con
**Riprova**, e le modifiche restano nella pagina finché non la chiudi.

Dettagli che contano:

- **Si scrive solo ciò che cambia.** L'app tiene in memoria un unico oggetto `AppData`; il
  server (`lib/supabase/repository.ts`) lo confronta riga per riga con quello che c'è già e
  manda al database solo le differenze. Modificare un importo non riscrive tutto lo storico.
- **L'ordine delle operazioni segue le foreign key.** Le categorie nascono prima di ciò che
  le referenzia e muoiono per ultime. PostgREST non offre una transazione unica, ma ogni
  passo è idempotente: un salvataggio interrotto viene sanato dal successivo.
- **Niente scritture prima di aver letto.** Un flag interno si alza solo dopo una lettura
  riuscita; finché è basso nessuna scrittura può partire, nemmeno quella di chiusura
  pagina. Senza questo controllo una lettura fallita seguita dalla chiusura della scheda
  spediva lo stato iniziale e cancellava i dati.
- **Se la lettura fallisce l'app non scrive.** Compare una schermata d'errore con
  *Riprova*: meglio non poter lavorare che sovrascrivere dati validi con dati parziali.
- **I dati in arrivo vengono validati** (`lib/normalize.ts`) prima di toccare il database:
  le righe malformate vengono scartate, non salvate.
- **Alla chiusura della pagina** l'ultima modifica non ancora scritta parte con
  `navigator.sendBeacon`, così non si perde.
- **Sessione scaduta:** l'API risponde 401 e l'app riporta all'accesso invece di mostrare un
  errore che l'utente non può risolvere restando lì.
- **Una scheda per volta.** Due schede aperte sugli stessi dati si sovrascrivono a vicenda:
  vince l'ultima che scrive.

Restano nel browser solo due preferenze di interfaccia: il tema chiaro/scuro (serve prima
del primo paint, quindi deve stare lì) e il mese selezionato.

Da **Impostazioni** puoi comunque esportare un backup JSON, ripristinarlo, ed
esportare/importare le transazioni in CSV (`Data;Descrizione;Categoria;Importo;Note`),
formato leggibile da Numbers ed Excel.

### Le attese

Ogni cosa che fa aspettare lo dice, con la forma adatta alla sua durata:

| Dove | Cosa si vede |
|---|---|
| Primo caricamento dei dati | L'ossatura della pagina (`PageSkeleton`): titolo, riga di riquadri, due schede. Ha le proporzioni del contenuto vero, così quando arriva il layout non salta. |
| Passaggio da una pagina all'altra | Una barretta che scorre sotto la voce di menu verso cui si sta andando (`useLinkStatus`), e `app/(app)/loading.tsx` al posto del contenuto. È in posizione assoluta: un indicatore che occupasse spazio farebbe ballare il menu proprio mentre lo si usa. |
| Accesso, registrazione, uscita | Cerchietto dentro il pulsante e testo che cambia (*Accedo…*). Il pulsante **resta** in attesa dopo che le credenziali sono passate, perché la pagina di destinazione deve ancora arrivare: spegnerlo lì farebbe sembrare il clic andato perso. |
| Riepilogo Word | *Preparo il documento…*. Il `.docx` si chiede con `fetch` e non con un link diretto, così l'attesa è visibile e un errore del server diventa un messaggio invece di un file JSON scaricato. |
| Salvataggio | L'indicatore in alto a destra: *Salvo… / Salvato / Non salvato*. |
| Nome dell'account | Cerchietto nel pulsante *Salva* di Impostazioni, con l'esito scritto sotto. |

In produzione le pagine vengono prefetchate, quindi tra una pagina e l'altra l'indicatore
compare solo quando c'è davvero da aspettare — rete lenta, cache fredda, primo ingresso.

Con `prefers-reduced-motion` niente rotazioni né scorrimenti: resta la sola variazione di
opacità, che dice "sto lavorando" senza movimento.

### Accesso

Registrazione e accesso con email e password (`/registrazione`, `/accedi`); alla
registrazione si danno anche nome e cognome, che compaiono poi in alto a destra accanto al
cerchietto con le iniziali. Sotto `sm` resta il solo cerchietto — l'intestazione ha già mese,
stato del salvataggio e tema — ma il nome per esteso resta leggibile ai lettori di schermo. Il
`middleware.ts` gira prima di ogni richiesta: rinnova il token scaduto e sbarra la strada a
chi non ha una sessione — redirect alle pagine, 401 alle chiamate API. Il layout del gruppo
`(app)` ripete il controllo sul server, perché è lui a decidere cosa viene renderizzato.

## Pagine

| Pagina | Cosa fa |
|---|---|
| **Riepilogo** | Entrate, uscite, non contabilizzate, quanto resta. Grafico Budget vs Effettivo, distribuzione del budget e la tabella *Riepilogo per categoria* del foglio originale. Da qui si scarica il riepilogo in Word. |
| **Transazioni** | Aggiunta, modifica, cancellazione, ricerca e filtro per categoria del mese selezionato. Tabella separata per i movimenti non contabilizzati. |
| **Budget** | Il piano del mese, con *Copia dal mese precedente* e *Allinea alle spese fisse*. Qui si registrano anche le entrate extra. |
| **Spese fisse** | Affitto, bollette, abbonamenti. Il pulsante *Genera* crea in un colpo solo le transazioni del mese, senza duplicare quelle già registrate. |
| **Andamento** | Giorno per giorno del mese selezionato, poi entrate vs uscite mese per mese, con tabella. |
| **Impostazioni** | Categorie, entrate predefinite, account (nome, cognome, email), backup, import/export, azzeramento. |

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

### I grafici

Word non ha un renderer di immagini lato server, e aggiungere `node-canvas` su Windows
significa compilare codice nativo. I grafici sono quindi **disegnati con costrutti nativi di
Word**: tabelle annidate con sfondi colorati e altezze di riga fisse. Il risultato è migliore
di un'immagine — resta nitido in stampa a qualunque zoom, il testo è testo vero, e chi riceve
il documento può modificarlo.

- **Budget contro effettivo** — due barre per categoria, blu il budget e arancio l'effettivo.
- **Distribuzione del budget** — la torta srotolata in una barra unica al 100%, con la
  legenda completa sotto. Stessi sei colori dell'app più il neutro per «Altro».
- **Andamento del mese** — barra della spesa per ogni giorno con movimenti, più entrate extra
  e cumulato.

Colori, grassetti e allineamenti seguono la stessa palette dell'app in versione chiara, che è
quella giusta sulla carta bianca: importi a destra, differenze negative e sforamenti in
rosso, righe alternate, intestazioni ripetute quando una tabella cambia pagina, piè di pagina
con numerazione. Lo stato del budget resta icona **più** etichetta, mai il solo colore.

Lo costruisce il server leggendo il database (`GET /api/riepilogo?mese=AAAA-MM`), non lo
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
app/(app)/        le pagine vere, dietro l'accesso (App Router)
app/(auth)/       accedi e registrazione, fuori dallo store
app/api/dati/     GET legge dal database, PUT/POST scrivono le differenze
app/api/riepilogo/ genera il .docx del mese
middleware.ts     rinnovo della sessione e blocco di chi non ha fatto l'accesso
supabase/migrations/ lo schema SQL da eseguire sul progetto Supabase
scripts/          importazione una tantum del vecchio file JSON
lib/supabase/     client (browser/server) e repository tabelle <-> AppData
lib/report.ts     costruzione del documento Word
components/       AppShell, modulo di accesso, primitivi UI, grafici, tabelle
lib/normalize.ts  validazione dei dati in ingresso (client e server)
lib/store.tsx     stato dell'app e salvataggio automatico
lib/account.ts    tipo Account e lettura di nome/cognome dai metadati Supabase
lib/session.tsx   chi ha fatto l'accesso, disponibile alle pagine dal primo paint
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
