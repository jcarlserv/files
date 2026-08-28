-- ProdClin — v6.14.0 / v6.14.1 — Metas reformulada (Turnos Utilizados × Vr Mínimo)
-- ATENÇÃO: este SQL veio do registro de handoff de uma sessão anterior à
-- compactação desta conversa — não foi gerado nesta sessão, mas está
-- documentado aqui pra manter o histórico completo. Se você já rodou isso
-- antes (bem provável, já que o sistema já usa esses campos há várias
-- versões), pode ignorar — é seguro rodar de novo (idempotente).

alter table metas add column if not exists valor_minimo_turno numeric default 0;
alter table metas add column if not exists turnos_utilizados numeric default 0;
