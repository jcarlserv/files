-- ProdClin — v6.31.0 — Campos extras pra importação de NF (Fornecedor/Materiais)

alter table fornecedores add column if not exists endereco text;
alter table fornecedores add column if not exists cidade text;
alter table fornecedores add column if not exists uf text;
alter table fornecedores add column if not exists cep text;
alter table fornecedores add column if not exists inscricao_estadual text;

alter table materiais add column if not exists codigo_fornecedor text;
alter table materiais add column if not exists nf_origem text;
