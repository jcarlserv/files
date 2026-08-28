-- ProdClin — v6.23.0 — Vínculo Paciente × Convênio (Unimed)
-- Tabela de vínculo separada — nada é sobrescrito no cadastro de
-- pacientes por automação em massa. Cada linha aqui é uma decisão manual
-- (confirmada ou pulada) tomada na tela "Vincular Convênio (Unimed)".

create table if not exists paciente_convenio_vinculo (
  id uuid primary key default gen_random_uuid(),
  cartao_beneficiario text not null unique,
  nome_beneficiario text,
  paciente_id uuid references pacientes(id),
  status text not null default 'vinculado' check (status in ('vinculado','pulado')),
  criado_em timestamptz not null default now()
);
alter table paciente_convenio_vinculo enable row level security;
create policy acesso_total_anon on paciente_convenio_vinculo for all using (true) with check (true);
