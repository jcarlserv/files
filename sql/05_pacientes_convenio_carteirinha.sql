-- ProdClin — v6.22.0 — Cadastro de Paciente ganha Convênio e Carteirinha

alter table pacientes add column if not exists convenio text;
alter table pacientes add column if not exists carteirinha text;
