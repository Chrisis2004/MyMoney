-- Via l'interruttore delle spese fisse.
--
-- `active` doveva dire se una spesa si porta avanti di mese in mese, ma in
-- pagina finiva per essere letto come "gia' pagata", che e' un'altra cosa: se
-- una spesa e' coperta lo dicono le transazioni collegate, non una colonna.
-- Una spesa che non si ripete piu' si cancella, e i movimenti che ha generato
-- restano nei mesi in cui sono stati registrati.
--
-- Nessun dato da salvare: la colonna non viene piu' letta da nessuna parte.
alter table public.fixed_expenses
  drop column if exists active;
