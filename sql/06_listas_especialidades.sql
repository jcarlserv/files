-- ProdClin — correção pontual — libera "especialidades" como tipo válido
-- na tabela listas (a check constraint só permitia os 9 tipos originais,
-- travando o cadastro de especialidades de profissionais — Psicólogo,
-- Nutricionista, etc.)
--
-- ATENÇÃO: este bloco assume que a constraint já existe com exatamente o
-- nome/definição abaixo (era o caso no banco desta clínica no momento em
-- que isso foi corrigido). Se der erro de "constraint does not exist",
-- confira o nome atual antes de rodar:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conname = 'listas_tipo_check';

alter table listas drop constraint listas_tipo_check;

alter table listas add constraint listas_tipo_check
  check (tipo = ANY (ARRAY[
    'profissionais'::text, 'convenios'::text, 'procedimentos'::text,
    'atendentes'::text, 'turnos'::text, 'formas_pagamento'::text,
    'biopsias_frascos'::text, 'exames'::text, 'andares'::text,
    'especialidades'::text
  ]));
