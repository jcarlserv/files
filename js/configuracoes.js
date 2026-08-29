/* =====================================================================
   ProdClin — configuracoes.js
   Aba Configurações (listas do sistema, matrizes Profissional×Andar/Procedimento/Exame,
   Atendente×Profissional, Direitos e Privilégios, importação CSV em massa) e também a aba
   Metas (metas do período + anotação), que por serem pequenas e do mesmo padrão de tela
   administrativa ficaram juntas neste arquivo.
   Este arquivo é carregado via <script src> em index.html, na mesma ordem
   em que aparecia originalmente dentro do <script> único — variáveis e
   funções continuam compartilhando o escopo global, exatamente como antes.
===================================================================== */

/* ---------------------------------------------------------------------
   PAINEL: METAS (metas do período + sugestões de melhoria)
--------------------------------------------------------------------- */
/* ---------------------------------------------------------------------
   PAINEL: CONFIGURAÇÕES
--------------------------------------------------------------------- */
const DEFINICAO_LISTAS_CONFIG = [
  {chave:'profissionais', rotulo:'Profissionais'},
  {chave:'andares', rotulo:'Andares'},
  {chave:'convenios', rotulo:'Convênios'},
  {chave:'procedimentos', rotulo:'Atendimentos'},
  {chave:'atendentes', rotulo:'Atendentes'},
  {chave:'turnos', rotulo:'Turnos'},
  {chave:'formas_pagamento', rotulo:'Formas de pagamento'},
  {chave:'biopsias_frascos', rotulo:'Biópsia (frascos)'},
  {chave:'exames', rotulo:'Exames'},
  {chave:'especialidades', rotulo:'Especialidades (profissionais)'}
];
let listaConfigSelectPronto = false;


// Sub-nav de Configurações (Cadastros/Financeiro/Identidade/Direitos) — cada
// sub-aba só entra na navegação se a permissão de VER correspondente estiver
// ligada; se a sub-aba ativa deixar de estar visível (ex.: permissão foi
// desligada), cai pra primeira disponível.
function prepararSubNavConfiguracoes(visibilidade){
  const subAbas = [
    {id:'config-cadastros', rotulo:'Cadastros', pode: visibilidade.cadastros},
    {id:'config-financeiro', rotulo:'Financeiro', pode: visibilidade.financeiro},
    {id:'config-identidade', rotulo:'Identidade', pode: visibilidade.identidade},
    {id:'config-direitos', rotulo:'Direitos e Privilégios', pode: visibilidade.direitos}
  ];
  const disponiveis = subAbas.filter(s=>s.pode);
  const nav = document.getElementById('sub-nav-configuracoes');
  const jaAtivaAindaDisponivel = disponiveis.some(s=>s.id === estado.subAbaConfiguracoes);
  if(!jaAtivaAindaDisponivel) estado.subAbaConfiguracoes = disponiveis[0] ? disponiveis[0].id : null;

  nav.innerHTML = disponiveis.map(s=>
    `<div class="sub-aba${s.id===estado.subAbaConfiguracoes?' ativa':''}" data-sub="${s.id}">${s.rotulo}</div>`
  ).join('');
  nav.querySelectorAll('.sub-aba').forEach(el=>{
    el.addEventListener('click', ()=> trocarSubAbaConfiguracoes(el.dataset.sub));
  });

  subAbas.forEach(s=>{
    document.getElementById(s.id).classList.toggle('ativa', s.id === estado.subAbaConfiguracoes);
  });
}

function trocarSubAbaConfiguracoes(subId){
  estado.subAbaConfiguracoes = subId;
  document.querySelectorAll('#sub-nav-configuracoes .sub-aba').forEach(el=>{
    el.classList.toggle('ativa', el.dataset.sub===subId);
  });
  ['config-cadastros','config-financeiro','config-identidade','config-direitos'].forEach(id=>{
    document.getElementById(id).classList.toggle('ativa', id===subId);
  });
}


async function atualizarConfiguracoes(){
  document.getElementById('config-nome-clinica').value = nomeClinicaAtual;
  prepararSelectListaConfig();
  renderizarItensListaConfig();
  prepararLogoCores();
  prepararTemaGrafico();
  if(estado.logoClinica && !logoBase64Pendente){
    document.getElementById('config-preview-logo').style.display = 'block';
    document.getElementById('config-preview-logo-img').src = estado.logoClinica;
  }


  // Direitos e Privilégios nunca é liberado pela própria matriz de permissões —
  // isso evitaria alguém se autoconceder mais acesso. Continua sempre exclusivo
  // do gerente, sem exceção — essa é a ÚNICA área de Configurações que não
  // segue as permissões novas de Parâmetros abaixo.
  //
  // Todo o resto (Cadastros/Financeiro/Identidade) agora segue as permissões
  // granulares novas (ver_parametros_cadastros, editar_parametros_cadastros,
  // etc.) — com fallback automático pra ver_configuracoes/editar_configuracoes
  // enquanto ninguém mexer explicitamente na permissão nova (ver
  // temPermissaoParametro em estado.js). Antes disso, essas áreas eram
  // travadas a "só gerente" no código, sem opção de liberar por permissão —
  // essa era exatamente a limitação que motivou criar essas permissões novas.
  const podeVerCadastros = temPermissaoParametro('ver_parametros_cadastros', 'ver_configuracoes');
  const podeEditarCadastros = temPermissaoParametro('editar_parametros_cadastros', 'editar_configuracoes');
  const podeVerFinanceiro = temPermissaoParametro('ver_parametros_financeiros', 'ver_configuracoes');
  const podeEditarFinanceiro = temPermissaoParametro('editar_parametros_financeiros', 'editar_configuracoes');
  const podeVerIdentidade = temPermissaoParametro('ver_parametros_aparencia', 'ver_configuracoes');
  const podeEditarIdentidade = temPermissaoParametro('editar_parametros_aparencia', 'editar_configuracoes');

  prepararSubNavConfiguracoes({
    cadastros: podeVerCadastros, financeiro: podeVerFinanceiro,
    identidade: podeVerIdentidade, direitos: estado.papel==='gerente'
  });

  const cartaoPermissoes = document.getElementById('cartao-direitos-privilegios');
  cartaoPermissoes.style.display = estado.papel==='gerente' ? '' : 'none';
  if(estado.papel==='gerente') await carregarPermissoes();

  ['cartao-profissionais-andares','cartao-profissionais-procedimentos','cartao-profissionais-exames','cartao-atendentes-profissionais','cartao-campos-travados']
    .forEach(id => document.getElementById(id).style.display = podeVerCadastros ? '' : 'none');
  if(podeVerCadastros){
    await carregarProfissionaisAndares();
    await carregarProfissionaisProcedimentos();
    await carregarProfissionaisExames();
    await carregarAtendentesProfissionais();
    renderizarCamposTravados(podeEditarCadastros);
  }

  const cartaoPlanoContas = document.getElementById('cartao-plano-contas-admin');
  cartaoPlanoContas.style.display = podeVerFinanceiro ? '' : 'none';
  if(podeVerFinanceiro){
    await financeiroCarregarContas();
    montarArvoreContas('financeiro-arvore-config', {comValores:false, podeEditar:podeEditarFinanceiro});
  }


  const podeEditarConfig = podeEditarIdentidade;
  document.getElementById('botao-salvar-config').style.display = podeEditarConfig ? 'inline-flex' : 'none';
  document.getElementById('config-nome-clinica').disabled = !podeEditarConfig;
  document.getElementById('botao-adicionar-item-lista').style.display = podeEditarCadastros ? 'inline-flex' : 'none';
  document.getElementById('config-novo-item-lista').disabled = !podeEditarCadastros;
}


/* ---------------------------------------------------------------------
   PROFISSIONAIS POR ANDAR / POR PROCEDIMENTO / POR EXAME — matrizes de
   cadastro (profissional × andar, profissional × procedimento,
   profissional × exame), no mesmo padrão visual da matriz de Direitos e
   Privilégios. Usadas pra travar/filtrar os campos Andar, Procedimento e
   Exame no Lançamento e no modal de edição (ver
   aplicarTravasCondicionadasDoFormulario). Guardadas nas tabelas
   `profissionais_andares`, `profissionais_procedimentos` e
   `profissionais_exames` do Supabase.
--------------------------------------------------------------------- */
async function carregarProfissionaisAndares(){
  const tabela = document.getElementById('tabela-profissionais-andares');
  tabela.innerHTML = '<tr><td class="vazio">Carregando...</td></tr>';
  const resp = await api('listarProfissionaisAndares', {});
  if(!resp.ok){
    if(/relation.*profissionais_andares.*does not exist/i.test(resp.erro||'')){
      tabela.innerHTML = `<tr><td class="vazio" style="text-align:left;padding:16px;">
        <b style="color:var(--danger);">Falta uma tabela no banco.</b><br>
        Ainda não existe a tabela <code>profissionais_andares</code>. Vá no <b>SQL Editor</b> do
        Supabase e rode este comando uma vez, depois recarregue esta página:
        <pre style="background:var(--rose-100);padding:10px 12px;border-radius:8px;margin-top:10px;white-space:pre-wrap;font-size:12.5px;">create table if not exists profissionais_andares (
  id uuid primary key default gen_random_uuid(),
  prof text not null,
  andar text not null,
  unique (prof, andar)
);
alter table profissionais_andares enable row level security;
create policy acesso_total_anon on profissionais_andares for all using (true) with check (true);</pre>
      </td></tr>`;
      return;
    }
    tabela.innerHTML = `<tr><td class="vazio">${resp.erro || 'Não foi possível carregar.'}</td></tr>`;
    return;
  }
  const porLinha = agruparProfPorCampo(resp.linhas, 'andar');
  estado.profissionaisAndares = porLinha; // mantém a trava do formulário sempre com o dado mais recente
  renderizarMatrizProfissionalCampo({
    tabela, porLinha,
    rotuloLinha: 'Profissional',
    linhas: estado.listas.profissionais||[],
    colunas: estado.listas.andares||[],
    acao: 'definirProfissionalAndar',
    nomeCampoLinha: 'prof',
    nomeCampoAcao: 'andar',
    classeCheckbox: 'chk-prof-andar',
    podeEditar: temPermissaoParametro('editar_parametros_cadastros', 'editar_configuracoes')
  });
}


async function carregarProfissionaisProcedimentos(){
  const tabela = document.getElementById('tabela-profissionais-procedimentos');
  tabela.innerHTML = '<tr><td class="vazio">Carregando...</td></tr>';
  const resp = await api('listarProfissionaisProcedimentos', {});
  if(!resp.ok){
    if(/relation.*profissionais_procedimentos.*does not exist/i.test(resp.erro||'')){
      tabela.innerHTML = `<tr><td class="vazio" style="text-align:left;padding:16px;">
        <b style="color:var(--danger);">Falta uma tabela no banco.</b><br>
        Ainda não existe a tabela <code>profissionais_procedimentos</code>. Vá no <b>SQL Editor</b>
        do Supabase e rode este comando uma vez, depois recarregue esta página:
        <pre style="background:var(--rose-100);padding:10px 12px;border-radius:8px;margin-top:10px;white-space:pre-wrap;font-size:12.5px;">create table if not exists profissionais_procedimentos (
  id uuid primary key default gen_random_uuid(),
  prof text not null,
  procedimento text not null,
  unique (prof, procedimento)
);
alter table profissionais_procedimentos enable row level security;
create policy acesso_total_anon on profissionais_procedimentos for all using (true) with check (true);</pre>
      </td></tr>`;
      return;
    }
    tabela.innerHTML = `<tr><td class="vazio">${resp.erro || 'Não foi possível carregar.'}</td></tr>`;
    return;
  }
  const porLinha = agruparProfPorCampo(resp.linhas, 'procedimento');
  estado.profissionaisProcedimentos = porLinha;
  renderizarMatrizProfissionalCampo({
    tabela, porLinha,
    rotuloLinha: 'Profissional',
    linhas: estado.listas.profissionais||[],
    colunas: estado.listas.procedimentos||[],
    acao: 'definirProfissionalProcedimento',
    nomeCampoLinha: 'prof',
    nomeCampoAcao: 'procedimento',
    classeCheckbox: 'chk-prof-procedimento',
    podeEditar: temPermissaoParametro('editar_parametros_cadastros', 'editar_configuracoes')
  });
}


async function carregarProfissionaisExames(){
  const tabela = document.getElementById('tabela-profissionais-exames');
  tabela.innerHTML = '<tr><td class="vazio">Carregando...</td></tr>';
  const resp = await api('listarProfissionaisExames', {});
  if(!resp.ok){
    if(/relation.*profissionais_exames.*does not exist/i.test(resp.erro||'')){
      tabela.innerHTML = `<tr><td class="vazio" style="text-align:left;padding:16px;">
        <b style="color:var(--danger);">Falta uma tabela no banco.</b><br>
        Ainda não existe a tabela <code>profissionais_exames</code>. Vá no <b>SQL Editor</b> do
        Supabase e rode este comando uma vez, depois recarregue esta página:
        <pre style="background:var(--rose-100);padding:10px 12px;border-radius:8px;margin-top:10px;white-space:pre-wrap;font-size:12.5px;">create table if not exists profissionais_exames (
  id uuid primary key default gen_random_uuid(),
  prof text not null,
  exame text not null,
  unique (prof, exame)
);
alter table profissionais_exames enable row level security;
create policy acesso_total_anon on profissionais_exames for all using (true) with check (true);</pre>
      </td></tr>`;
      return;
    }
    tabela.innerHTML = `<tr><td class="vazio">${resp.erro || 'Não foi possível carregar.'}</td></tr>`;
    return;
  }
  const porLinha = agruparProfPorCampo(resp.linhas, 'exame');
  estado.profissionaisExames = porLinha;
  renderizarMatrizProfissionalCampo({
    tabela, porLinha,
    rotuloLinha: 'Profissional',
    linhas: estado.listas.profissionais||[],
    colunas: estado.listas.exames||[],
    acao: 'definirProfissionalExame',
    nomeCampoLinha: 'prof',
    nomeCampoAcao: 'exame',
    classeCheckbox: 'chk-prof-exame',
    podeEditar: temPermissaoParametro('editar_parametros_cadastros', 'editar_configuracoes')
  });
}


async function carregarAtendentesProfissionais(){
  const tabela = document.getElementById('tabela-atendentes-profissionais');
  tabela.innerHTML = '<tr><td class="vazio">Carregando...</td></tr>';
  const resp = await api('listarAtendentesProfissionais', {});
  if(!resp.ok){
    if(/relation.*atendentes_profissionais.*does not exist/i.test(resp.erro||'')){
      tabela.innerHTML = `<tr><td class="vazio" style="text-align:left;padding:16px;">
        <b style="color:var(--danger);">Falta uma tabela no banco.</b><br>
        Ainda não existe a tabela <code>atendentes_profissionais</code>. Vá no <b>SQL Editor</b>
        do Supabase e rode este comando uma vez, depois recarregue esta página:
        <pre style="background:var(--rose-100);padding:10px 12px;border-radius:8px;margin-top:10px;white-space:pre-wrap;font-size:12.5px;">create table if not exists atendentes_profissionais (
  id uuid primary key default gen_random_uuid(),
  atendente text not null,
  prof text not null,
  unique (atendente, prof)
);
alter table atendentes_profissionais enable row level security;
create policy acesso_total_anon on atendentes_profissionais for all using (true) with check (true);</pre>
      </td></tr>`;
      return;
    }
    tabela.innerHTML = `<tr><td class="vazio">${resp.erro || 'Não foi possível carregar.'}</td></tr>`;
    return;
  }
  // Guarda nos dois sentidos — atendente→[profissionais] (usado quando o
  // Atendente logado está travado no próprio nome, no Lançamento) e
  // profissional→[atendentes] (usado quando o Atendente está livre, ou
  // seja, gerente no Lançamento e qualquer edição no Modal).
  estado.atendentesProfissionais = agruparProfPorCampo(resp.linhas, 'prof', 'atendente');
  estado.profissionaisAtendentes = agruparProfPorCampo(resp.linhas, 'atendente', 'prof');
  renderizarMatrizProfissionalCampo({
    tabela, porLinha: estado.atendentesProfissionais,
    rotuloLinha: 'Atendente',
    linhas: estado.listas.atendentes||[],
    colunas: estado.listas.profissionais||[],
    acao: 'definirAtendenteProfissional',
    nomeCampoLinha: 'atendente',
    nomeCampoAcao: 'prof',
    classeCheckbox: 'chk-atendente-prof',
    // Ao salvar, também precisa manter o mapa invertido (profissional→
    // atendentes) sincronizado, já que os dois vêm do mesmo cadastro.
    aoAlterar: (linha, valor, marcado)=>{
      if(!estado.profissionaisAtendentes[valor]) estado.profissionaisAtendentes[valor] = [];
      estado.profissionaisAtendentes[valor] = estado.profissionaisAtendentes[valor].filter(v=>v!==linha);
      if(marcado) estado.profissionaisAtendentes[valor].push(linha);
    },
    podeEditar: temPermissaoParametro('editar_parametros_cadastros', 'editar_configuracoes')
  });
}


// Desenha uma matriz linha × coluna (checkbox em cada célula) e liga os
// eventos de salvar — reaproveitada por Profissional×Andar,
// Profissional×Procedimento, Profissional×Exame e Atendente×Profissional,
// já que as quatro seguem exatamente a mesma mecânica (só muda o que é
// linha/coluna).
// Matriz "Campos travados por papel" — campo × (Atendente, Profissional).
// Diferente das outras matrizes (que salvam a cada clique), esta acumula
// as marcações e só grava quando aperta "Salvar" — evita gravar 26 vezes
// (13 campos × 2 papéis) se a pessoa for mexendo em vários de uma vez.
let camposTravadosPronto = false;
function renderizarCamposTravados(podeEditar){
  const tabela = document.getElementById('tabela-campos-travados');
  const desabilitado = podeEditar ? '' : 'disabled';
  tabela.innerHTML = `
    <thead><tr><th>Campo</th><th style="text-align:center;">Atendente</th><th style="text-align:center;">Profissional</th></tr></thead>
    <tbody>${CAMPOS_TRAVAVEIS.map(c=>`
      <tr data-campo="${c.chave}">
        <td>${c.rotulo}</td>
        <td style="text-align:center;"><input type="checkbox" class="chk-campo-travado-atendente" data-campo="${c.chave}" ${estado.camposTravados.atendente.includes(c.chave)?'checked':''} ${desabilitado}></td>
        <td style="text-align:center;"><input type="checkbox" class="chk-campo-travado-profissional" data-campo="${c.chave}" ${estado.camposTravados.profissional.includes(c.chave)?'checked':''} ${desabilitado}></td>
      </tr>`).join('')}</tbody>`;

  document.getElementById('botao-salvar-campos-travados').style.display = podeEditar ? 'inline-flex' : 'none';
  if(camposTravadosPronto || !podeEditar) return;
  camposTravadosPronto = true;

  document.getElementById('botao-salvar-campos-travados').addEventListener('click', async ()=>{
    const botao = document.getElementById('botao-salvar-campos-travados');
    const confirmacao = document.getElementById('confirmacao-campos-travados');
    const novoAtendente = Array.from(tabela.querySelectorAll('.chk-campo-travado-atendente:checked')).map(el=>el.dataset.campo);
    const novoProfissional = Array.from(tabela.querySelectorAll('.chk-campo-travado-profissional:checked')).map(el=>el.dataset.campo);
    confirmacao.style.color = 'var(--ink-400)';
    confirmacao.textContent = 'Salvando...';
    try{
      await api('salvarConfiguracao', {chave:'campos_travados_atendente', valor: JSON.stringify(novoAtendente)});
      await api('salvarConfiguracao', {chave:'campos_travados_profissional', valor: JSON.stringify(novoProfissional)});
    }catch(e){
      confirmacao.style.color = 'var(--danger)';
      confirmacao.textContent = 'Não foi possível salvar.';
      return;
    }
    estado.camposTravados.atendente = novoAtendente;
    estado.camposTravados.profissional = novoProfissional;
    confirmacao.style.color = 'var(--teal-700)';
    confirmacao.textContent = 'Salvo ✓ — já vale pro próximo lançamento/edição aberto.';
    setTimeout(()=>{ if(confirmacao.textContent.startsWith('Salvo')) confirmacao.textContent=''; }, 4000);
  });
}


function renderizarMatrizProfissionalCampo({tabela, porLinha, rotuloLinha, linhas, colunas, acao, nomeCampoLinha, nomeCampoAcao, classeCheckbox, aoAlterar, podeEditar=true}){
  if(linhas.length===0 || colunas.length===0){
    tabela.innerHTML = '<tr><td class="vazio">Cadastre os itens correspondentes em "Listas do sistema" primeiro.</td></tr>';
    return;
  }
  const desabilitado = podeEditar ? '' : 'disabled';
  tabela.innerHTML = `
    <thead><tr><th>${rotuloLinha}</th>${colunas.map(o=>`<th style="text-align:center;">${o}</th>`).join('')}</tr></thead>
    <tbody>${linhas.map(linha=>`
      <tr data-linha="${linha}">
        <td>${linha}</td>
        ${colunas.map(o=>`<td style="text-align:center;"><input type="checkbox" class="${classeCheckbox}" data-valor="${o}" ${(porLinha[linha]||[]).includes(o)?'checked':''} ${desabilitado}></td>`).join('')}
      </tr>`).join('')}</tbody>`;

  if(!podeEditar) return; // só visualização — não religa os listeners de salvar

  tabela.querySelectorAll(`.${classeCheckbox}`).forEach(chk=>{
    chk.addEventListener('change', async ()=>{
      const linha = chk.closest('tr').dataset.linha;
      const valor = chk.dataset.valor;
      const valorAnterior = !chk.checked;
      chk.disabled = true;
      const resp = await api(acao, {[nomeCampoLinha]: linha, [nomeCampoAcao]: valor, valor: chk.checked});
      chk.disabled = false;
      if(!resp.ok){
        alert(resp.erro || 'Não foi possível salvar essa opção.');
        chk.checked = valorAnterior;
        return;
      }
      // Atualiza o cache local usado pelas travas do formulário, sem
      // precisar recarregar a página inteira.
      if(!porLinha[linha]) porLinha[linha] = [];
      porLinha[linha] = porLinha[linha].filter(v=>v!==valor);
      if(chk.checked) porLinha[linha].push(valor);
      if(aoAlterar) aoAlterar(linha, valor, chk.checked);
    });
  });
}


/* ---------------------------------------------------------------------
   DIREITOS E PRIVILÉGIOS — matriz completa (ver/criar/editar/excluir por
   tela), guardada na tabela `permissoes` (usuario, chave, valor) do
   Supabase. Gerente nunca aparece aqui — sempre tem acesso total.
--------------------------------------------------------------------- */
function agruparPermissoesPorTela(){
  const grupos = [];
  DEFINICAO_PERMISSOES.forEach(p=>{
    let grupo = grupos.find(g=>g.tela===p.tela);
    if(!grupo){ grupo = {tela:p.tela, itens:[]}; grupos.push(grupo); }
    grupo.itens.push(p);
  });
  return grupos;
}


async function carregarPermissoes(){
  const tabela = document.getElementById('tabela-permissoes');
  tabela.innerHTML = '<tr><td class="vazio">Carregando usuários...</td></tr>';
  const resp = await api('listarPermissoesTodos', {});
  if(!resp.ok){
    if(/relation.*permissoes.*does not exist/i.test(resp.erro||'')){
      tabela.innerHTML = `<tr><td class="vazio" style="text-align:left;padding:16px;">
        <b style="color:var(--danger);">Falta uma tabela no banco.</b><br>
        Ainda não existe a tabela <code>permissoes</code>. Vá no <b>SQL Editor</b> do Supabase e
        rode este comando uma vez, depois recarregue esta página:
        <pre style="background:var(--rose-100);padding:10px 12px;border-radius:8px;margin-top:10px;white-space:pre-wrap;font-size:12.5px;">CREATE TABLE IF NOT EXISTS permissoes (
  id bigint generated always as identity primary key,
  usuario text not null,
  chave text not null,
  valor boolean not null default false,
  unique(usuario, chave)
);
ALTER TABLE permissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY acesso_total_anon ON permissoes FOR ALL USING (true) WITH CHECK (true);</pre>
      </td></tr>`;
      return;
    }
    tabela.innerHTML = `<tr><td class="vazio">${resp.erro || 'Não foi possível carregar os usuários.'}</td></tr>`;
    return;
  }
  const usuarios = resp.usuarios || [];
  if(usuarios.length===0){
    tabela.innerHTML = '<tr><td class="vazio">Nenhum usuário além do gerente cadastrado ainda.</td></tr>';
    return;
  }
  const rotuloPapel = p => p==='atendente' ? 'Atendente' : (p==='profissional' ? 'Profissional' : (p==='gerente' ? 'Gerente' : p));
  const explicacaoGrupo = {
    'Início': 'Dashboard inicial com gráficos gerais.',
    'Lançamento': 'Registrar atendimentos.',
    'Verificar': 'Conferir/editar lançamentos, financeiro dos atendimentos.',
    'Crítica': 'Revisar e corrigir lançamentos com pendência.',
    'RMR': 'Relatório de produção por profissional.',
    'Metas': 'Metas de produção por profissional/mês.',
    'Análises': 'Cruzamentos e análises de dados.',
    'Apresentação': 'Modo apresentação (slides).',
    'Financeiro': 'DRE, plano de contas, fluxo de caixa.',
    'Estoque': 'Materiais, entrada por NF, solicitação e dispensação.',
    'Configurações': 'Acesso geral à tela de Configurações.',
    'Cadastros do Sistema': 'Listas, matrizes de vínculo, campos travados, importar CSV.',
    'Parâmetros — Pacientes': 'Cadastro de Pacientes.',
    'Parâmetros — Financeiro': 'Configurações do módulo Financeiro.',
    'Parâmetros — Identidade': 'Logo, cor, nome da clínica.'
  };
  const grupos = agruparPermissoesPorTela();
  const linhaGrupos = grupos.map(g=>`<th colspan="${g.itens.length}" style="text-align:center;border-left:2px solid var(--line);">
    ${g.tela}<br><span style="font-weight:400;font-size:10px;color:var(--ink-400);">${(explicacaoGrupo[g.tela]||'')}</span>
  </th>`).join('');
  const linhaColunas = grupos.map(g=>g.itens.map(p=>`<th style="text-align:center;font-size:10.5px;border-left:${g.itens.indexOf(p)===0?'2px solid var(--line)':'none'};">${p.rotulo}</th>`).join('')).join('');


  tabela.innerHTML = `
    <thead>
      <tr><th rowspan="2">Nome</th><th rowspan="2">Usuário</th><th rowspan="2">Papel</th>${linhaGrupos}</tr>
      <tr>${linhaColunas}</tr>
    </thead>
    <tbody>${usuarios.map(u=>{
      const ehGerente = u.papel === 'gerente';
      return `
      <tr data-usuario="${u.usuario}">
        <td>${u.nome_profissional || u.usuario}</td>
        <td class="mono">${u.usuario}</td>
        <td><span class="tag">${rotuloPapel(u.papel)}</span></td>
        ${DEFINICAO_PERMISSOES.map((p,i)=>`<td style="text-align:center;border-left:${grupos.some(g=>g.itens[0]===p)?'2px solid var(--line)':'none'};" ${ehGerente?'title="Gerente sempre tem acesso total — não editável aqui."':''}><input type="checkbox" class="chk-permissao" data-chave="${p.chave}" ${(ehGerente || u.permissoes[p.chave])?'checked':''} ${ehGerente?'disabled':''}></td>`).join('')}
      </tr>`;
    }).join('')}</tbody>`;


  tabela.querySelectorAll('.chk-permissao').forEach(chk=>{
    chk.addEventListener('change', async ()=>{
      const usuario = chk.closest('tr').dataset.usuario;
      const chave = chk.dataset.chave;
      const valorAnterior = !chk.checked;
      chk.disabled = true;
      const resp = await api('definirPermissao', {usuario, chave, valor: chk.checked});
      chk.disabled = false;
      if(!resp.ok){
        alert(resp.erro || 'Não foi possível salvar essa permissão.');
        chk.checked = valorAnterior;
      }
    });
  });
}


function prepararSelectListaConfig(){
  if(listaConfigSelectPronto) return;
  const sel = document.getElementById('config-lista-selecionada');
  sel.innerHTML = DEFINICAO_LISTAS_CONFIG.map(d=>`<option value="${d.chave}">${d.rotulo}</option>`).join('');
  sel.addEventListener('change', renderizarItensListaConfig);
  document.getElementById('botao-adicionar-item-lista').addEventListener('click', adicionarItemListaConfig);
  document.getElementById('config-novo-item-lista').addEventListener('keydown', (ev)=>{
    if(ev.key==='Enter'){ ev.preventDefault(); adicionarItemListaConfig(); }
  });
  listaConfigSelectPronto = true;
}


function renderizarItensListaConfig(){
  const chave = document.getElementById('config-lista-selecionada').value;
  const itens = estado.listas[chave]||[];
  const container = document.getElementById('config-itens-lista');
  const podeEditarConfig = temPermissaoParametro('editar_parametros_cadastros', 'editar_configuracoes');
  if(itens.length===0){
    container.innerHTML = '<p class="vazio" style="padding:10px 0;">Nenhum item nessa lista ainda.</p>';
    return;
  }
  container.innerHTML = itens.map(item=>`
    <span class="tag" style="display:inline-flex;align-items:center;gap:6px;padding:5px 6px 5px 10px;font-size:12.5px;">
      ${item}
      ${podeEditarConfig?`<button type="button" class="botao-remover-item-lista" data-valor="${item.replace(/"/g,'&quot;')}" title="Remover" style="background:none;border:none;cursor:pointer;color:var(--teal-700);font-weight:700;padding:0 2px;font-size:14px;line-height:1;">×</button>`:''}
    </span>`).join('');
  container.querySelectorAll('.botao-remover-item-lista').forEach(b=>{
    b.addEventListener('click', ()=>removerItemListaConfig(b.dataset.valor));
  });
}


async function adicionarItemListaConfig(){
  const chave = document.getElementById('config-lista-selecionada').value;
  const input = document.getElementById('config-novo-item-lista');
  const valor = input.value.trim();
  if(!valor) return;
  const resp = await api('adicionarItemLista', {coluna:chave, valor});
  if(!resp.ok){ alert(resp.erro || 'Não foi possível adicionar este item.'); return; }
  if(!estado.listas[chave]) estado.listas[chave] = [];
  estado.listas[chave].push(valor);
  input.value = '';
  renderizarItensListaConfig();
}


async function removerItemListaConfig(valor){
  if(!confirm(`Remover "${valor}" desta lista?`)) return;
  const chave = document.getElementById('config-lista-selecionada').value;
  const resp = await api('removerItemLista', {coluna:chave, valor});
  if(!resp.ok){ alert(resp.erro || 'Não foi possível remover este item.'); return; }
  estado.listas[chave] = (estado.listas[chave]||[]).filter(v=>v!==valor);
  renderizarItensListaConfig();
}


document.getElementById('botao-salvar-config').addEventListener('click', async ()=>{
  const valor = document.getElementById('config-nome-clinica').value.trim();
  const botao = document.getElementById('botao-salvar-config');
  await api('salvarConfiguracao', {chave:'nome_clinica', valor});
  nomeClinicaAtual = valor || 'Clínica';
  document.getElementById('nome-clinica-topo').textContent = nomeClinicaAtual;
  document.getElementById('subtitulo-login').textContent = 'Acesso restrito à equipe — ' + nomeClinicaAtual;
  const confirmacao = document.getElementById('confirmacao-config');
  confirmacao.textContent = 'Salvo ✓';
  setTimeout(()=>confirmacao.textContent='', 2000);
});


/* ---------------------------------------------------------------------
   IMPORTAÇÃO EM MASSA DE PRODUÇÃO VIA CSV
--------------------------------------------------------------------- */
const COLUNAS_PRODUCAO_ACEITAS = ['andar','prof','data','turno','paciente','protocolo','carteirinha','procedimento','exames','biopsias','convenio','valor','forma_pagamento','atendente'];
const ALIAS_CABECALHO_PRODUCAO = {
  'forma_de_pagamento':'forma_pagamento',
  'forma_pagto':'forma_pagamento',
  'convenios':'convenio',
  'biopsia':'biopsias',
  'exame':'exames',
  'nome_do_paciente':'paciente'
};


function normalizarCabecalhoCsv(h){
  return h.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,'_');
}


function detectarDelimitadorCsv(linhaCabecalho){
  const virgulas = (linhaCabecalho.match(/,/g)||[]).length;
  const pontoVirgulas = (linhaCabecalho.match(/;/g)||[]).length;
  return pontoVirgulas > virgulas ? ';' : ',';
}


function parsearLinhaCsv(linha, delimitador){
  const valores = [];
  let atual = '', dentroDeAspas = false;
  for(let i=0;i<linha.length;i++){
    const c = linha[i];
    if(c === '"'){
      if(dentroDeAspas && linha[i+1] === '"'){ atual+='"'; i++; }
      else dentroDeAspas = !dentroDeAspas;
    } else if(c === delimitador && !dentroDeAspas){
      valores.push(atual); atual='';
    } else {
      atual += c;
    }
  }
  valores.push(atual);
  return valores;
}


function parsearCsv(texto){
  texto = texto.replace(/^\uFEFF/, ''); // remove BOM, se existir
  const linhas = texto.split(/\r\n|\r|\n/).filter(l=>l.trim()!=='');
  if(linhas.length===0) return {cabecalho:[], linhasDados:[]};
  const delimitador = detectarDelimitadorCsv(linhas[0]);
  const cabecalho = parsearLinhaCsv(linhas[0], delimitador).map(normalizarCabecalhoCsv);
  const linhasDados = linhas.slice(1).map(l=>parsearLinhaCsv(l, delimitador));
  return {cabecalho, linhasDados};
}


function normalizarDataImportacao(valor){
  valor = String(valor||'').trim();
  if(!valor) return '';
  if(/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  const m = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(m){
    const [, d, mo, a] = m;
    return `${a}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return valor;
}


function normalizarValorImportacao(valor){
  valor = String(valor||'').trim();
  if(!valor) return 0;
  if(valor.includes(',') && valor.includes('.')) valor = valor.replace(/\./g,'').replace(',', '.');
  else if(valor.includes(',')) valor = valor.replace(',', '.');
  const n = Number(valor);
  return isNaN(n) ? 0 : n;
}


let linhasImportacaoCsv = [];


document.getElementById('input-importar-csv').addEventListener('change', (ev)=>{
  const arquivo = ev.target.files[0];
  const resumo = document.getElementById('resumo-importacao-csv');
  const botaoImportar = document.getElementById('botao-importar-csv');
  botaoImportar.disabled = true;
  linhasImportacaoCsv = [];
  resumo.style.color = 'var(--ink-600)';
  resumo.textContent = '';
  if(!arquivo) return;


  const leitor = new FileReader();
  leitor.onload = () => {
    const {cabecalho, linhasDados} = parsearCsv(leitor.result);
    const indicePorColuna = {};
    cabecalho.forEach((h,i)=>{
      const alias = ALIAS_CABECALHO_PRODUCAO[h] || h;
      if(COLUNAS_PRODUCAO_ACEITAS.includes(alias) && !(alias in indicePorColuna)) indicePorColuna[alias] = i;
    });


    const faltando = ['prof','data','valor'].filter(c=>!(c in indicePorColuna));
    if(faltando.length){
      resumo.style.color = 'var(--danger)';
      resumo.textContent = `Não encontrei a(s) coluna(s) obrigatória(s) no cabeçalho: ${faltando.join(', ')}. Confira os títulos da primeira linha do CSV.`;
      return;
    }


    const registros = [];
    let semData = 0, semValor = 0;
    linhasDados.forEach(colunas=>{
      const registro = {};
      COLUNAS_PRODUCAO_ACEITAS.forEach(c=>{
        if(c in indicePorColuna) registro[c] = (colunas[indicePorColuna[c]]||'').trim();
      });
      if(!registro.prof && !registro.data && !registro.paciente) return; // linha totalmente vazia, ignora
      registro.data = normalizarDataImportacao(registro.data);
      registro.valor = normalizarValorImportacao(registro.valor);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(registro.data)) semData++;
      if(!registro.valor) semValor++;
      registros.push(registro);
    });


    linhasImportacaoCsv = registros;
    resumo.textContent = `${registros.length} registro(s) encontrados no arquivo, prontos para importar.` +
      (semData ? `\n⚠️ ${semData} linha(s) com data em formato não reconhecido — essas serão rejeitadas pelo banco.` : '') +
      (semValor ? `\n⚠️ ${semValor} linha(s) com valor zerado ou inválido.` : '');
    botaoImportar.disabled = registros.length===0;
  };
  leitor.readAsText(arquivo, 'UTF-8');
});


document.getElementById('botao-importar-csv').addEventListener('click', async ()=>{
  if(MODO_DEMO){ alert('A importação em massa só funciona conectado ao Supabase — não está disponível no modo demonstração.'); return; }
  if(!linhasImportacaoCsv.length) return;
  if(!confirm(`Confirma importar ${linhasImportacaoCsv.length} registro(s) para a tabela de produção?\n\nIsso não pode ser desfeito automaticamente — cada registro entra como um lançamento novo.`)) return;


  const botao = document.getElementById('botao-importar-csv');
  const resumo = document.getElementById('resumo-importacao-csv');
  const barraWrap = document.getElementById('barra-progresso-importacao');
  const barra = document.getElementById('barra-progresso-importacao-interna');
  botao.disabled = true;
  document.getElementById('input-importar-csv').disabled = true;
  barraWrap.style.display = 'block';


  const TAMANHO_LOTE = 300;
  let importados = 0, comErro = 0;
  const primeirosErros = [];


  for(let i=0; i<linhasImportacaoCsv.length; i+=TAMANHO_LOTE){
    const lote = linhasImportacaoCsv.slice(i, i+TAMANHO_LOTE);
    const { error } = await supabaseClient.from('producao').insert(lote);
    if(error){
      comErro += lote.length;
      if(primeirosErros.length<3) primeirosErros.push(error.message);
    } else {
      importados += lote.length;
    }
    const feitos = Math.min(i+TAMANHO_LOTE, linhasImportacaoCsv.length);
    barra.style.width = Math.round((feitos/linhasImportacaoCsv.length)*100)+'%';
    resumo.textContent = `Importando... ${feitos}/${linhasImportacaoCsv.length}`;
  }


  botao.disabled = false;
  document.getElementById('input-importar-csv').disabled = false;
  resumo.style.color = comErro ? 'var(--danger)' : 'var(--teal-700)';
  resumo.textContent = `Importação concluída: ${importados} registro(s) importado(s) com sucesso` +
    (comErro ? `, ${comErro} com erro (lotes rejeitados inteiros — corrija e reimporte só as linhas problemáticas). Detalhe: ${primeirosErros.join(' | ')}` : '.');
  document.getElementById('input-importar-csv').value = '';
  linhasImportacaoCsv = [];
});


/* ---------------------------------------------------------------------
   LOGO E CORES — envio da logo da clínica (guardada como base64 na
   tabela `configuracoes`, chave 'logo_clinica') e sugestão de paleta
   principal a partir das cores predominantes da imagem (processamento
   100% local, via <canvas> — nenhuma IA envolvida). A cor escolhida é
   salva em 'cor_primaria' (hex) e reaplicada em toda visita, via CSS
   custom properties (--plum-900/800/700/500/300) — a cor --teal-* de
   sucesso/positivo nunca é tocada, pra manter o contraste com a marca.
--------------------------------------------------------------------- */
let logoCoresProntos = false;
let logoBase64Pendente = null;   // arquivo selecionado, ainda não salvo
let corSugeridaPendente = null;  // hex sugerido, ainda não confirmado
let corAplicadaPendente = null;  // hex que o usuário já clicou "Aplicar" (será salvo)

function hexParaRgb(hex){
  hex = hex.replace('#','');
  return { r: parseInt(hex.slice(0,2),16), g: parseInt(hex.slice(2,4),16), b: parseInt(hex.slice(4,6),16) };
}
function rgbParaHex(r,g,b){
  const c = v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0');
  return '#'+c(r)+c(g)+c(b);
}
function rgbParaHsl(r,g,b){
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h=0,s=0; const l=(max+min)/2;
  const d = max-min;
  if(d!==0){
    s = l>0.5 ? d/(2-max-min) : d/(max+min);
    switch(max){
      case r: h = ((g-b)/d + (g<b?6:0)); break;
      case g: h = ((b-r)/d + 2); break;
      case b: h = ((r-g)/d + 4); break;
    }
    h/=6;
  }
  return {h:h*360, s, l};
}
function hslParaRgb(h,s,l){
  h/=360;
  const hue2rgb=(p,q,t)=>{
    if(t<0) t+=1; if(t>1) t-=1;
    if(t<1/6) return p+(q-p)*6*t;
    if(t<1/2) return q;
    if(t<2/3) return p+(q-p)*(2/3-t)*6;
    return p;
  };
  let r,g,b;
  if(s===0){ r=g=b=l; }
  else{
    const q = l<0.5 ? l*(1+s) : l+s-l*s;
    const p = 2*l-q;
    r = hue2rgb(p,q,h+1/3); g = hue2rgb(p,q,h); b = hue2rgb(p,q,h-1/3);
  }
  return { r:r*255, g:g*255, b:b*255 };
}

/* Lê os pixels de uma <img> já carregada (via canvas, reduzida pra 40×40 pra
   ficar rápido) e devolve a cor predominante em hex — ignora pixels quase
   brancos/pretos/muito dessaturados (fundo comum de arquivo de logo) pra não
   sugerir uma cor "sem graça"; se sobrar só fundo neutro, cai pra média geral. */
function extrairCorPredominante(imgEl){
  const tamanho = 40;
  const canvas = document.createElement('canvas');
  canvas.width = tamanho; canvas.height = tamanho;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imgEl, 0, 0, tamanho, tamanho);
  let dados;
  try{
    dados = ctx.getImageData(0, 0, tamanho, tamanho).data;
  }catch(e){
    return '#8A3D79'; // imagem de outra origem/CORS bloqueou leitura — cai no plum padrão
  }

  const baldes = {};
  let somaR=0, somaG=0, somaB=0, totalGeral=0;
  for(let i=0; i<dados.length; i+=4){
    const r=dados[i], g=dados[i+1], b=dados[i+2], a=dados[i+3];
    if(a<128) continue; // pixel transparente
    totalGeral++; somaR+=r; somaG+=g; somaB+=b;
    const {s, l} = rgbParaHsl(r,g,b);
    if(l>0.92 || l<0.08 || s<0.15) continue; // ignora fundo neutro/branco/preto
    const chave = [Math.round(r/24), Math.round(g/24), Math.round(b/24)].join(',');
    if(!baldes[chave]) baldes[chave] = {r:0,g:0,b:0,n:0};
    baldes[chave].r+=r; baldes[chave].g+=g; baldes[chave].b+=b; baldes[chave].n++;
  }

  const chaves = Object.keys(baldes);
  if(chaves.length===0){
    // só tinha fundo neutro — usa a média geral mesmo assim
    if(totalGeral===0) return '#8A3D79';
    return rgbParaHex(somaR/totalGeral, somaG/totalGeral, somaB/totalGeral);
  }
  const maior = chaves.reduce((a,b)=> baldes[a].n>baldes[b].n ? a : b);
  const {r,g,b,n} = baldes[maior];
  return rgbParaHex(r/n, g/n, b/n);
}

/* Deriva os 5 tons (900/800/700/500/300) usados na marca a partir de UMA cor
   base — mantém o matiz/saturação da cor extraída e só varia a luminosidade,
   nos mesmos "degraus" da paleta plum original, pra preservar o contraste já
   testado do layout (texto claro sobre --plum-900 no topo, etc.). */
function derivarPaletaDeCor(hexBase){
  const {r,g,b} = hexParaRgb(hexBase);
  const {h, s} = rgbParaHsl(r,g,b);
  const satUsada = Math.max(0.25, Math.min(s, 0.65)); // evita cor bruta demais ou cinza demais
  const degraus = { 900:0.16, 800:0.20, 700:0.27, 500:0.40, 300:0.68 };
  const paleta = {};
  Object.keys(degraus).forEach(tom=>{
    const {r:rr,g:gg,b:bb} = hslParaRgb(h, satUsada, degraus[tom]);
    paleta[tom] = rgbParaHex(rr,gg,bb);
  });
  return paleta;
}

// Aplica a paleta (5 variáveis CSS) no :root, sobrescrevendo o valor padrão
// da folha de estilos — vale pra toda a página, incluindo tela de login.
function aplicarPaletaCor(hexBase){
  if(!hexBase) return;
  const paleta = derivarPaletaDeCor(hexBase);
  const raiz = document.documentElement.style;
  raiz.setProperty('--plum-900', paleta['900']);
  raiz.setProperty('--plum-800', paleta['800']);
  raiz.setProperty('--plum-700', paleta['700']);
  raiz.setProperty('--plum-500', paleta['500']);
  raiz.setProperty('--plum-300', paleta['300']);
}

// Remove qualquer cor aplicada nesta sessão e volta pra última cor
// efetivamente SALVA no banco (ou pro roxo padrão da folha de estilos, se
// a clínica nunca salvou nenhuma).
function restaurarPaletaSalva(){
  if(estado.corPrimaria){
    aplicarPaletaCor(estado.corPrimaria);
  } else {
    ['--plum-900','--plum-800','--plum-700','--plum-500','--plum-300'].forEach(v=>{
      document.documentElement.style.removeProperty(v);
    });
  }
}

// ---------- Aparência dos gráficos (cartão em Configurações) ----------
let temaGraficoPronto = false;
function prepararTemaGrafico(){
  document.getElementById('config-grafico-tamanho').value = estado.graficoTamanhoTexto || 'medio';
  if(estado.graficoCorPrimaria) document.getElementById('config-grafico-cor').value = estado.graficoCorPrimaria;
  if(temaGraficoPronto) return;

  document.getElementById('botao-salvar-tema-grafico').addEventListener('click', async ()=>{
    const cor = document.getElementById('config-grafico-cor').value;
    const tamanho = document.getElementById('config-grafico-tamanho').value;
    const confirmacao = document.getElementById('confirmacao-tema-grafico');
    confirmacao.style.color = 'var(--ink-400)';
    confirmacao.textContent = 'Salvando...';
    try{
      await api('salvarConfiguracao', {chave:'grafico_cor_primaria', valor: cor});
      await api('salvarConfiguracao', {chave:'grafico_tamanho_texto', valor: tamanho});
    }catch(e){
      confirmacao.style.color = 'var(--danger)';
      confirmacao.textContent = 'Não foi possível salvar.';
      return;
    }
    estado.graficoCorPrimaria = cor;
    estado.graficoTamanhoTexto = tamanho;
    aplicarTemaGraficos(cor, tamanho);
    confirmacao.style.color = 'var(--teal-700)';
    confirmacao.textContent = 'Salvo ✓ — o tamanho do texto já atualizou; a cor vale a partir do próximo gráfico desenhado.';
    setTimeout(()=>{ if(confirmacao.textContent.startsWith('Salvo')) confirmacao.textContent=''; }, 3000);
  });
  temaGraficoPronto = true;
}

// Troca o selo "C" pela logo (chamado tanto no boot, com a logo já salva,
// quanto logo após o usuário enviar um arquivo novo, pra pré-visualizar).
function aplicarLogoNosSelo(base64){
  ['selo-login','selo-topo'].forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    if(base64){
      el.innerHTML = `<img src="${base64}" alt="Logo" style="width:100%;height:100%;object-fit:contain;border-radius:inherit;background:#fff;">`;
    } else {
      el.innerHTML = 'C';
    }
  });
}

function prepararLogoCores(){
  if(logoCoresProntos) return;

  document.getElementById('config-input-logo').addEventListener('change', (ev)=>{
    const arquivo = ev.target.files[0];
    const sugestaoBox = document.getElementById('config-sugestao-cor');
    const avisoAplicada = document.getElementById('config-cor-aplicada-aviso');
    sugestaoBox.style.display = 'none';
    avisoAplicada.style.display = 'none';
    corSugeridaPendente = null;
    corAplicadaPendente = null;
    logoBase64Pendente = null;
    if(!arquivo) return;

    const leitor = new FileReader();
    leitor.onload = () => {
      logoBase64Pendente = leitor.result;
      const preview = document.getElementById('config-preview-logo');
      const previewImg = document.getElementById('config-preview-logo-img');
      preview.style.display = 'block';
      previewImg.src = logoBase64Pendente;

      previewImg.onload = () => {
        corSugeridaPendente = extrairCorPredominante(previewImg);
        document.getElementById('config-amostra-cor').style.background = corSugeridaPendente;
        document.getElementById('config-codigo-cor').textContent = corSugeridaPendente.toUpperCase();
        sugestaoBox.style.display = 'block';
      };
    };
    leitor.readAsDataURL(arquivo);
  });

  document.getElementById('botao-aplicar-cor').addEventListener('click', ()=>{
    if(!corSugeridaPendente) return;
    corAplicadaPendente = corSugeridaPendente;
    aplicarPaletaCor(corAplicadaPendente);
    document.getElementById('config-cor-aplicada-aviso').style.display = 'block';
  });

  document.getElementById('botao-descartar-cor').addEventListener('click', ()=>{
    document.getElementById('config-sugestao-cor').style.display = 'none';
    document.getElementById('config-cor-aplicada-aviso').style.display = 'none';
    corAplicadaPendente = null;
    restaurarPaletaSalva();
  });

  document.getElementById('botao-salvar-logo').addEventListener('click', async ()=>{
    if(!logoBase64Pendente){ alert('Escolha um arquivo de logo antes de salvar.'); return; }
    const confirmacao = document.getElementById('confirmacao-logo');
    confirmacao.style.color = 'var(--ink-400)';
    confirmacao.textContent = 'Salvando...';

    const respLogo = await api('salvarConfiguracao', {chave:'logo_clinica', valor: logoBase64Pendente});
    if(!respLogo.ok){
      confirmacao.style.color = 'var(--danger)';
      confirmacao.textContent = respLogo.erro || 'Não foi possível salvar a logo.';
      return;
    }
    estado.logoClinica = logoBase64Pendente;
    aplicarLogoNosSelo(estado.logoClinica);

    if(corAplicadaPendente){
      const respCor = await api('salvarConfiguracao', {chave:'cor_primaria', valor: corAplicadaPendente});
      if(respCor.ok){
        estado.corPrimaria = corAplicadaPendente;
      }
    }

    confirmacao.style.color = 'var(--teal-700)';
    confirmacao.textContent = 'Logo salva ✓';
    setTimeout(()=>{ if(confirmacao.textContent==='Logo salva ✓') confirmacao.textContent=''; }, 2500);
  });

  logoCoresProntos = true;
}


/* =====================================================================
   CADASTRO DE PROFISSIONAIS — só 31 registros hoje, então lista tudo de
   uma vez, sem busca. Nome vem do cadastro (não editável aqui — pra
   corrigir nome errado, é caso a caso, avisa que precisa de SQL). O que
   dá pra completar pela tela: telefone, registro profissional,
   especialidade.
===================================================================== */
let cadastroProfissionaisCache = [];
async function carregarCadastroProfissionais(podeEditar){
  const tabela = document.getElementById('tabela-cadastro-profissionais');
  tabela.innerHTML = '<tr><td class="vazio">Carregando...</td></tr>';
  const resp = await api('listarProfissionaisCadastro', {});
  if(!resp.ok){
    tabela.innerHTML = `<tr><td class="vazio">${resp.erro || 'Não foi possível carregar.'}</td></tr>`;
    return;
  }
  cadastroProfissionaisCache = resp.profissionais || [];
  const desabilitado = podeEditar ? '' : 'disabled';
  tabela.innerHTML = `
    <thead><tr><th>Nome</th><th>Telefone</th><th>Registro profissional</th><th>Especialidade</th><th></th></tr></thead>
    <tbody>${cadastroProfissionaisCache.map(p=>`
      <tr data-id="${p.id}">
        <td>${p.nome}${p.observacoes?` <span title="${p.observacoes.replace(/"/g,'&quot;')}" style="cursor:help;color:var(--gold-600);">ⓘ</span>`:''}</td>
        <td><input type="text" class="input-prof-telefone" value="${p.telefone||''}" ${desabilitado} style="width:140px;padding:6px 9px;border:1.5px solid var(--line);border-radius:7px;"></td>
        <td><input type="text" class="input-prof-registro" value="${p.registro_profissional||''}" ${desabilitado} style="width:130px;padding:6px 9px;border:1.5px solid var(--line);border-radius:7px;"></td>
        <td><select class="input-prof-especialidade" ${desabilitado} style="width:170px;padding:6px 9px;border:1.5px solid var(--line);border-radius:7px;">
          <option value="">—</option>
          ${(estado.listas.especialidades||[]).map(e=>`<option ${e===p.especialidade?'selected':''}>${e}</option>`).join('')}
        </select></td>
        <td>${podeEditar?'<button class="botao secundario pequeno botao-salvar-profissional-cadastro">Salvar</button>':''}</td>
      </tr>`).join('')}</tbody>`;

  if(!podeEditar) return;
  tabela.querySelectorAll('.botao-salvar-profissional-cadastro').forEach(botao=>{
    botao.addEventListener('click', async (ev)=>{
      const linha = ev.target.closest('tr');
      const resp2 = await api('atualizarProfissionalCadastro', {
        id: linha.dataset.id,
        telefone: linha.querySelector('.input-prof-telefone').value,
        registro_profissional: linha.querySelector('.input-prof-registro').value,
        especialidade: linha.querySelector('.input-prof-especialidade').value
      });
      ev.target.textContent = resp2.ok ? 'Salvo ✓' : 'Erro';
      setTimeout(()=>ev.target.textContent='Salvar', 1800);
    });
  });
}


/* =====================================================================
   CADASTRO DE PACIENTES — ~5.000 registros, então funciona por BUSCA (não
   lista tudo de cara). Digita o nome, mostra até 30 resultados, clica em
   "Editar" abre um modal (igual ao de editar atendimento) com Nome/WhatsApp/
   Endereço. "+ Novo paciente" abre o mesmo modal, vazio.
===================================================================== */
// Formata "dd/mm/aaaa (idade anos)" a partir de uma data ISO (yyyy-mm-dd)
// — usado só pra exibir na tabela de busca, não mexe no que é salvo.
function formatarNascimentoComIdade(dataIso){
  if(!dataIso) return '—';
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  if(!ano || !mes || !dia) return '—';
  const nascimento = new Date(ano, mes-1, dia);
  const hoje = new Date();
  let idade = hoje.getFullYear() - ano;
  const aindaNaoFezAniversario = (hoje.getMonth()+1 < mes) || (hoje.getMonth()+1===mes && hoje.getDate() < dia);
  if(aindaNaoFezAniversario) idade--;
  const dataFormatada = `${String(dia).padStart(2,'0')}/${String(mes).padStart(2,'0')}/${ano}`;
  return `${dataFormatada} (${idade} anos)`;
}

let cadastroPacientesPronto = false;
let pacienteEmEdicaoId = null; // null = criando um novo; senão, id de quem está sendo editado
let pacienteModalAlvoPreenchimento = null; // id do campo (ex.: 'campo_paciente') pra preencher depois de salvar, quando aberto pelo botão "+ Novo" do Lançamento
let cadastroPacientesCacheBusca = []; // últimos resultados da busca, pra achar o registro completo ao clicar Editar

function prepararCadastroPacientes(podeEditar){
  prepararVinculoConvenio(podeEditar);
  document.getElementById('aviso-cadastro-pacientes').textContent =
    'Digite pelo menos 2 letras do nome pra buscar (mostra até 30 resultados por vez).';
  document.getElementById('tabela-cadastro-pacientes').innerHTML = '';
  document.getElementById('botao-novo-paciente-cadastro').style.display = podeEditar ? 'inline-flex' : 'none';
  if(cadastroPacientesPronto) return;
  cadastroPacientesPronto = true;

  let timeoutBusca = null;
  document.getElementById('busca-cadastro-pacientes').addEventListener('input', (ev)=>{
    clearTimeout(timeoutBusca);
    const termo = ev.target.value.trim();
    if(termo.length < 2){
      document.getElementById('tabela-cadastro-pacientes').innerHTML = '';
      document.getElementById('aviso-cadastro-pacientes').textContent = 'Digite pelo menos 2 letras do nome pra buscar (mostra até 30 resultados por vez).';
      return;
    }
    timeoutBusca = setTimeout(()=>buscarEExibirPacientes(termo), 350); // espera parar de digitar
  });

  document.getElementById('botao-novo-paciente-cadastro').addEventListener('click', ()=>abrirModalPaciente(null));
}

// Liga os botões do MODAL de paciente em si (Cancelar, clicar fora,
// Salvar) — separado de prepararCadastroPacientes de propósito, porque
// esse modal também é aberto pelo botão "+ Novo" direto do Lançamento/
// Modal de edição, sem a pessoa nunca ter passado pela aba "Cadastro de
// Clientes". Chamado uma vez só, no boot da aplicação (ver app-init.js),
// pra já estar pronto não importa por onde o modal seja aberto primeiro.
let modalPacienteGlobalPronto = false;
function prepararModalPacienteGlobal(){
  if(modalPacienteGlobalPronto) return;
  modalPacienteGlobalPronto = true;

  document.getElementById('botao-cancelar-modal-paciente').addEventListener('click', fecharModalPaciente);
  document.getElementById('sobreposicao-modal-paciente').addEventListener('click', (ev)=>{
    if(ev.target.id==='sobreposicao-modal-paciente') fecharModalPaciente();
  });
  document.getElementById('form-modal-paciente').addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const nome = document.getElementById('modal-paciente-nome').value.trim();
    if(!nome){ alert('Preencha o nome do paciente.'); return; }
    const botao = ev.target.querySelector('button[type="submit"]');
    const rotuloOriginal = botao.textContent;
    botao.disabled = true; botao.textContent = 'Salvando...';
    const dadosPaciente = {
      nome, whatsapp: document.getElementById('modal-paciente-whatsapp').value,
      endereco: document.getElementById('modal-paciente-endereco').value,
      convenio: document.getElementById('modal-paciente-convenio').value,
      carteirinha: document.getElementById('modal-paciente-carteirinha').value,
      data_nascimento: document.getElementById('modal-paciente-data-nascimento').value,
      cpf: document.getElementById('modal-paciente-cpf').value
    };
    const resp = pacienteEmEdicaoId
      ? await api('atualizarPaciente', Object.assign({id: pacienteEmEdicaoId}, dadosPaciente))
      : await api('criarPaciente', dadosPaciente);
    botao.disabled = false; botao.textContent = rotuloOriginal;
    if(!resp.ok){ alert(resp.erro || 'Não foi possível salvar.'); return; }

    // Aberto pelo botão "+ Novo" do Lançamento/Modal? Preenche o campo de
    // origem com quem acabou de ser cadastrado, pra continuar o
    // atendimento sem precisar buscar de novo — inclusive Convênio/
    // Carteirinha/Nascimento/CPF, já que é um cadastro fresquinho.
    if(pacienteModalAlvoPreenchimento){
      const pacienteResultado = resp.paciente || Object.assign({id: pacienteEmEdicaoId, nome}, dadosPaciente);
      const elCampo = document.getElementById(pacienteModalAlvoPreenchimento);
      const elCampoId = document.getElementById(pacienteModalAlvoPreenchimento+'_id');
      if(elCampo) elCampo.value = pacienteResultado.nome;
      if(elCampoId) elCampoId.value = pacienteResultado.id;
      const prefixoAlvo = pacienteModalAlvoPreenchimento.replace(/paciente$/, '');
      preencherCamposDerivadosPaciente(prefixoAlvo, pacienteResultado);
    }

    fecharModalPaciente();
    // Só atualiza a busca da aba Cadastro de Clientes se ela já foi usada
    // alguma vez (senão os elementos existem mas não faz sentido mexer).
    const buscaEl = document.getElementById('busca-cadastro-pacientes');
    if(buscaEl){ buscaEl.value = nome; buscarEExibirPacientes(nome); }
  });
}

function abrirModalPaciente(paciente, alvoCampoId){
  pacienteEmEdicaoId = paciente ? paciente.id : null;
  pacienteModalAlvoPreenchimento = alvoCampoId || null; // pra onde volta preenchido depois de salvar (ver botão "+ Novo" do Lançamento)
  document.getElementById('titulo-modal-paciente').textContent = paciente ? 'Editar paciente' : 'Novo paciente';
  document.getElementById('modal-paciente-nome').value = paciente ? paciente.nome : '';
  document.getElementById('modal-paciente-whatsapp').value = paciente ? (paciente.whatsapp||'') : '';
  document.getElementById('modal-paciente-endereco').value = paciente ? (paciente.endereco||'') : '';
  const selConvenio = document.getElementById('modal-paciente-convenio');
  selConvenio.innerHTML = '<option value="">—</option>' + (estado.listas.convenios||[]).map(c=>`<option>${c}</option>`).join('');
  selConvenio.value = paciente ? (paciente.convenio||'') : '';
  document.getElementById('modal-paciente-carteirinha').value = paciente ? (paciente.carteirinha||'') : '';
  document.getElementById('modal-paciente-data-nascimento').value = paciente ? (paciente.data_nascimento||'') : '';
  document.getElementById('modal-paciente-cpf').value = paciente ? (paciente.cpf||'') : '';
  document.getElementById('sobreposicao-modal-paciente').classList.add('aberta');
}
function fecharModalPaciente(){
  document.getElementById('sobreposicao-modal-paciente').classList.remove('aberta');
  pacienteEmEdicaoId = null;
  pacienteModalAlvoPreenchimento = null;
}

async function buscarEExibirPacientes(termo){
  const tabela = document.getElementById('tabela-cadastro-pacientes');
  const aviso = document.getElementById('aviso-cadastro-pacientes');
  tabela.innerHTML = '<tr><td class="vazio">Buscando...</td></tr>';
  const resp = await api('buscarPacientes', {termo});
  if(!resp.ok){
    tabela.innerHTML = `<tr><td class="vazio">${resp.erro || 'Não foi possível buscar.'}</td></tr>`;
    return;
  }
  const podeEditar = document.getElementById('botao-novo-paciente-cadastro').style.display !== 'none';
  const pacientes = resp.pacientes || [];
  cadastroPacientesCacheBusca = pacientes; // pra abrirModalPaciente achar o registro completo ao clicar Editar
  aviso.textContent = pacientes.length===30 ? 'Mostrando os 30 primeiros — refine a busca pra achar um específico.' : `${pacientes.length} encontrado${pacientes.length===1?'':'s'}.`;
  tabela.innerHTML = pacientes.length===0 ? '<tr><td class="vazio">Nenhum paciente encontrado com esse nome.</td></tr>' : `
    <thead><tr><th>Nome</th><th>CPF</th><th>Nascimento</th><th>WhatsApp</th><th>Endereço</th><th>Convênio</th><th>Carteirinha</th><th></th></tr></thead>
    <tbody>${pacientes.map(p=>`
      <tr data-id="${p.id}">
        <td>${p.nome}</td>
        <td class="mono">${p.cpf||'—'}</td>
        <td>${formatarNascimentoComIdade(p.data_nascimento)}</td>
        <td>${p.whatsapp||'—'}</td>
        <td>${p.endereco||'—'}</td>
        <td>${p.convenio||'—'}</td>
        <td class="mono">${p.carteirinha||'—'}</td>
        <td>${podeEditar?`<button class="botao secundario pequeno botao-editar-paciente-cadastro" data-id="${p.id}">Editar</button>`:''}</td>
      </tr>`).join('')}</tbody>`;

  if(!podeEditar) return;
  tabela.querySelectorAll('.botao-editar-paciente-cadastro').forEach(botao=>{
    botao.addEventListener('click', ()=>{
      const paciente = cadastroPacientesCacheBusca.find(p=>p.id===botao.dataset.id);
      if(paciente) abrirModalPaciente(paciente);
    });
  });
}


/* =====================================================================
   VINCULAR CONVÊNIO (Unimed) — revisão manual, um beneficiário por vez.
   Nada é gravado sem clicar em "Confirmar vínculo". "Pular" também grava
   (com status='pulado'), pra não repetir o mesmo beneficiário de novo —
   a fila sempre encolhe, nunca fica presa no mesmo item.
===================================================================== */
let vinculoConvenioPronto = false;
let vinculoBeneficiarioAtual = null;
let vinculoPacienteEscolhido = null;

function prepararVinculoConvenio(podeEditar){
  const cartaoCard = document.getElementById('cartao-vincular-convenio');
  cartaoCard.style.display = podeEditar ? '' : 'none';
  if(!podeEditar) return;

  carregarProximoBeneficiario();

  if(vinculoConvenioPronto) return;
  vinculoConvenioPronto = true;

  let timeoutBuscaVinculo = null;
  document.getElementById('vinculo-busca-paciente').addEventListener('input', (ev)=>{
    vinculoPacienteEscolhido = null;
    atualizarBotaoConfirmarVinculo();
    document.getElementById('vinculo-selecionado').style.display = 'none';
    clearTimeout(timeoutBuscaVinculo);
    const termo = ev.target.value.trim();
    const resultados = document.getElementById('vinculo-resultados');
    if(termo.length < 2){ resultados.style.display = 'none'; return; }
    timeoutBuscaVinculo = setTimeout(async ()=>{
      const modo = document.querySelector('input[name="vinculo-modo-busca"]:checked').value;
      const resp = await api('buscarPacientes', {termo, campo: modo});
      if(!resp.ok || !resp.pacientes || resp.pacientes.length===0){ resultados.style.display = 'none'; return; }
      resultados.innerHTML = resp.pacientes.map(p=>
        `<div class="autocomplete-item" data-id="${p.id}" data-nome="${p.nome.replace(/"/g,'&quot;')}" style="padding:9px 12px;cursor:pointer;font-size:13.5px;border-bottom:1px solid var(--line);">
          ${p.nome}${p.carteirinha?` <span class="mono" style="color:var(--ink-400);font-size:12px;">(${p.carteirinha})</span>`:''}
        </div>`
      ).join('');
      resultados.style.display = 'block';
      resultados.querySelectorAll('.autocomplete-item').forEach(item=>{
        item.addEventListener('mousedown', (ev2)=>{
          ev2.preventDefault();
          vinculoPacienteEscolhido = {id:item.dataset.id, nome:item.dataset.nome};
          document.getElementById('vinculo-busca-paciente').value = item.dataset.nome;
          document.getElementById('vinculo-selecionado').style.display = 'block';
          document.getElementById('vinculo-selecionado').textContent = `Selecionado: ${item.dataset.nome}`;
          resultados.style.display = 'none';
          atualizarBotaoConfirmarVinculo();
        });
      });
    }, 300);

    // Sugestão da Unimed — só quando o modo de busca é por Nome (não faz
    // sentido cruzar carteirinha digitada contra nome de beneficiário).
    // Puramente informativo: mostra quem mais tem nome parecido lá na
    // Unimed, pra conferência visual — não seleciona nada sozinho.
    const modoAtual = document.querySelector('input[name="vinculo-modo-busca"]:checked').value;
    const caixaSugestoes = document.getElementById('vinculo-sugestoes-unimed');
    if(modoAtual !== 'nome' || termo.length < 2){
      caixaSugestoes.style.display = 'none';
    } else {
      setTimeout(async ()=>{
        const respSug = await api('buscarBeneficiariosUnimedPorNome', {termo});
        const lista = document.getElementById('vinculo-sugestoes-lista');
        if(!respSug.ok || !respSug.beneficiarios || respSug.beneficiarios.length===0){
          caixaSugestoes.style.display = 'none';
          return;
        }
        lista.innerHTML = respSug.beneficiarios.map(b=>
          `<div style="font-size:13px;color:var(--ink-600);padding:3px 0;">
            ${b.nome_beneficiario} <span class="mono" style="color:var(--ink-400);font-size:11.5px;">(${b.cartao_beneficiario})</span>
          </div>`
        ).join('');
        caixaSugestoes.style.display = 'block';
      }, 300);
    }
  });

  document.querySelectorAll('input[name="vinculo-modo-busca"]').forEach(radio=>{
    radio.addEventListener('change', ()=>{
      document.getElementById('vinculo-busca-paciente').value = '';
      vinculoPacienteEscolhido = null;
      atualizarBotaoConfirmarVinculo();
      document.getElementById('vinculo-sugestoes-unimed').style.display = 'none';
    });
  });

  document.getElementById('botao-confirmar-vinculo').addEventListener('click', async ()=>{
    if(!vinculoBeneficiarioAtual || !vinculoPacienteEscolhido) return;
    const botao = document.getElementById('botao-confirmar-vinculo');
    botao.disabled = true; botao.textContent = 'Salvando...';
    const resp = await api('confirmarVinculoPaciente', {
      cartao_beneficiario: vinculoBeneficiarioAtual.cartao_beneficiario,
      nome_beneficiario: vinculoBeneficiarioAtual.nome_beneficiario,
      paciente_id: vinculoPacienteEscolhido.id
    });
    botao.disabled = false; botao.textContent = 'Confirmar vínculo';
    if(!resp.ok){ alert(resp.erro || 'Não foi possível vincular.'); return; }
    await carregarProximoBeneficiario();
  });

  document.getElementById('botao-pular-vinculo').addEventListener('click', async ()=>{
    if(!vinculoBeneficiarioAtual) return;
    await api('pularBeneficiarioVinculo', {
      cartao_beneficiario: vinculoBeneficiarioAtual.cartao_beneficiario,
      nome_beneficiario: vinculoBeneficiarioAtual.nome_beneficiario
    });
    await carregarProximoBeneficiario();
  });
}

function atualizarBotaoConfirmarVinculo(){
  document.getElementById('botao-confirmar-vinculo').disabled = !vinculoPacienteEscolhido;
}

async function carregarProximoBeneficiario(){
  const resp = await api('obterProximoBeneficiarioPendente', {});
  const conteudo = document.getElementById('vinculo-conteudo');
  const semPendentes = document.getElementById('vinculo-sem-pendentes');
  if(!resp.ok){
    conteudo.innerHTML = `<p class="vazio">${resp.erro||'Não foi possível carregar.'}</p>`;
    return;
  }
  document.getElementById('vinculo-restantes-contador').textContent = resp.restantes ? `${resp.restantes} restantes.` : '';
  vinculoBeneficiarioAtual = resp.beneficiario;
  vinculoPacienteEscolhido = null;

  if(!resp.beneficiario){
    conteudo.style.display = 'none';
    semPendentes.style.display = 'block';
    return;
  }
  conteudo.style.display = 'block';
  semPendentes.style.display = 'none';
  document.getElementById('vinculo-nome-beneficiario').textContent = resp.beneficiario.nome_beneficiario || '(nome não informado)';
  document.getElementById('vinculo-cartao-beneficiario').textContent = resp.beneficiario.cartao_beneficiario;
  document.getElementById('vinculo-busca-paciente').value = '';
  document.getElementById('vinculo-resultados').style.display = 'none';
  document.getElementById('vinculo-selecionado').style.display = 'none';
  document.getElementById('vinculo-sugestoes-unimed').style.display = 'none';
  atualizarBotaoConfirmarVinculo();
}
