-- ProdClin — v6.20.0 — Módulo de Estoque
-- 5 tabelas: Fornecedores, Materiais (catálogo), Estoque_Lotes (entrada
-- por NF, um lote por entrada com validade própria), Solicitações
-- (profissional pede, vinculado a Atendimento/Exame = centro de custo),
-- Dispensações (baixa FEFO — consome sempre o lote que vence primeiro).

-- ========== 1. FORNECEDORES ==========
create table if not exists fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  contato text,
  criado_em timestamptz not null default now()
);
alter table fornecedores enable row level security;
create policy acesso_total_anon on fornecedores for all using (true) with check (true);

-- ========== 2. MATERIAIS (catálogo) ==========
create table if not exists materiais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text,
  unidade text not null default 'unidade',
  estoque_minimo numeric not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table materiais enable row level security;
create policy acesso_total_anon on materiais for all using (true) with check (true);

-- ========== 3. ESTOQUE_LOTES (entrada por NF — validade e quantidade por lote) ==========
create table if not exists estoque_lotes (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materiais(id),
  fornecedor_id uuid references fornecedores(id),
  lote text,
  nota_fiscal text,
  data_entrada date not null default current_date,
  validade date,
  quantidade_entrada numeric not null,
  quantidade_atual numeric not null,
  valor_unitario numeric,
  criado_em timestamptz not null default now()
);
alter table estoque_lotes enable row level security;
create policy acesso_total_anon on estoque_lotes for all using (true) with check (true);
create index if not exists idx_estoque_lotes_material on estoque_lotes(material_id);
create index if not exists idx_estoque_lotes_validade on estoque_lotes(validade);

-- ========== 4. SOLICITACOES_MATERIAL (pedido do profissional) ==========
create table if not exists solicitacoes_material (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materiais(id),
  profissional_id uuid references profissionais(id),
  procedimento text,
  exame text,
  quantidade numeric not null,
  status text not null default 'pendente' check (status in ('pendente','dispensado','negado')),
  observacao text,
  solicitado_por text,
  solicitado_em timestamptz not null default now()
);
alter table solicitacoes_material enable row level security;
create policy acesso_total_anon on solicitacoes_material for all using (true) with check (true);
create index if not exists idx_solicitacoes_status on solicitacoes_material(status);

-- ========== 5. DISPENSACOES (baixa de estoque de fato, FEFO) ==========
create table if not exists dispensacoes (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references solicitacoes_material(id),
  lote_id uuid not null references estoque_lotes(id),
  quantidade numeric not null,
  dispensado_por text,
  dispensado_em timestamptz not null default now()
);
alter table dispensacoes enable row level security;
create policy acesso_total_anon on dispensacoes for all using (true) with check (true);
