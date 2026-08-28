-- ProdClin — v6.29.0 — Confirmação de recebimento (baixa só após confirmar)
-- Dispensação passa a ser 2 etapas: farmácia aprova (reserva, sem baixar
-- estoque) → solicitante confirma recebimento (só aí baixa de verdade).

alter table solicitacoes_material drop constraint if exists solicitacoes_material_status_check;
alter table solicitacoes_material add constraint solicitacoes_material_status_check
  check (status in ('pendente','dispensado','confirmado','negado'));
alter table solicitacoes_material add column if not exists confirmado_por text;
alter table solicitacoes_material add column if not exists confirmado_em timestamptz;
alter table solicitacoes_material add column if not exists observacao_recebimento text;

alter table dispensacoes drop constraint if exists dispensacoes_status_check;
alter table dispensacoes add column if not exists status text not null default 'confirmado'
  check (status in ('reservado','confirmado'));
