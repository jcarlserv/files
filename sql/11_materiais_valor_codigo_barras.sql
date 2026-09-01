-- ProdClin — v6.34.0 — Valor de referência e código de barras no Material

alter table materiais add column if not exists valor_referencia numeric;
alter table materiais add column if not exists codigo_barras text;
