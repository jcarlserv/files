# SQL do ProdClin — histórico

Todo SQL já rodado no Supabase desta clínica, organizado por versão/funcionalidade,
em ordem cronológica. **Todos os arquivos já foram executados** — isso aqui é
documentação/histórico, não uma lista de pendências.

Todos os comandos usam `if not exists` (ou equivalente) e são seguros de rodar
de novo sem duplicar nada, exceto o `06_listas_especialidades.sql`, que faz um
`drop constraint` — não rode de novo sem necessidade.

| Arquivo | Versão | O que faz |
|---|---|---|
| `01_metas.sql` | v6.14.0/6.14.1 | Metas reformulada (Turnos Utilizados × Vr Mínimo) — *de sessão anterior à compactação, incluído por completude* |
| `02_pacientes_profissionais.sql` | v6.19.0 | Cria Pacientes/Profissionais, liga a `producao`, migra os 15.507 lançamentos existentes |
| `03_estoque.sql` | v6.20.0 | Módulo de Estoque completo (Fornecedores, Materiais, Lotes, Solicitações, Dispensações) |
| `04_vincular_convenio.sql` | v6.23.0 | Tabela de vínculo Paciente × Convênio (Unimed) |
| `05_pacientes_convenio_carteirinha.sql` | v6.22.0 | Paciente ganha Convênio e Carteirinha |
| `06_listas_especialidades.sql` | — | Libera "especialidades" como tipo válido em `listas` |
| `07_pacientes_data_nascimento.sql` | v6.24.0 | Paciente ganha Data de Nascimento |
| `08_pacientes_cpf.sql` | v6.25.1 | Paciente ganha CPF |
| `09_confirmacao_recebimento.sql` | v6.29.0 | Dispensação em 2 etapas: reserva → confirmação (baixa só na confirmação) |
| `10_fornecedores_materiais_campos_nf.sql` | v6.31.0 | Campos extras pra importação de NF (endereço/IE do fornecedor, código/NF do material) |
| `11_materiais_valor_codigo_barras.sql` | v6.34.0 | Valor de referência e código de barras no Material |
| `12_listas_categorias_unidades_material.sql` | v6.37.0 | Categorias e Unidades de Material viram listas gerenciáveis (com valores padrão semeados) |

## BASE_DE_DADOS.md

Além do histórico de SQL, essa pasta tem um resumo completo de **toda** a base — as
26 tabelas que o ProdClin usa de verdade (estrutura de cada uma), as 4 de
Faturamento (Unimed, ainda sem tela própria), e as ~10 que parecem resíduo de
versões antigas (documentadas pra não confundir no futuro). Serve tanto de
referência rápida quanto de contexto pronto pra colar em outra IA, caso precise
continuar esse projeto em outro lugar.

**Atualize esse arquivo sempre que uma tabela nova for criada ou uma coluna for
adicionada** — é o jeito mais rápido de dar contexto completo do banco pra
qualquer IA (ou pra você mesmo, daqui a uns meses).
