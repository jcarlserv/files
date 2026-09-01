-- ProdClin — v6.37.0 — Categorias e Unidades de Material viram listas
-- gerenciáveis (Configurações → Cadastros do Sistema → Listas), a pedido
-- do usuário. Antes eram texto livre no formulário de Material.

alter table listas drop constraint listas_tipo_check;

alter table listas add constraint listas_tipo_check
  check (tipo = ANY (ARRAY[
    'profissionais'::text, 'convenios'::text, 'procedimentos'::text,
    'atendentes'::text, 'turnos'::text, 'formas_pagamento'::text,
    'biopsias_frascos'::text, 'exames'::text, 'andares'::text,
    'especialidades'::text, 'categorias_material'::text, 'unidades_material'::text
  ]));

-- Semeia com valores padrão (edite/apague à vontade depois, é só ponto de
-- partida — sugestão de categorias/unidades comuns em material médico-hospitalar).
-- Usa WHERE NOT EXISTS em vez de ON CONFLICT, pra não depender de saber se
-- a tabela já tem uma constraint única em (tipo, valor).
insert into listas (tipo, valor)
select v.tipo, v.valor from (values
  ('unidades_material', 'unidade'), ('unidades_material', 'caixa'), ('unidades_material', 'pacote'),
  ('unidades_material', 'frasco'), ('unidades_material', 'rolo'), ('unidades_material', 'litro'),
  ('unidades_material', 'mililitro'), ('unidades_material', 'quilograma'), ('unidades_material', 'grama'),
  ('unidades_material', 'par'), ('unidades_material', 'kit'), ('unidades_material', 'ampola'),
  ('unidades_material', 'tubo'), ('unidades_material', 'saco'),
  ('categorias_material', 'Luvas'), ('categorias_material', 'Curativos'),
  ('categorias_material', 'Seringas e Agulhas'), ('categorias_material', 'Medicamentos'),
  ('categorias_material', 'Higiene'), ('categorias_material', 'Limpeza/Desinfecção'),
  ('categorias_material', 'EPI'), ('categorias_material', 'Material Cirúrgico'),
  ('categorias_material', 'Sondas e Cateteres'), ('categorias_material', 'Laboratório/Exames'),
  ('categorias_material', 'Descartáveis Gerais'), ('categorias_material', 'Equipamentos')
) as v(tipo, valor)
where not exists (
  select 1 from listas l where l.tipo = v.tipo and l.valor = v.valor
);
