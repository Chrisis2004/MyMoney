-- mymoney - schema iniziale
-- Da eseguire una volta nell'SQL Editor del progetto Supabase.
--
-- Impianto: ogni riga appartiene a un utente (user_id) e le Row Level Security
-- policy fanno in modo che ciascuno veda e modifichi soltanto le proprie righe.
-- Gli id restano testuali e generati dal client ("groceries", "tx-a1b2"): la
-- chiave primaria e' composta (user_id, id), cosi' due utenti possono avere la
-- stessa categoria "groceries" senza pestarsi i piedi.

-- ---------------------------------------------------------------- tabelle ---

-- Preferenze dell'utente. Una riga per account, creata dal trigger di sotto.
create table if not exists public.settings (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  default_income numeric(12, 2) not null default 0 check (default_income >= 0),
  updated_at     timestamptz not null default now()
);

create table if not exists public.categories (
  user_id    uuid not null references auth.users (id) on delete cascade,
  id         text not null check (length(btrim(id)) > 0),
  name       text not null check (length(btrim(name)) > 0),
  sort_order integer not null default 0,
  -- "saving" non e' spesa: alimenta il patrimonio.
  kind       text not null default 'expense' check (kind in ('expense', 'saving')),
  archived   boolean not null default false,
  primary key (user_id, id)
);

create table if not exists public.fixed_expenses (
  user_id     uuid not null references auth.users (id) on delete cascade,
  id          text not null check (length(btrim(id)) > 0),
  name        text not null check (length(btrim(name)) > 0),
  category_id text not null,
  amount      numeric(12, 2) not null,
  active      boolean not null default true,
  note        text,
  primary key (user_id, id),
  -- Cancellata la categoria spariscono le spese fisse che la usavano; l'app
  -- pero' archivia le categorie in uso invece di cancellarle.
  foreign key (user_id, category_id)
    references public.categories (user_id, id) on delete cascade
);

create table if not exists public.transactions (
  user_id          uuid not null references auth.users (id) on delete cascade,
  id               text not null check (length(btrim(id)) > 0),
  date             date not null,
  description      text not null check (length(btrim(description)) > 0),
  category_id      text not null,
  -- Sempre positivo: e' la categoria a dire se e' spesa o accantonamento.
  amount           numeric(12, 2) not null,
  note             text,
  -- Da quale spesa fissa e' stata generata. E' un'annotazione di provenienza,
  -- non un riferimento: cancellata la spesa fissa il movimento resta com'e',
  -- percio' niente foreign key qui.
  fixed_expense_id text,
  -- Movimento straordinario tenuto fuori dal budget del mese.
  excluded         boolean not null default false,
  primary key (user_id, id),
  foreign key (user_id, category_id)
    references public.categories (user_id, id) on delete cascade
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date);
create index if not exists transactions_user_category_idx
  on public.transactions (user_id, category_id);

-- Budget di una categoria per un mese preciso: una riga sola per coppia.
create table if not exists public.budgets (
  user_id     uuid not null references auth.users (id) on delete cascade,
  month       text not null check (month ~ '^\d{4}-\d{2}$'),
  category_id text not null,
  amount      numeric(12, 2) not null check (amount >= 0),
  primary key (user_id, month, category_id),
  foreign key (user_id, category_id)
    references public.categories (user_id, id) on delete cascade
);

-- Entrata fissa del mese (lo stipendio). Manca il mese -> vale default_income.
create table if not exists public.incomes (
  user_id uuid not null references auth.users (id) on delete cascade,
  month   text not null check (month ~ '^\d{4}-\d{2}$'),
  amount  numeric(12, 2) not null,
  primary key (user_id, month)
);

-- Entrata occasionale con una data: un regalo, un rimborso.
create table if not exists public.extra_incomes (
  user_id     uuid not null references auth.users (id) on delete cascade,
  id          text not null check (length(btrim(id)) > 0),
  date        date not null,
  description text not null check (length(btrim(description)) > 0),
  amount      numeric(12, 2) not null,
  note        text,
  primary key (user_id, id)
);

create index if not exists extra_incomes_user_date_idx
  on public.extra_incomes (user_id, date);

-- ------------------------------------------------------------ permessi RLS ---

-- Senza RLS attiva la chiave anonima, che sta nel browser, leggerebbe tutto.
alter table public.settings       enable row level security;
alter table public.categories     enable row level security;
alter table public.fixed_expenses enable row level security;
alter table public.transactions   enable row level security;
alter table public.budgets        enable row level security;
alter table public.incomes        enable row level security;
alter table public.extra_incomes  enable row level security;

-- Una policy per tabella, valida per select/insert/update/delete:
--   using      -> quali righe esistenti l'utente puo' vedere e toccare
--   with check -> cosa gli e' concesso scrivere (non puo' intestare righe ad altri)
do $$
declare t text;
begin
  foreach t in array array[
    'settings', 'categories', 'fixed_expenses',
    'transactions', 'budgets', 'incomes', 'extra_incomes'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_owner', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t || '_owner', t
    );
  end loop;
end $$;

-- ------------------------------------------------- nuovo utente: categorie ---

-- Un account appena creato parte con le categorie di base e le preferenze,
-- altrimenti la prima schermata sarebbe vuota e nessuna spesa registrabile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.settings (user_id) values (new.id)
    on conflict (user_id) do nothing;

  insert into public.categories (user_id, id, name, sort_order, kind) values
    (new.id, 'entertainment', 'Entertainment',  1, 'expense'),
    (new.id, 'groceries',     'Groceries',      2, 'expense'),
    (new.id, 'healt',         'Healt',          3, 'expense'),
    (new.id, 'insurance',     'Insurance',      4, 'expense'),
    (new.id, 'restaurants',   'Restaurants',    5, 'expense'),
    (new.id, 'savings',       'Savings',        6, 'saving'),
    (new.id, 'services',      'Services',       7, 'expense'),
    (new.id, 'shopping',      'Shopping',       8, 'expense'),
    (new.id, 'transport',     'Transport',      9, 'expense'),
    (new.id, 'utilities',     'Utilities',     10, 'expense'),
    (new.id, 'university',    'University',    11, 'expense')
  on conflict (user_id, id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
