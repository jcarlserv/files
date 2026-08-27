/* =====================================================================
   ProdClin — config.js
   Configuração do Supabase (URL + chave pública) e o cabeçalho de versão/changelog do sistema.
   IMPORTANTE: a chave abaixo é a 'publishable/anon key' do Supabase — ela É pública por
   natureza (roda no navegador de qualquer usuário) e não pode ser 'escondida' só por estar
   num arquivo separado. A segurança real do sistema depende das políticas de RLS no banco
   e (idealmente, no futuro) de autenticação de verdade via Supabase Auth.
   Este arquivo é carregado via <script src> em index.html, na mesma ordem
   em que aparecia originalmente dentro do <script> único — variáveis e
   funções continuam compartilhando o escopo global, exatamente como antes.
===================================================================== */

/* =====================================================================
   CONFIGURAÇÃO — Supabase
   Preencha SUPABASE_URL e SUPABASE_ANON_KEY com os valores do seu
   projeto (Project Settings > API Keys, no painel do Supabase — use a
   "Publishable key", nunca a "Secret key"). Enquanto SUPABASE_URL
   estiver vazio, o sistema roda em MODO DEMONSTRAÇÃO com dados de
   exemplo guardados só nesta sessão.
===================================================================== */
/* =====================================================================
   CONTROLE DE VERSÃO — atualizar o número abaixo (e a <span id="versao-
   sistema"> no rodapé) a cada alteração entregue neste arquivo, para que
   o rodapé do sistema sempre reflita a versão realmente publicada.

   v2.5.0 — Aba Verificar: novo card "Repasse de coparticipados" (taxa de
            18% + rateio 40% clínica / 60% coparticipado), calculado sobre
            os lançamentos filtrados e salvo por mês na tabela
            `coparticipados` do Supabase.
   v2.6.0 — Aba Verificar: reorganizada em 4 cards separados, na ordem
            Filtros → Repasse de coparticipados → Resumo financeiro →
            Tabela de lançamentos (antes tudo ficava junto num só card,
            com o Repasse isolado no fim da aba).
   v2.7.0 — Lançamento/Verificar: forma de pagamento agora pode ser
            dividida em mais de uma forma no mesmo lançamento (ex.: parte
            em dinheiro, parte no cartão), sem duplicar o procedimento. O
            "Valor (R$)" passou a ser calculado automaticamente como a
            soma das partes. Requer a coluna nova `formas_pagamento`
            (jsonb) na tabela `producao` do Supabase — ver instrução no
            final da resposta que introduziu esta versão.
   v2.8.0 — Tela Lançamento: campo "Atendente" vem travado com o nome do
            próprio usuário quando o papel logado é atendente (só nessa
            tela; no modal de edição continua livre).
   v2.9.0 — Coluna "Exame" adicionada em 3 tabelas nominais que ainda não
            mostravam esse dado: "Lançamentos" (aba Verificar), "Meus
            últimos lançamentos" (aba Lançamento) e "Atendimentos por
            convênio" (aba RMR) — nessa última, a busca por texto também
            passou a considerar o exame.
   v2.10.0 — Aba Verificar: novo filtro "Exame" (select), junto dos
             filtros de Profissional/Andar/Convênio/Forma de pagamento —
             também resetado pelo botão "Limpar período".
   v2.11.0 — Aba RMR: card "Atendimentos por convênio" movido para o
             final da aba (depois de "Sugestões de melhoria").
   v2.12.0 — Correção: nas 3 tabelas que mostram "% atingido" da meta
             (Dashboard "Meta × realizado", RMR "Todos os profissionais"
             e RMR "Eficiência de turnos"), quando o profissional NÃO tem
             meta cadastrada a coluna agora fica em branco (—), sem barra
             e sem %. Antes o Dashboard mostrava 100% indevidamente (bug
             reportado) e o RMR mostrava 0% — ambos enganosos, já que sem
             meta não existe "percentual atingido" de verdade.
   v2.13.0 — Correção de dados incompletos: Dashboard, Análises e Crítica
             passaram a buscar direto o intervalo de datas do mês
             selecionado (gte/lte na própria query), em vez de buscar o
             ano inteiro e filtrar o mês no navegador — essa segunda
             forma corria risco de corte silencioso do Supabase quando o
             total de linhas do ano passava do limite de retorno de uma
             consulta só, fazendo essas telas mostrarem menos lançamentos
             do que existem de verdade. RMR e "Evolução do ano" (que
             realmente precisam do ano inteiro) passaram a buscar em
             páginas de 1000 linhas (buscarProducaoCompleta) até trazer
             tudo, em vez de uma chamada só.
   v2.14.0 — Correção adicional: filtrar por data (v2.13.0) reduz o
             volume mas não garante ficar abaixo do limite de linhas de
             uma consulta do Supabase se o período tiver muitos
             lançamentos. Agora TODAS as buscas de produção sem limite
             fixo (Dashboard, Verificar, Crítica, Análises — além de RMR
             e Evolução do ano, já corrigidas antes) usam
             buscarProducaoCompleta (paginação em blocos de 1000), então
             nenhuma tela mais sofre corte silencioso, independente do
             volume de dados.
   v2.15.0 — Dashboard, Squad Atendimento: "Atendimentos por profissional"
             passou a ocupar a largura toda do card; "Distribuição por
             convênio" e "Distribuição por andar" ficam lado a lado,
             abaixo dele.
   v3.0.0 — Fusão das abas Dashboard e Análises Cruzadas numa única aba
            "Análises": filtros de Mês/Ano/Andar unificados (não mais
            duplicados), conteúdo do Dashboard (KPIs, gráficos fixos,
            Meta × realizado, Evolução do ano) mantido tal como estava,
            seguido de uma seção "Análise flexível" com os cards por
            dimensão e correlação que já existiam na Análises. A
            permissão `ver_dashboard` foi abandonada — a aba passa a
            depender só de `ver_analises`. Linhas antigas com
            chave='ver_dashboard' na tabela `permissoes` do Supabase
            ficam inofensivas (só não são mais lidas pelo sistema).
   v3.0.1 — Card "Quantidade e valor por dimensão" (aba Análises): o
            gráfico ficava ao lado da tabela, agora fica embaixo dela.
   v3.0.2 — Tela Lançamento: campo "Data" vem travado no dia de hoje
            quando o papel logado é atendente (não pode escolher outra
            data ao criar um lançamento).
   v4.0.0 — Fusão das abas Análises e RMR numa única aba "RMR": filtros de
            Mês/Ano/Andar unificados (usa só rmr-mes/rmr-ano/rmr-andar).
            A única sobreposição real (tabela "Meta × realizado por
            profissional", que existia de dois jeitos quase idênticos)
            virou uma tabela só, com um gráfico de barras novo logo
            abaixo. As duas seções de evolução mensal (uma baseada em
            meta, outra no ano anterior) foram agrupadas num só bloco
            "Evolução do ano" com os 4 gráficos. Gráficos novos também
            foram adicionados abaixo das tabelas de Exames, Procedimentos,
            Biópsias e Eficiência de turnos, pra melhor visualização. A
            permissão `ver_analises` foi abandonada — a aba passa a
            depender só de `ver_rmr` (o inverso da fusão anterior, que
            tinha abandonado `ver_dashboard` em favor de `ver_analises`).
            Ganho técnico: a aba inteira agora usa UMA busca só
            (buscarProducaoCompleta do ano, já paginada) para calcular
            tudo — KPIs, gráficos, tabelas e análise flexível — em vez de
            buscas separadas que já causaram divergência de dados entre
            telas no passado (bug da Daniele Erthal, v2.13.0-v2.14.0).
            Linhas antigas com chave='ver_analises' na tabela
            `permissoes` do Supabase ficam inofensivas (só não são mais
            lidas pelo sistema).
   v5.0.0 — A aba que se chamava "RMR" (fusão da v4.0.0) foi renomeada
            para "Análises" (conteúdo interno não mudou, só o rótulo e o
            título). Uma aba NOVA chamada "RMR" foi criada do zero, com
            estrutura hierárquica "Squad Atendimento" → andar (dinâmico)
            → médico (dinâmico): cada médico tem uma tabela mensal "Dados
            de atendimento" (Prd. úteis = turnos_disponibilizados da aba
            Metas; Meta per. = meta acumulada do ano até o mês), contagem
            do mês + tabela mensal de Consultas/Exames/Procedimentos/
            Cirurgias/Biópsias (categorizado a partir do campo
            "procedimento" + "exames" + "biopsias"), e um gráfico
            comparativo anual. Cada andar também tem uma "Visão geral"
            agregada (todos os médicos somados) com essas mesmas
            categorias, mais Convênio e Forma de pagamento (quantidade +
            valor). Nova permissão `ver_rmr_squad` controla essa aba
            nova — `ver_rmr` continua controlando a aba "Análises"
            renomeada, sem precisar de migração no Supabase desta vez.
   v5.0.1 — Correção: a aba RMR nova não aparecia (id da navegação
            'rmrSquad' não batia com o id do painel HTML
            'painel-rmr-squad' — o sistema monta esse id automaticamente
            como "painel-" + id da aba, então precisam ser idênticos).
            Corrigido para 'rmr-squad' nos dois lugares.
   v5.1.0 — Aba RMR: novos filtros "Andar" e "Profissional", ao lado de
            Mês/Ano. Os dois filtram só na hora de montar a tela (sem
            buscar os dados de novo — o ano inteiro já está em cache).
            Selecionar um profissional específico esconde a "Visão geral"
            daquele andar (que só faz sentido somando todo mundo) e
            mostra só o bloco daquele médico.
   v5.2.0 — Aba RMR: nada é mostrado até escolher um andar no filtro (era
            isso que deixava a tela gigante — Térreo e Coparticipados
            empilhados de uma vez). O filtro "Profissional" agora só
            lista quem realmente atua no andar escolhido (antes listava
            todo mundo da clínica) e fica desabilitado, com a dica
            "Escolha um andar primeiro", enquanto nenhum andar for
            selecionado.
   v6.0.0 — Nova funcionalidade: cadastro de "Profissionais por andar" e
            "Profissionais por procedimento" (aba Configurações, só
            gerente). Um profissional pode ter mais de um andar/
            procedimento marcado. Isso trava os campos "Andar" e
            "Procedimento" na tela de Lançamento E no modal de edição
            (Verificar/Crítica): ao escolher o Profissional, os dois
            campos passam a mostrar só as opções cadastradas pra ele — e
            ficam vazios (bloqueando o salvamento, via validação de campo
            obrigatório já existente) se o profissional ainda não tiver
            nada cadastrado. Um valor já salvo que não bata mais com o
            cadastro atual (edição de lançamento antigo) é mantido como
            opção extra, marcado "(fora do cadastro)", pra não sumir dado
            histórico. Requer duas tabelas novas no Supabase —
            `profissionais_andares` e `profissionais_procedimentos` — ver
            SQL na resposta que introduziu esta versão (ou direto na
            própria tela: se a tabela não existir, o card mostra o
            comando SQL certinho, igual já acontecia com Direitos e
            Privilégios).
   v6.1.0 — Tela Lançamento: ordem dos campos mudou, "Andar" agora vem
            antes de "Profissional" (resto da ordem inalterado). Aba
            Verificar: dois filtros novos, "Procedimento" (select) e
            "Paciente" (busca por texto, ao digitar) — ao lado dos que já
            existiam.
   v6.2.0 — Reversão parcial da v6.1.0: "Profissional" voltou a vir antes
            de "Andar" no Lançamento — necessário porque agora o
            Profissional também pode depender do Atendente (ver abaixo),
            então a ordem de dependência é Atendente → Profissional →
            Andar/Procedimento, não o contrário.
            Nova funcionalidade: cadastro "Atendentes por profissional"
            (aba Configurações, só gerente) — mesma mecânica das matrizes
            de Andar/Procedimento, mas essa trava funciona em DUAS
            direções conforme o contexto: (1) quando é a própria atendente
            logada lançando no Lançamento (Atendente já travado no nome
            dela), o campo Profissional passa a mostrar só quem está
            vinculado a ela, bloqueando o lançamento se não houver
            nenhum; (2) quando é o gerente lançando, ou em qualquer edição
            pelo Modal (onde o Atendente nunca é travado), é o contrário —
            escolher o Profissional filtra o Atendente. Requer uma tabela
            nova no Supabase, `atendentes_profissionais` — a própria tela
            mostra o SQL certinho se ela não existir ainda.
   v6.3.0 — Nova funcionalidade: cadastro "Profissionais por exame" (aba
            Configurações, só gerente) — mesma mecânica de Andar/
            Procedimento: marca quais exames cada profissional pode
            realizar, travando/filtrando o campo "Exame" no Lançamento e
            no modal de edição. Diferente de Andar/Procedimento, o campo
            Exame não é obrigatório, então não bloqueia o lançamento se
            ficar vazio. Requer uma tabela nova no Supabase,
            `profissionais_exames` — a própria tela mostra o SQL certinho
            se ela não existir ainda.
   v6.4.0 — Configurações: novo cartão "Logo e cores" (entre "Identidade da
            clínica" e "Listas do sistema") — envio da logo da clínica
            (guardada em base64 na tabela `configuracoes`, chave
            'logo_clinica'), que passa a aparecer no lugar do selo "C" no
            topo e na tela de login pra todos os usuários. Ao enviar,
            sugere uma cor principal com base nas cores da imagem
            (processamento local via canvas, sem IA nenhuma) — o usuário
            confirma em "Aplicar essa cor" e ela é salva em
            'cor_primaria', reaplicada em toda visita via CSS custom
            properties (só a família --plum-*; a cor --teal-* de sucesso
            não é alterada).
            Aba Análises: dois botões novos, "Exportar dados (mês)" e
            "Exportar dados (ano)" — geram um relatório à parte (nova
            aba, via print), com TODOS os profissionais e andares (ignora
            o filtro "Andar" da tela, usa só o Mês/Ano já selecionados),
            só com tabelas agregadas (financeiro, ranking por
            profissional, procedimentos, exames, biópsias, eficiência de
            turnos, e evolução mensal no modo "ano") — sem nenhum texto
            de análise redigido e sem dado nominal de paciente. Pensado
            pra alimentar uma IA externa que monta a apresentação mensal
            de resultados.
   v6.5.0 — Nova aba "Apresentação" (permissão `ver_apresentacao`): monta
            sozinha, a partir do banco, uma reunião mensal de resultados
            navegável em slides (setas/teclado, tela cheia via Fullscreen
            API, exportação em PDF via print) — sem precisar exportar nem
            enviar nada manualmente. Cobre Resumo Executivo, Evolução do
            ano, Composição da receita por Andar, seções separadas de
            SETOR TÉRREO e 1º ANDAR — COPARTICIPADOS (particular×convênio,
            previsto×realizado, volume operacional, ticket médio,
            faturamento comparativo, top 10 profissionais, ocupação de
            turnos, USG histórico) e Acompanhamento Financeiro (DRE e
            estrutura de custos). "Previsto" por andar é a soma das metas
            dos profissionais cadastrados como exclusivos daquele andar
            (Configurações → Profissionais por andar) — o ProdClin não
            guarda meta por categoria de procedimento, só por profissional.
            Aba Metas: novo cartão "Financeiro (DRE)" — 8 campos digitados
            manualmente 1x por mês (dado contábil, não vem da produção),
            com margem de contribuição e resultado calculados na hora.
            Alimenta a aba Apresentação; sem isso preenchido, as duas
            telas financeiras da apresentação ficam em branco, com aviso.
            Requer uma tabela nova no Supabase, `financeiro_dre` — SQL:
            create table if not exists financeiro_dre (
              id uuid primary key default gen_random_uuid(),
              mes integer not null, ano integer not null,
              faturamento_bruto numeric not null default 0,
              deducoes_impostos numeric not null default 0,
              custo_servico_prestado numeric not null default 0,
              despesas_pessoal numeric not null default 0,
              despesas_compras_manutencao numeric not null default 0,
              despesas_operacionais numeric not null default 0,
              despesas_financeiras numeric not null default 0,
              prolabore numeric not null default 0,
              atualizado_em timestamptz not null default now(),
              unique(mes, ano)
            );
            alter table financeiro_dre enable row level security;
            create policy acesso_total_anon on financeiro_dre for all
              using (true) with check (true);
   v6.5.1 — Correção: as travas condicionadas do Lançamento/Modal (Atendente
            →Profissional, Profissional→Andar/Procedimento/Exame/Atendente)
            comparavam os nomes com igualdade exata — um espaço a mais ou
            uma letra maiúscula/minúscula digitada diferente entre o
            cadastro do usuário, a lista em Configurações e a matriz de
            vínculos já fazia a lista aparecer vazia, mesmo com o vínculo
            certinho salvo no banco. As 5 buscas agora toleram diferença de
            maiúscula/minúscula e espaços nas pontas (`buscarListaTolerante`
            em api.js).
   v6.5.2 — Configurações: os cartões "Identidade da clínica" e "Logo e
            cores" mudaram de posição — antes vinham logo no topo da aba,
            agora ficam depois de "Atendentes por profissional" e antes de
            "Importar produção em massa (CSV)". Só reorganização visual,
            nenhum campo ou comportamento mudou.
   v6.6.0 — Nova aba "Financeiro" (permissões `ver_financeiro`/
            `editar_financeiro`): plano de contas hierárquico (código
            estilo Fortes Contábil, ex. 3.1.1.01) com valor por conta-folha
            por mês — substitui o formulário simples de DRE que tinha ido
            pra aba Metas na v6.5.0 (removido). Só conta sem subconta
            aceita valor; contas com filho somam automaticamente (por
            "natureza": entrada soma, saída subtrai — assim uma dedução
            dentro de Receitas ainda subtrai certo, não importa a
            profundidade). Botão "+ subconta" em cada linha da árvore cria
            conta nova ali dentro com código gerado sozinho (1 dígito nos
            3 primeiros níveis, 2 dígitos no 4º, 4 dígitos no 5º, 2 dígitos
            daí em diante). "Baixar planilha-modelo" e "Importar planilha"
            (CSV, colunas codigo;nome;mes;ano;valor) — importar só
            atualiza valor de conta que já existe, não cria conta nova
            (evita conta fantasma por erro de digitação; pra isso, usa o
            "+ subconta" na tela mesmo). Configurações ganhou o cartão
            "Plano de contas da DRE" — mesma árvore, sem os valores, pra
            criar contas-mãe (categorias grandes) — chamado gerente only,
            reaproveitando as mesmas funções da aba Financeiro
            (js/financeiro.js, carregado antes de configuracoes.js na
            ordem dos <script>). Populado com a estrutura do plano de
            contas real da clínica (Receitas/Custo do Serviço/Despesas);
            modo demonstração já vem com Junho/2026 preenchido e bate
            exatamente com o DRE real conferido antes (Resultado:
            -R$ 28.607,14).
            Requer duas tabelas novas no Supabase — SQL:
            create table if not exists plano_contas (
              id uuid primary key default gen_random_uuid(),
              codigo text not null unique,
              nome text not null,
              conta_pai_codigo text,
              natureza text not null default 'saida' check (natureza in ('entrada','saida')),
              ordem integer not null default 0,
              criado_em timestamptz not null default now()
            );
            alter table plano_contas enable row level security;
            create policy acesso_total_anon on plano_contas for all
              using (true) with check (true);
            create table if not exists plano_contas_valores (
              id uuid primary key default gen_random_uuid(),
              conta_codigo text not null,
              mes integer not null, ano integer not null,
              valor numeric not null default 0,
              atualizado_em timestamptz not null default now(),
              unique(conta_codigo, mes, ano)
            );
            alter table plano_contas_valores enable row level security;
            create policy acesso_total_anon on plano_contas_valores for all
              using (true) with check (true);
            A tabela `financeiro_dre` da v6.5.0 fica sem uso por ora — as
            rotas obterFinanceiroDre/salvarFinanceiroDre continuam em
            api.js só pra não quebrar a aba Apresentação enquanto ela não
            for atualizada pra ler do plano de contas (isso fica pra uma
            próxima entrega, junto com o botão de Apresentação dentro de
            Análises, a aba Início e o Squad Financeiro na aba RMR).
   v6.6.1 — Reorganização de arquivos: a lógica da aba Metas (que morava
            junto com Configurações em configuracoes.js, desde que as duas
            eram telas pequenas) virou js/metas.js próprio — configuracoes.js
            caiu de 940 pra 873 linhas. Nenhuma mudança de comportamento,
            só separação por aba, seguindo o mesmo padrão do resto do
            sistema (um arquivo por aba).
   v6.7.0 — Aba "Apresentação" deixou de ser uma aba própria: virou um
            botão ("Apresentação") no cabeçalho da aba Análises, que abre
            a reunião mensal de resultados em um overlay de tela cheia,
            usando o Mês/Ano JÁ selecionados em Análises — sem filtro
            próprio duplicado. Fechar (×), tela cheia, exportar PDF e
            navegação por seta/teclado continuam iguais.
            As telas financeiras da apresentação (DRE, Principais Contas,
            Estrutura de Custos) agora leem do plano de contas (aba
            Financeiro) em vez da tabela `financeiro_dre` da v6.5.0 — essa
            tabela fica de vez sem uso; as rotas obterFinanceiroDre/
            salvarFinanceiroDre continuam em api.js só por segurança, sem
            nada mais chamando elas. Uma conta nova, "Plano de Contas —
            Principais Contas", foi adicionada entre o DRE e a Estrutura
            de Custos, detalhando o valor de cada conta de nível 2
            (Receita Bruta, Deduções, Custo do Serviço, e cada grupo de
            Despesa) — antes só existia o total geral.
            Seed opcional: SQL com o plano de contas completo (incluindo
            Ativo/Passivo/Patrimônio Líquido, ~155 contas) disponível à
            parte — roda uma vez no SQL Editor pra popular a estrutura
            real da clínica (a tabela plano_contas nasce vazia; só o modo
            demonstração já vem com contas de exemplo).
   v6.8.0 — Correção de bug (relatado pelo usuário): ao criar uma subconta
            em qualquer ramo que não fosse Receita (ex.: dentro de Ativo),
            o sistema cravava "saída" sem perguntar — agora pergunta
            sempre, pra qualquer conta nova. A etiqueta entrada/saída de
            cada conta-folha também virou um botão — clique nela pra
            trocar, sem precisar excluir e recriar a conta (corrige contas
            já criadas erradas antes desse fix).
            DRE: cálculo trocado pro modelo de 9 etapas (Receita Bruta →
            Deduções → Receita Líquida → Custo do Serviço → Lucro Bruto →
            Despesas Operacionais [5.1 a 5.4] → Resultado Operacional/
            EBITDA → Resultado Financeiro [5.5] → Prolabore [5.6] → Lucro
            Líquido), com Margem Líquida (%) — mesmo resultado final de
            antes (conferido: bate com o -R$ 28.607,14 de Junho), só que
            agora mostrando as etapas intermediárias. Reaproveitado tanto
            no resumo da aba Financeiro quanto no slide de DRE da
            Apresentação (nova função `financeiroCalcularDre()`).
            Botão "Apresentação" mudou de lugar de novo: estava na aba
            Análises, agora fica na aba RMR (a de andar/médico) — porque
            é ali que os dados de Térreo e Coparticipados já ficam juntos.
            Usa squad-mes/squad-ano (RMR) em vez de rmr-mes/rmr-ano
            (Análises).
            Aba RMR: não exige mais escolher um Andar pra mostrar algo —
            sem filtro, mostra Térreo e Coparticipados juntos (precisava
            disso pra Apresentação conseguir os dois juntos). Escolher um
            andar específico continua funcionando igual, só filtra.
   v6.9.0 — Reorganização de abas: "Verificação" (Verificar + Crítica) e
            "Dashboard" (Análises + RMR + Metas, nessa ordem) viraram abas
            únicas no topo, cada uma com sub-abas por dentro — mesmo
            mecanismo de mostrar/esconder das abas principais, só que
            escopado a um grupo (nova classe .sub-painel/.sub-aba, ver
            estilos.css). A aba aparece se o usuário tiver permissão pra
            QUALQUER uma das telas de dentro dela; dentro, só as sub-abas
            permitidas aparecem. Trocar de aba principal e voltar mantém a
            sub-aba que você tinha escolhido (não reseta pra primeira toda
            vez). Nenhuma tela mudou por dentro — só a organização da
            navegação.
            Apresentação: nova slide "Coparticipados — Procedimentos
            Realizados", entre Ocupação de Turnos e Ultrassom Histórico —
            lista só os procedimentos que tiveram lançamento naquele mês
            (não lista o cadastro inteiro), com quantidade, valor e ticket
            médio, ordenado por valor.
   v6.10.0 — Cortesia no Lançamento: CANCELADA a pedido do usuário, não foi
            implementada.
            Aba Financeiro ganhou sub-abas: Fluxo de Caixa | DRE | Plano de
            Contas (mesmo mecanismo de sub-abas da v6.9.0). Mês/Ano no
            topo é compartilhado pelas três.
            Nova sub-aba "Fluxo de Caixa" — regime de CAIXA, diferente do
            DRE/Plano de Contas (que são por mês de competência): cada
            lançamento tem uma DATA exata, descrição, valor, entrada ou
            saída, banco (Caixa/Unicred/BNB/Cora/InfinitePay) e um vínculo
            opcional com uma conta do plano (só ajuda a comparar depois,
            não afeta o cálculo do DRE). Lista os lançamentos do mês
            selecionado com saldo acumulado, e soma Entradas/Saídas/Saldo
            do período. Requer tabela nova no Supabase — SQL:
            create table if not exists fluxo_caixa (
              id uuid primary key default gen_random_uuid(),
              data date not null, descricao text not null,
              valor numeric not null default 0,
              tipo text not null check (tipo in ('entrada','saida')),
              banco text, conta_plano_codigo text,
              criado_em timestamptz not null default now()
            );
            alter table fluxo_caixa enable row level security;
            create policy acesso_total_anon on fluxo_caixa for all
              using (true) with check (true);
            Nova sub-aba "DRE" — separou o que antes ficava misturado com
            o Plano de Contas: os KPIs e agora também uma tabela com as 9
            etapas completas (Receita Bruta → ... → Lucro Líquido).
            Sub-aba "Plano de Contas" — é a árvore de sempre (adicionar
            subconta, editar valor, CSV modelo/importar), só que agora
            isolada das outras duas.
   v6.11.0 — Fecha a lista pendente:
            Nova aba "Início" (permissão `ver_inicio`) — primeira aba do
            sistema, sem filtro nenhum: atendimentos e faturamento de HOJE
            (com Térreo/Coparticipados separado) e do MÊS ATUAL, calculados
            na hora que a aba abre (js/inicio.js, arquivo próprio).
            Financeiro: dois botões novos — "Exportar DRE (CSV)" na
            sub-aba DRE, e "Exportar plano de contas (CSV)" na sub-aba
            Plano de Contas — diferente do "Baixar planilha-modelo" (que
            vem em branco pra preencher), esses dois já saem com os
            valores reais do mês, incluindo as contas-somatório (não só as
            folhas).
            RMR: nova seção "Squad Financeiro" no final da tela (depois
            dos blocos de Térreo/Coparticipados) — resumo do DRE do mesmo
            mês/ano já selecionado na RMR, com os KPIs e o gráfico de
            Estrutura de Custos, reaproveitando as funções da aba
            Financeiro. Fica em branco com aviso se não tiver nada
            lançado no plano de contas pra aquele mês.
            Apresentação: nova slide "Térreo — Procedimentos Realizados"
            (mesmo formato da que já existia pros Coparticipados), entre
            Volume Operacional e Ticket Médio.
            Checkbox de Cortesia no Lançamento: CANCELADA (pedido do
            usuário), não foi implementada.
   v6.12.0 — Gráficos: linha (cada ponto) e barras empilhadas (total da
            barra) agora mostram o número visível, não só no hover — bar
            simples já tinha isso desde antes. Rosca ganhou o valor
            absoluto na legenda, além do %.
            Configurações: novo cartão "Aparência dos gráficos" — tamanho
            do texto (Pequeno/Médio/Grande, via variável CSS) e cor
            principal (gera uma paleta de ~8 tons distintos por rotação de
            matiz, ângulo áureo — usada nas roscas/multi-série; gráficos
            com cor com significado próprio, tipo Térreo×Coparticipados,
            continuam com as cores deles). Salvo em `configuracoes`
            (chaves grafico_cor_primaria/grafico_tamanho_texto), aplicado
            já na tela de login.
            Plano de Contas: botões "Expandir tudo"/"Recolher tudo" — na
            aba Financeiro e no cartão de Configurações.
            Fluxo de Caixa reorganizado: campos na ordem Data → Tipo →
            Conta do Plano → Descrição → Valor → Banco. "Conta do Plano"
            deixou de ser uma lista solta e virou um seletor em árvore de
            verdade (abre, expande, escolhe a folha).
            Apresentação: nova slide "Todos os Procedimentos" (Térreo +
            Coparticipados juntos), logo após "Composição da Receita por
            Andar" — mesmo formato das duas outras (Térreo/Coparticipados)
            que já existiam, só que combinando os dois andares.
            Aba Início ganhou 3 gráficos do mês atual: pizza Térreo ×
            Coparticipados, pizza Particular × Convênios, e barras do
            faturamento dia a dia — todos a partir dos mesmos dados já
            buscados pros KPIs (sem chamada nova ao banco).
   v6.13.0 — Apresentação: um slide por procedimento (não mais só uma
            tabela resumo) — cada um com o mesmo formato do "Coparticipados
            — Ultrassom (Comparativo Histórico)" que já existia: KPIs do
            mês (qtd./valor/ticket médio) + gráfico de linha comparando
            o ano atual × o ano anterior, mês a mês. Entram todos os
            procedimentos com lançamento no mês, clínica inteira (Térreo +
            Coparticipados juntos).
            Slide "Plano de Contas — Principais Contas" deixou de ser uma
            tabela estática — agora é a mesma árvore expansível da aba
            Financeiro (clica na seta, abre as subcontas; "Expandir tudo"/
            "Recolher tudo" também disponível ali), só sem os botões de
            editar (a Apresentação é só consulta).
   v6.13.1 — Correção de bug (relatado pelo usuário): ele adicionou
            "Retorno" e "Cortesia" nas listas de Procedimento, Convênio E
            Forma de pagamento — mas a regra de "não cobrar" só reconhecia
            a palavra RETORNO e só olhava o campo Procedimento, então
            lançamentos de Cortesia travavam ao salvar (Forma de pagamento
            continuava exigindo valor>0). Agora QUALQUER UM dos 3 campos
            (Procedimento, Convênio ou Forma de pagamento) sendo RETORNO
            ou CORTESIA dispensa Valor e Forma de pagamento — tanto na
            validação do formulário (Lançamento/Modal) quanto na Crítica
            (não vira mais pendência). Caso normal (nenhum dos três com
            esses valores) continua exigindo forma de pagamento com
            valor, como sempre foi.
   v6.13.2 — Correção de bug (relatado pelo usuário — na edição/modal,
            marcando tudo como Retorno inclusive a forma de pagamento):
            a v6.13.1 corrigiu a VALIDAÇÃO (deixava salvar), mas o registro
            salvava com forma_pagamento VAZIO mesmo assim — porque
            `lerLinhasPagamento` descartava qualquer linha de pagamento com
            valor 0, mesmo se a forma escolhida fosse Retorno/Cortesia (que
            por definição não tem valor a cobrar). Agora a linha só é
            descartada se o valor for 0 E a forma NÃO for Retorno/Cortesia
            — nesses dois casos, a forma escolhida é preservada e salva
            certinho, com valor 0. Caso normal (forma real sem valor
            preenchido) continua sendo descartado, como sempre foi.
   v6.13.3 — RMR (Dashboard → RMR), card de cada médico: novo indicador
            "Retorno (Consulta Particular)" — conta os atendimentos com
            Procedimento=Retorno E Convênio=Particular (ou vazio, mesma
            convenção do resto do sistema) — no mês selecionado e na
            tabela mensal do médico. Retorno já caía dentro de
            "Procedimentos" antes; esse indicador é um recorte específico
            de dentro desse grupo, só pra Retorno com convênio particular.
   v6.13.4 — Correção de bug (relatado pelo usuário: mudou a cor dos
            gráficos pra azul e saiu vermelho): `gerarPaletaGraficos`
            (v6.12.0) tinha DOIS erros de conversão de matiz encadeados —
            multiplicava por 360 um valor que `rgbParaHsl` já devolve em
            graus, e dividia por 360 um valor que `hslParaRgb` já espera em
            graus (e divide sozinha por dentro). Junto, isso zerava
            matematicamente a cor escolhida sempre, não importa qual fosse
            — por isso sempre saía vermelho. Corrigido; testado com azul de
            verdade, confere.
            Legenda das roscas (Convênio, Andar, etc — miniGraficoRosca):
            valores agora em R$ formatado (antes mostrava o float cru, tipo
            "360552.39999999997"), e porcentual com 2 casas decimais fixas,
            vírgula (ex.: "1,02%") em vez de arredondar pro inteiro mais
            próximo — isso também resolve fatias pequenas que apareciam
            como "(0%)" e escondiam o valor real (ex.: Correios virava
            "0,02%" em vez de sumir como "0%").
   v6.14.0 — Reformulação grande da aba Metas (a pedido do usuário):
            a meta de cada profissional deixou de ser digitada e passou a
            ser CALCULADA. Colunas novas: Profissional | Turnos Utilizados
            (contagem real de (data,turno) distintos com lançamento no
            mês — não é mais digitado) | Vr Mínimo p/ Prof (R$) — único
            campo editável, um valor de referência por turno | Valor da
            Meta (R$) — Turnos Utilizados × Vr Mínimo, recalculado ao
            vivo na tela conforme digita, sem precisar salvar pra ver.
            "Turnos disponibilizados" e "Meta de quantidade" saíram de
            uso em TODO o sistema — não são mais digitados nem lidos em
            lugar nenhum (Metas, Análises/RMR, RMR-squad, Apresentação).
            A verificação de meta agora é 100% por valor.
            Isso mudou 3 telas de Análises (evolução anual — removeu o
            gráfico de quantidade prevista×realizada; resumo do mês;
            ranking por profissional; detalhe por profissional), a tabela
            de turnos (virou só "Turnos Utilizados", sem mais "Ociosos"/
            "% eficiência" — não tinha mais um "planejado" pra comparar) e
            a tabela de eficiência (virou "Metas financeiras por
            profissional", card renomeado). Também mudou RMR-squad (tabela
            "Dados de atendimento" de cada médico) e 2 slides da
            Apresentação (Térreo Previsto×Realizado, Coparticipados —
            renomeada "Turnos e Metas Financeiras").
            Requer coluna nova no Supabase — SQL:
            alter table metas add column if not exists valor_minimo_turno numeric default 0;
            As colunas antigas (turnos_disponibilizados, meta_valor,
            meta_qtd) ficam no banco sem uso — não removi via DROP COLUMN
            pra não arriscar perder histórico; se quiser limpar depois, dá
            pra rodar um DROP COLUMN separado quando tiver certeza que não
            precisa mais delas.
   v6.14.1 — Correção a pedido do usuário: "Turnos Utilizados" (aba Metas)
            virou campo DIGITÁVEL — a v6.14.0 tinha deixado só como número
            calculado e travado. Agora vem PRÉ-PREENCHIDO com a contagem
            real da produção (como sugestão), mas o usuário pode digitar
            por cima e salvar seu próprio número — por exemplo pra
            planejar um mês sem lançamento ainda, ou corrigir uma
            contagem. O valor SALVO é o que passa a valer em todo canto
            (Valor da Meta na própria aba, e em RMR/Análises/Apresentação)
            — deixou de recalcular da produção toda vez, usa o salvo.
            Testado: editar (10 turnos, R$300/turno) e salvar reflete
            R$ 3.000,00 de meta na hora, em todas as telas.
            Requer coluna nova no Supabase — SQL:
            alter table metas add column if not exists turnos_utilizados numeric default 0;
   v6.14.2 — Correção a pedido do usuário: o card "Retorno (Consulta
            Particular)" da RMR (v6.13.3) estava aparecendo zerado —
            filtrava Procedimento=Retorno E Convênio=Particular/vazio, e
            na prática os retornos tinham convênio preenchido com outra
            coisa. Simplificado: virou só "Retorno", conta qualquer
            atendimento com Procedimento=Retorno, sem olhar o convênio.
   v6.15.0 — Gráficos, a pedido do usuário:
            Números crus (tipo "204936.23999999996") em rótulos de linha,
            barra e barra empilhada agora cortam em NO MÁXIMO 2 casas
            decimais (nova `formatarNumeroGrafico` em graficos.js) — sem
            forçar decimal em número inteiro (101 continua "101"). Vale
            pros rótulos visíveis E pros tooltips (hover).
            Gráficos de rosca (pizza) ganharam rótulo de porcentagem
            DENTRO da fatia (não só na legenda) — só nas fatias grandes o
            bastante pra caber texto legível (≥5% do total), pra não virar
            bagunça nas fatias minúsculas.
            Apresentação: 4 gráficos que mostravam QUANTIDADE viraram
            VALOR (R$) — "Coparticipados — Top 10 Profissionais" (era por
            atendimento, virou por faturamento, título atualizado),
            "Coparticipados — Ultrassom" (era volume, virou faturamento),
            "Térreo — Volume Operacional" (exames, era contagem, virou
            R$), e o gráfico de cada slide individual de procedimento
            (era volume mensal, virou faturamento mensal) — legendas
            atualizadas nos 4.
   v6.15.1 — Aba Verificação → sub-aba Verificar: cabeçalho do cartão
            "Lançamentos" agora mostra "N pacientes • N atendimentos" —
            pacientes DISTINTOS (não conta duas vezes quem tem mais de um
            lançamento no período), respeitando todos os filtros já
            aplicados na tela (profissional, andar, convênio, exame,
            procedimento, paciente, forma de pagamento, período). Sempre
            visível, não depende da permissão financeira do cartão
            "Resumo financeiro" ao lado.
   v6.15.2 — Ajuste a pedido do usuário: a contagem de pacientes da
            v6.15.1 (texto pequeno no cabeçalho de "Lançamentos") virou um
            CARD de verdade, no mesmo estilo dos outros — agora mora
            dentro do cartão "Resumo financeiro", como o PRIMEIRO card da
            fileira (antes dos valores por forma de pagamento), em cinza
            claro pra se diferenciar dos valores financeiros (que ficam em
            teal). Continua contando pacientes distintos, respeitando os
            filtros — e continua aparecendo mesmo pra quem não tem a
            permissão financeira (só os outros cards de valor é que somem
            nesse caso).
   v6.15.3 — Aba Verificação → sub-aba Verificar: novo card "Quantidade
            (Convênio)" — conta quantos atendimentos/partes de pagamento
            foram pagos via Convênio no período filtrado (diferente do
            card "Valor (Convênio)" ao lado, que mostra o R$ total — esse
            card teve o rótulo ajustado de "Convênio" pra "Valor
            (Convênio)" pra não confundir os dois). Fica logo depois de
            "Quantidade de pacientes", mesmo estilo cinza claro. Conferido
            contra contagem manual dos dados — bate certinho.
   v6.15.4 — Correção de rumo (a v6.15.3 não era o que o usuário queria):
            removido o card "Quantidade (Convênio)" (era sobre forma de
            pagamento, não sobre convênio de verdade) — rótulo "Convênio"
            no Resumo financeiro voltou a ser só "Convênio" (sem mais
            precisar de "Valor (" na frente).
            Novo cartão "Por convênio", separado do "Resumo financeiro" —
            um card por CONVÊNIO de verdade (Particular, Unimed, Cassi
            etc. — só os que aparecem no período filtrado), cada um em 2
            linhas dentro do mesmo card: valor em R$ em cima, quantidade
            de atendimentos embaixo (nova classe .valor-secundario no
            CSS). "Quantidade de pacientes" continua como estava, sozinho,
            estilo cinza claro.
   v6.15.5 — Aba Análises: a tabela "Convênios × Profissional" já existia
            (usuário pediu de novo, mas ela já estava lá) — o que faltava
            e foi adicionado agora é o GRÁFICO complementar: uma rosca
            logo abaixo da tabela, "Total por convênio" (soma de todos os
            profissionais por convênio — a mesma linha "Total" da tabela,
            em formato visual). Ficou embaixo da tabela, não do lado, já
            que a tabela é bem larga (10+ colunas de convênio).
   v6.16.0 — Análises → "Correlação entre duas dimensões": novo seletor
            "Subcategoria (opcional)" (padrão: Exame, já que era o
            exemplo do usuário — Convênio × Atendimento com Exame como
            subcategoria). Quando escolhida, cada coluna que tiver aquele
            detalhe preenchido (ex.: Atendimento=USG, que tem Exame
            específico) abre em colunas separadas por valor ("USG —
            Mamas", "USG — Transvaginal" etc.) — registros sem esse
            detalhe (ex.: Consulta, Retorno, Sessão, que não têm Exame)
            continuam numa coluna só, sem virar "— (não informado)".
            "Nenhuma" (padrão anterior) preserva o comportamento de antes
            sem mudança.
   v6.17.0 — Configurações reorganizada em sub-abas: Cadastros (Listas do
            sistema, as 4 matrizes de vínculo, Importar CSV) | Financeiro
            (Plano de Contas da DRE) | Identidade (nome/logo/cor, Aparência
            dos gráficos) | Direitos e Privilégios (sem mudança nessa).
            6 permissões novas, granulares por grupo — Ver/Editar de
            "Parâmetros — Cadastros", "Parâmetros — Financeiro" e
            "Parâmetros — Identidade" (aparecem em Direitos e Privilégios,
            que já lista permissões dinamicamente). Antes, os 4 cadastros
            de vínculo e o Plano de Contas eram travados a "só gerente" no
            código, sem opção de liberar — agora seguem essas permissões
            novas, liberáveis por usuário como qualquer outra.
            Migração automática (temPermissaoParametro, em estado.js):
            enquanto ninguém mexer explicitamente numa permissão nova pra
            um usuário, ela cai pro comportamento de ver_configuracoes/
            editar_configuracoes — quem já tinha acesso continua tendo,
            sem precisar reconfigurar nada. No dia que alguém ligar/
            desligar a permissão nova explicitamente pra um usuário, essa
            escolha passa a valer só pra ele, sem afetar os demais.
            Direitos e Privilégios continua 100% exclusivo do gerente,
            sem exceção (proteção contra autoconcessão de acesso).
            Testado: gerente vê tudo; atendente sem nada não vê nenhuma
            sub-aba; atendente com editar_configuracoes legado herda
            Cadastros/Financeiro/Identidade automaticamente; override
            explícito restringindo só Financeiro funciona isolado, sem
            afetar Cadastros/Identidade do mesmo usuário.
            Vr Mínimo por Profissional (Metas) e Repasse de Coparticipados
            (Verificar) ficaram FORA desta reorganização, a pedido do
            usuário — continuam onde estavam, editados junto com os dados
            que dependem deles.
   v6.18.0 — Novo tipo de parâmetro (a pedido do usuário — exemplo dado:
            "atendente não pode alterar a Data em lugar nenhum do
            sistema"): cartão "Campos travados por papel", em
            Configurações → Cadastros, logo após "Atendentes por
            profissional". Matriz campo × papel (Atendente/Profissional)
            — 13 grupos de campo (os 12 campos do formulário + Valor/Forma
            de pagamento como um grupo só, já que são calculados juntos).
            Trava vale em TODO lugar que usa o formulário — Lançamento
            (novo) E o Modal de edição (Verificar/Crítica) — porque os
            dois já reaproveitavam a mesma `definicaoCampos()`; só precisou
            ensinar essa função a consultar a config nova
            (`campoTravadoPorConfig`, em app-init.js). Gerente nunca é
            afetado. Salvo em `configuracoes` (chaves
            campos_travados_atendente/campos_travados_profissional, JSON).
            Descoberta no processo: a trava de Data pro atendente já
            existia, só que SÓ no Lançamento (hardcoded) — o Modal de
            edição não tinha trava nenhuma, então dava pra driblar editando
            o lançamento depois de criado. Essa era exatamente a brecha
            que o pedido do usuário fechou.
            Cuidado documentado na própria tela: travar um campo
            OBRIGATÓRIO pra quem também cria lançamentos, sem um valor
            padrão, pode impedir a pessoa de salvar. A Data já tem
            preenchimento automático com o dia de hoje (herda o
            comportamento que já existia); os outros campos obrigatórios
            ainda não têm padrão automático — aviso amarelo no próprio
            cartão, pra quem for configurar saber do risco antes.
   v6.19.0 — Cadastro de Pacientes e Cadastro de Profissionais (Fase 1 de
            um projeto maior, discutido com o usuário — Fase 2 será
            conciliar `producao` com as tabelas de faturamento da Unimed
            já importadas no banco: faturamento_notas/faturamento_servicos/
            faturamento_glosas). Migração de banco feita direto no
            Supabase (SQL rodado manualmente pelo usuário, com
            acompanhamento): tabelas novas `pacientes` (4.986 registros) e
            `profissionais` (31, incluindo 5 nomes que não batiam com a
            lista oficial, criados como registros próprios a pedido do
            usuário) — geradas a partir dos nomes já usados nos 15.507
            lançamentos existentes. `producao` ganhou as colunas
            paciente_id/profissional_id (FK), SEM mexer nas colunas de
            texto que já existiam (prof/paciente continuam do jeito que
            estavam — zero risco pro que já funciona). 100% dos 15.507
            lançamentos ligados nos dois vínculos.
            Configurações → Cadastros ganhou 2 cartões novos:
            "Cadastro de Profissionais" (lista tudo, só 31) e "Cadastro de
            Pacientes" (por busca — são ~5 mil, não lista tudo de cara).
            Campo Paciente do Lançamento e do Modal virou autocompletar
            (busca enquanto digita, seleciona da lista) — digitar um nome
            novo sem selecionar CRIA o cadastro automaticamente ao salvar
            (criarPaciente é idempotente: se o nome já existir, reaproveita
            em vez de duplicar — testado). Profissional_id é resolvido
            sozinho pelo nome escolhido no select, contra o cadastro
            carregado no login (estado.profissionaisCadastro).
            Testado: busca de paciente, reaproveitamento sem duplicar,
            criação de paciente novo, profissional inexistente não quebra
            o salvamento (resolve pra null com segurança).
   v6.19.1 — Sem mudança funcional — só bump de versão pra forçar o
            GitHub Desktop a detectar diferença e permitir subir os
            arquivos de novo (usuário relatou que o site no ar estava
            servindo um index.html antigo, com styles.css/app.js — nomes
            que o ProdClin nunca teve).
   v6.20.0 — Módulo de Estoque (aba nova, arquivo js/estoque.js). 5
            sub-abas: Materiais (catálogo + fornecedores) | Entrada, NF
            (cria um lote com validade e quantidade próprias — mesmo
            material pode ter vários lotes com datas diferentes ao mesmo
            tempo) | Solicitar (profissional pede, vinculado a Atendimento
            e/ou Exame — é isso que separa por centro de custo depois) |
            Dispensar (farmácia/gerente aprova — só 2 estados,
            pendente→dispensado/negado, sem etapa "aprovado mas não saiu"
            solta no meio, decisão tomada com o usuário) | Relatório
            (posição de estoque, alerta de abaixo do mínimo, vencendo nos
            próximos 60 dias).
            Dispensação usa FEFO (First Expire, First Out) — consome
            primeiro o lote que vence mais cedo, sempre; se pedir mais do
            que tem em todos os lotes somados, bloqueia com mensagem
            clara em vez de dispensar parcial.
            5 tabelas novas no Supabase (rodadas manualmente pelo usuário,
            com RLS ativo em todas): fornecedores, materiais,
            estoque_lotes, solicitacoes_material (FK pra profissionais,
            criada na v6.19.0), dispensacoes.
            4 permissões novas: Ver, Solicitar, Dispensar/Negar (aprovação)
            e Editar (cadastros + entrada de NF) — separadas porque
            solicitar e aprovar são papéis bem diferentes na prática.
            Profissional já nasce com Ver+Solicitar por padrão (é quem
            pede); Editar/Dispensar ficam de fora do padrão pra qualquer
            papel, libera por Direitos e Privilégios.
            Testado ponta a ponta: entrada por NF, solicitação, dispensa
            com baixa FEFO correta, bloqueio de estoque insuficiente, e
            relatório com KPIs/vencimentos — zero erros.
   v6.20.1 — Ajuste em Estoque, a pedido do usuário: sub-aba "Materiais"
            virou "Cadastro"; dentro dela, "Fornecedores" agora vem antes
            de "Catálogo de materiais" (ordem invertida).
===================================================================== */
const SUPABASE_URL = "https://ggasxplnpbpeyzlaiivi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_n9ZDdhwyLuwndOc4qw_JtA_xDumADQ0";
const supabaseClient = (SUPABASE_URL && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;


