-- ProdClin — v6.25.1 — Cadastro de Paciente ganha CPF

alter table pacientes add column if not exists cpf text;
