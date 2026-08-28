-- ProdClin — v6.19.0 — Cadastro de Pacientes e Profissionais (Fase 1)
-- Cria as tabelas, liga producao a elas por FK (sem mexer nas colunas de
-- texto que já existiam), e migra os 15.507 lançamentos existentes por
-- nome. Rodado e validado nesta conversa — resultado final: 4.986
-- pacientes, 31 profissionais, 100% dos lançamentos ligados nos dois
-- vínculos.

-- ========== 1. TABELAS NOVAS ==========
create table if not exists pacientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  whatsapp text,
  endereco text,
  criado_em timestamptz not null default now()
);
alter table pacientes enable row level security;
create policy acesso_total_anon on pacientes for all using (true) with check (true);

create table if not exists profissionais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  registro_profissional text,
  especialidade text,
  criado_em timestamptz not null default now()
);
alter table profissionais enable row level security;
create policy acesso_total_anon on profissionais for all using (true) with check (true);

-- ========== 2. COLUNAS NOVAS EM producao (sem mexer nas colunas de texto que já existem) ==========
alter table producao add column if not exists paciente_id uuid references pacientes(id);
alter table producao add column if not exists profissional_id uuid references profissionais(id);
create index if not exists idx_producao_paciente_id on producao(paciente_id);
create index if not exists idx_producao_profissional_id on producao(profissional_id);

-- ========== 3. POPULA profissionais a partir da lista já cadastrada ==========
insert into profissionais (nome)
select nome from (
  select distinct trim(valor) as nome from listas where tipo = 'profissionais' and trim(valor) <> ''
) origem
where not exists (select 1 from profissionais p where lower(p.nome) = lower(origem.nome));

-- ========== 4. POPULA pacientes a partir dos nomes distintos já lançados em producao ==========
insert into pacientes (nome)
select nome from (
  select distinct trim(paciente) as nome from producao where paciente is not null and trim(paciente) <> ''
) origem
where not exists (select 1 from pacientes p where lower(p.nome) = lower(origem.nome));

-- ========== 5. LIGA os lançamentos existentes aos cadastros novos, por nome ==========
update producao p set profissional_id = pr.id
from profissionais pr
where lower(trim(p.prof)) = lower(trim(pr.nome)) and p.profissional_id is null;

update producao p set paciente_id = pa.id
from pacientes pa
where lower(trim(p.paciente)) = lower(trim(pa.nome)) and p.paciente_id is null;

-- ========== 6. Os 5 profissionais que não bateram com a lista oficial (decisão do usuário: criar como registros próprios) ==========
alter table profissionais add column if not exists observacoes text;

insert into profissionais (nome, observacoes) values
  ('DR MAURICIO EXAMES', 'Mesma pessoa que "DR MAURICIO", usado pra lançamentos de exames — tratar consolidação depois (apontado em 26/08/2026)'),
  ('DRA AMANDA USG', 'Mesma pessoa que a Dra. Amanda já cadastrada, usado pra lançamentos de USG — tratar consolidação depois (apontado em 26/08/2026)'),
  ('DR CHARLES USG', null),
  ('CLEIA', null),
  ('JAQUELANE PONTE', null);

update producao p set profissional_id = pr.id
from profissionais pr
where lower(trim(p.prof)) = lower(trim(pr.nome)) and p.profissional_id is null;

-- ========== 7. Último ajuste — 1 lançamento com paciente que sobrou sem vínculo ==========
insert into pacientes (nome)
select distinct trim(paciente) from producao
where paciente is not null and trim(paciente) <> '' and paciente_id is null
and not exists (select 1 from pacientes p where lower(p.nome) = lower(trim(producao.paciente)));

update producao p set paciente_id = pa.id
from pacientes pa
where lower(trim(p.paciente)) = lower(trim(pa.nome)) and p.paciente_id is null;

-- ========== 8. Conferência final (só leitura) ==========
select
  (select count(*) from pacientes) as total_pacientes,
  (select count(*) from profissionais) as total_profissionais,
  (select count(*) from producao) as total_atendimentos,
  (select count(*) from producao where paciente_id is not null or paciente is null or trim(paciente)='') as pacientes_ok,
  (select count(*) from producao where profissional_id is not null) as profissionais_ok;
