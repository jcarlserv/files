# ProdClin — Base de Dados Supabase (referência completa)

Levantado direto do banco (consultas ao `information_schema` + `pg_stat_user_tables`, rodadas por você) e cruzado com o código do app (`js/api.js`, que é o único lugar que fala com o Supabase). Atualizado em: v6.28.0.

**Projeto**: `ggasxplnpbpeyzlaiivi.supabase.co` — sem servidor próprio, o front-end (HTML+JS puro) fala direto com o Supabase via REST. RLS em todas as tabelas usa a policy `acesso_total_anon` (sem segurança real por linha — o "login" do ProdClin é cosmético, controla o que a INTERFACE mostra, não o banco).

**Histórico de SQL**: todo `create table`/`alter table` já rodado está documentado, em ordem cronológica, na pasta `sql/` do projeto (arquivos numerados + `README.md`).

---

## 1. Tabelas que o ProdClin usa de verdade (26)

Confirmei isso batendo toda chamada `supabaseClient.from('...')` em `api.js` contra a lista de tabelas do banco. Eram 18 na v6.19.0; 8 tabelas novas entraram desde então (Estoque completo + Vínculo de Convênio).

### `producao` — 15.507 linhas (o coração do sistema)
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid | PK |
| prof | text | nome do profissional, texto livre (não FK) |
| profissional_id | uuid | **novo (v6.19.0)** — FK pra `profissionais.id`, quando resolvido |
| data | date | |
| turno | text | |
| paciente | text | nome do paciente, texto livre (não FK) |
| paciente_id | uuid | **novo (v6.19.0)** — FK pra `pacientes.id`, quando resolvido |
| protocolo | text | opcional |
| procedimento | text | o "Atendimento" na interface |
| exames | text | opcional |
| biopsias | text | opcional |
| convenio | text | |
| carteirinha | text | opcional |
| valor | numeric | |
| forma_pagamento | text | forma única (compatibilidade) |
| formas_pagamento | jsonb | array de {forma, valor} quando o pagamento é dividido em mais de uma forma |
| atendente | text | |
| andar | text | |
| verificado_financeiro | boolean | usado na Crítica/Verificar |
| timestamp | timestamptz | data de criação do registro (não confundir com `data`, que é a data do atendimento) |

⚠️ `prof`/`paciente` continuam como texto solto, mesmo depois da v6.19.0 — as colunas `_id` foram ADICIONADAS, não substituem as de texto. 15.507/15.507 linhas têm os dois vínculos preenchidos (migração 100% concluída).

### `pacientes` — 4.986+ linhas (v6.19.0, colunas extras adicionadas depois)
id uuid PK · nome text · whatsapp text · endereco text · **convenio text** (v6.22.0) · **carteirinha text** (v6.22.0) · **data_nascimento date** (v6.24.0) · **cpf text** (v6.25.1) · criado_em timestamptz

### `profissionais` — 31+ linhas (novo, v6.19.0)
id uuid PK · nome text · telefone text · registro_profissional text · especialidade text · observacoes text · criado_em timestamptz

*(`observacoes` guarda anotações tipo "mesma pessoa que X, usado pra Y" — usado nos 2 casos que você apontou na migração: "DR MAURICIO EXAMES" e "DRA AMANDA USG". `especialidade` agora é preenchida a partir de uma lista gerenciável — ver `listas`, tipo `especialidades`, abaixo.)*

### `fornecedores` — novo (v6.20.0)
id uuid PK · nome text · cnpj text · contato text · criado_em timestamptz

### `materiais` — novo (v6.20.0) — catálogo do Estoque
id uuid PK · nome text · categoria text · unidade text (padrão 'unidade') · estoque_minimo numeric · ativo boolean · criado_em timestamptz

### `estoque_lotes` — novo (v6.20.0) — um registro por entrada de Nota Fiscal
id uuid PK · material_id uuid (FK → materiais) · fornecedor_id uuid (FK → fornecedores) · lote text · nota_fiscal text · data_entrada date · validade date · quantidade_entrada numeric · quantidade_atual numeric · valor_unitario numeric · criado_em timestamptz

### `solicitacoes_material` — novo (v6.20.0) — pedido de material por profissional
id uuid PK · material_id uuid (FK → materiais) · profissional_id uuid (FK → profissionais) · procedimento text · exame text · quantidade numeric · status text ('pendente'/'dispensado'/'negado') · observacao text · solicitado_por text · solicitado_em timestamptz

### `dispensacoes` — novo (v6.20.0) — baixa de estoque de fato, FEFO
id uuid PK · solicitacao_id uuid (FK → solicitacoes_material) · lote_id uuid (FK → estoque_lotes) · quantidade numeric · dispensado_por text · dispensado_em timestamptz

### `paciente_convenio_vinculo` — novo (v6.23.0) — vínculo manual paciente × beneficiário Unimed
id uuid PK · cartao_beneficiario text (UNIQUE) · nome_beneficiario text · paciente_id uuid (FK → pacientes) · status text ('vinculado'/'pulado') · criado_em timestamptz

### `profissionais_andares` / `profissionais_procedimentos` / `profissionais_exames`
Cada uma: id uuid · prof text · (andar | procedimento | exame) text — matriz de vínculo (quem pode atender onde/o quê), usada pra travar os campos no Lançamento.

### `atendentes_profissionais`
id uuid · atendente text · prof text — matriz de vínculo atendente↔profissional.

### `listas`
id uuid · tipo text · valor text · ordem int — uma linha por item de cada lista do sistema (Andares, Convênios, Atendimentos, Atendentes, Turnos, Formas de pagamento, Biópsia, Exames, Profissionais, **Especialidades** — esse último novo, v6.22.0). ⚠️ Tem uma **check constraint** (`listas_tipo_check`) travando quais valores de `tipo` são aceitos — precisou ser alterada manualmente pra liberar "especialidades" (ver `sql/06_listas_especialidades.sql`). Se algum tipo novo for criado no futuro, essa constraint precisa ser atualizada de novo, senão o insert falha com erro de violação.

### `configuracoes`
chave text (PK) · valor text — par chave/valor genérico. Guarda: `nome_clinica`, `logo_clinica`, `cor_primaria`, `grafico_cor_primaria`, `grafico_tamanho_texto`, `campos_travados_atendente`, `campos_travados_profissional` (esses 2 últimos como JSON string).

### `usuarios`
id uuid · usuario text · senha text (texto puro — sem hash) · papel text (gerente/atendente/profissional) · nome_profissional text

### `permissoes`
id bigint · usuario text · chave text · valor boolean — sobrescritas individuais de permissão (por cima do padrão do papel).

### `metas`
id uuid · prof text · mes int · ano int · **valor_minimo_turno** numeric · **turnos_utilizados** numeric · ~~turnos_disponibilizados~~ · ~~meta_valor~~ · ~~meta_qtd~~ — as 3 últimas são colunas antigas, sem uso desde a v6.14.0 (ficaram no banco, mas nada lê/escreve nelas mais).

### `notas`
id uuid · mes int · ano int · texto text — anotação livre por mês (usada em Metas).

### `coparticipados`
id bigint · prof text · mes text · ano int · taxa numeric · rateio_clinica numeric · rateio_coparticipado numeric · criado_em · atualizado_em — Repasse de Coparticipados (aba Verificar).

### `plano_contas`
id uuid · codigo text · nome text · conta_pai_codigo text · natureza text (entrada/saida) · ordem int · criado_em

### `plano_contas_valores`
conta_codigo text · mes int · ano int · valor numeric — um valor por conta/mês/ano.

### `fluxo_caixa`
id uuid · data date · descricao text · valor numeric · tipo text (entrada/saida) · banco text · conta_plano_codigo text · criado_em

### `financeiro_dre`
⚠️ **Obsoleta desde a v6.6.0** — substituída pelo Plano de Contas. `api.js` ainda tem as rotas (por segurança), mas nenhuma tela chama mais.

---

## 2. Tabelas de Faturamento — importadas de fora, não construídas pelo ProdClin

Essas 4 têm dado de verdade (6.005 + 7.058 linhas) mas **nenhuma rota em `api.js` as usa ainda** — são a base pra Fase 2 (conciliação com os demonstrativos da Unimed):

- **`faturamento_notas`** (6.005 linhas) — uma linha por nota/atendimento faturado: `competencia`, `prestador_codigo/nome`, `lote`, `nota`, `data_atendimento`, `hora_atendimento`, `cartao_beneficiario`, `nome_beneficiario`, `plano`, `acomodacao`, `secao`, `total_nota`, `status_pagamento`.
- **`faturamento_servicos`** (7.058 linhas) — itens de cada nota (FK `nota_id → faturamento_notas.id`): `tipo`, `codigo`, `qt_cobrada`, `qt_paga`, `valor`, `subtotal`, `valor_dimensao_global/individual`.
- **`faturamento_glosas`** — negativas/glosas por nota (FK `nota_id → faturamento_notas.id`): `cartao_beneficiario`, `nome_beneficiario`, `data_glosa`, `mensagem_glosa`.
- **`faturamento_resumo_competencia`** (59 linhas) — extrato resumido por competência: `descricao_lancamento`, `quantidade`, `valor`, `tipo_lancamento`, `saldo_liquido`.

**Únicas 2 foreign keys que existem no banco inteiro hoje** (fora as que a v6.19.0 acabou de criar): `faturamento_servicos.nota_id → faturamento_notas.id` e `faturamento_glosas.nota_id → faturamento_notas.id`.

---

## 3. Tabelas com "cheiro" de resíduo — existem, mas parecem abandonadas

Todas com **0 linhas** e sem nenhuma rota em `api.js` apontando pra elas. Registro pra não confundir no futuro — não mexer sem confirmar com você antes:

| Tabela | Estrutura | Hipótese |
|---|---|---|
| `vinculos_profissionais` | tipo, prof, chave_vinculada | Parece uma tentativa de unificar `profissionais_andares`+`procedimentos`+`exames` numa tabela genérica só — nunca adotada. |
| `listas_sistema` | chave, itens (jsonb) | Parece um redesenho de `listas` (uma linha por LISTA inteira, não por item) — nunca adotado. |
| `configuracoes_clinica` | id, nome_clinica, logo_url, cor_principal, grafico_tamanho_texto, grafico_cor_principal | Quase idêntica ao que já é feito via `configuracoes` (chave/valor) — parece uma tentativa alternativa de guardar a mesma coisa, nunca usada pelo app. |
| `configuracao_repasse` | mes, ano, taxa_pct, rateio_clinica_pct, rateio_coparticipado_pct | Muito parecida com `coparticipados` (que é a usada de verdade) — sem a coluna `prof`. |
| `particular_coparticipado` | dados (jsonb) | Sem pista do que seria. |
| `andar1_convenio`, `andar1_eficiencia` | id, dados (jsonb) | Confirmado: design bem genérico ("id + blob jsonb"), sem coluna nenhuma além disso — reforça que foram experimentos pontuais, nunca terminados. |
| `bioimpedancias`, `exames_mauricio` | id, dados (jsonb) | Mesmo design genérico acima — experimentos pontuais. |
| `producao_terreo` | id, dados (jsonb) | Confirmado: NÃO é um recorte estruturado de `producao` (que tem 18 colunas próprias) — é só um blob jsonb solto. Reforça que é resíduo, já que `producao` já cobre Térreo via a coluna `andar`. |
| `painel_semanal_consultas`, `usg_anual`, `polipectomias` | id, dados (jsonb) | Mesmo design genérico — resíduo. |
| `notas_periodo` | id, mes (**text**), ano int, texto | Muito parecida com a `notas` que é usada de verdade (mes/ano/texto) — só que lá `mes` é **integer**, aqui é **text**. Parece uma versão anterior de `notas`, substituída antes de ser adotada. |
| `analises_ia` | id, mes, ano, resumo, alertas (jsonb), recomendacoes (jsonb), gerado_em | Estrutura pronta pra guardar resultado de alguma análise automática — não vi nada no código do ProdClin gerando ou lendo isso. |

---

## 4. Schemas do sistema (não são do ProdClin)

`auth.*`, `storage.*`, `realtime.*`, `vault.*` — infraestrutura própria do Supabase (autenticação nativa, storage de arquivos, realtime, cofre de segredos). O ProdClin não usa login nativo do Supabase (usa a tabela `usuarios` própria) nem storage nativo (logo é salva como base64 direto em `configuracoes`) — então esses schemas ficam vazios/não utilizados do ponto de vista do app.

---

## 5. O que ainda não sei

- As 10 tabelas que estavam sem coluna conhecida (seção 3) já foram todas confirmadas — nada pendente ali.
- Não confirmei ainda, com uma consulta própria, se `producao.paciente_id`/`profissional_id` e as FKs das tabelas de Estoque/Vínculo (`materiais`, `fornecedores`, `estoque_lotes`, `solicitacoes_material`, `dispensacoes`, `paciente_convenio_vinculo`) estão de fato registradas como foreign key de verdade no banco (rodei o `create table`/`alter table` que gera isso, mas nunca rodamos a consulta de `pg_constraint` de novo depois pra confirmar visualmente) — se quiser ter certeza, é só pedir que eu gero a consulta.
- Não tenho a estrutura de `configuracao_repasse`/`configuracoes_clinica` além do que já está na seção 3 (colunas já conhecidas, só não aprofundei mais que isso por não terem uso).
