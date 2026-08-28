-- ProdClin — v6.24.0 — Cadastro de Paciente ganha Data de Nascimento

alter table pacientes add column if not exists data_nascimento date;
