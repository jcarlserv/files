/* =====================================================================
   ProdClin — app-init.js
   Inicialização do app após o login (iniciarApp), navegação entre abas, preenchimento dos
   selects de período e a definição/leitura compartilhada dos campos de formulário
   (Lançamento + Modal).
   Este arquivo é carregado via <script src> em index.html, na mesma ordem
   em que aparecia originalmente dentro do <script> único — variáveis e
   funções continuam compartilhando o escopo global, exatamente como antes.
===================================================================== */



/* ---------------------------------------------------------------------
   INICIALIZAÇÃO DO APP (pós-login)
--------------------------------------------------------------------- */
async function iniciarApp(){
  document.getElementById('tela-login').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('faixa-demo').style.display = MODO_DEMO ? 'block' : 'none';
  document.getElementById('nome-usuario-topo').textContent = estado.nomeProfissional || estado.usuario;


  try{
    const listasResp = await api('listarListas');
    if(!listasResp.ok) throw new Error(listasResp.erro || 'A planilha não respondeu como esperado.');
    estado.listas = listasResp.listas || {};

    // Cadastro de Pacientes/Profissionais (ver conversa de criação) — só a
    // lista de profissionais é carregada inteira aqui (são poucos, ~30);
    // pacientes fica só sob busca (são milhares), ver buscarPacientes.
    // Usado pra resolver profissional_id por nome na hora de salvar um
    // lançamento — ver resolverVinculosPacienteProfissional.
    try{
      const respProf = await api('listarProfissionaisCadastro', {});
      estado.profissionaisCadastro = respProf.ok ? (respProf.profissionais||[]) : [];
    }catch(e){ estado.profissionaisCadastro = []; }


    // Cadastro de andar/procedimento/exame/atendente por profissional (ver
    // histórico de decisões) — carregado uma vez aqui e usado pra travar/
    // filtrar os campos Andar, Procedimento, Exame e Atendente no
    // Lançamento e no modal de edição. Se alguma tabela ainda não existir
    // no Supabase, não trava a aplicação inteira: só segue com o cadastro
    // vazio (equivalente a "ninguém tem nada cadastrado ainda", que já é
    // tratado como bloqueio no formulário — ver
    // aplicarTravasCondicionadasDoFormulario, exceto pra Exame, que não é
    // obrigatório).
    try{
      const [respAndares, respProcedimentos, respExames, respAtendentes] = await Promise.all([
        api('listarProfissionaisAndares', {}),
        api('listarProfissionaisProcedimentos', {}),
        api('listarProfissionaisExames', {}),
        api('listarAtendentesProfissionais', {})
      ]);
      estado.profissionaisAndares = agruparProfPorCampo(respAndares.ok ? respAndares.linhas : [], 'andar');
      estado.profissionaisProcedimentos = agruparProfPorCampo(respProcedimentos.ok ? respProcedimentos.linhas : [], 'procedimento');
      estado.profissionaisExames = agruparProfPorCampo(respExames.ok ? respExames.linhas : [], 'exame');
      const linhasAtendentes = respAtendentes.ok ? respAtendentes.linhas : [];
      estado.atendentesProfissionais = agruparProfPorCampo(linhasAtendentes, 'prof', 'atendente');
      estado.profissionaisAtendentes = agruparProfPorCampo(linhasAtendentes, 'atendente', 'prof');
    }catch(e){
      estado.profissionaisAndares = {};
      estado.profissionaisProcedimentos = {};
      estado.profissionaisExames = {};
      estado.atendentesProfissionais = {};
      estado.profissionaisAtendentes = {};
    }
  }catch(e){
    mostrarErroInicializacao('Não foi possível carregar as listas do banco (' + (e.message||e) + '). Confira se SUPABASE_URL e SUPABASE_ANON_KEY estão corretos e se as políticas de RLS estão liberando leitura na tabela "listas".');
    return;
  }


  try{
    montarNavegacao();
    preencherSelectsPeriodo();
    montarFormularioLancamento();
    prepararModalPacienteGlobal();
    await atualizarPainelAtivo();
  }catch(e){
    mostrarErroInicializacao('Algo deu errado ao montar as telas (' + (e.message||e) + '). Tente sair e entrar de novo; se persistir, avise o suporte.');
  }
}


// Mostra um erro visível DENTRO do sistema (não escondido atrás da tela de
// login, que já foi ocultada nesse ponto) — assim dá pra saber exatamente
// o que travou, em vez de só uma tela em branco sem explicação.
function mostrarErroInicializacao(mensagem){
  const main = document.querySelector('main');
  if(main) main.innerHTML = `<div class="cartao" style="border:1.5px solid var(--danger);max-width:640px;">
    <h3 style="color:var(--danger);margin:0 0 10px;">Não foi possível carregar o sistema</h3>
    <p style="color:var(--ink-600);margin:0 0 14px;">${mensagem}</p>
    <button class="botao sutil" onclick="location.reload()">Tentar de novo</button>
  </div>`;
}


/* ---------------------------------------------------------------------
   NAVEGAÇÃO ENTRE ABAS
--------------------------------------------------------------------- */
function montarNavegacao(){
  const nav = document.getElementById('nav-abas');
  const TODAS_ABAS = [
    {id:'inicio', rotulo:'Início', chave:'ver_inicio'},
    {id:'lancamento', rotulo:'Lançamento', chave:['ver_lancamento','ver_parametros_cadastros']},
    {id:'verificacao', rotulo:'Verificação', chave:['ver_verificar','ver_critica']},
    {id:'dashboard', rotulo:'Dashboard', chave:['ver_rmr','ver_rmr_squad','ver_metas']},
    {id:'financeiro', rotulo:'Financeiro', chave:'ver_financeiro'},
    {id:'estoque', rotulo:'Estoque', chave:'ver_estoque'},
    {id:'configuracoes', rotulo:'Configurações', chave:'ver_configuracoes'}
  ];
  // `chave` pode ser uma chave só, ou uma lista — nesse caso a aba aparece se
  // o usuário tiver QUALQUER UMA delas (é o caso das abas que reúnem mais de
  // uma tela antiga em sub-abas: Verificação e Dashboard).
  const temAlgumaPermissao = chave => Array.isArray(chave) ? chave.some(c=>temPermissao(c)) : temPermissao(chave);
  const abasDisponiveis = TODAS_ABAS.filter(a => temAlgumaPermissao(a.chave));
  nav.innerHTML = '';
  abasDisponiveis.forEach((a,i)=>{
    const botao = document.createElement('button');
    botao.className = 'aba' + (i===0 ? ' ativa':'');
    botao.textContent = a.rotulo;
    botao.dataset.aba = a.id;
    botao.addEventListener('click', ()=>trocarAba(a.id));
    nav.appendChild(botao);
  });
  estado.abaAtiva = abasDisponiveis.length ? abasDisponiveis[0].id : 'lancamento';
  const painelAtivo = document.getElementById('painel-'+estado.abaAtiva);
  if(painelAtivo) painelAtivo.classList.add('ativo');
  if(estado.abaAtiva==='verificacao') montarSubNavVerificacao();
  if(estado.abaAtiva==='dashboard') montarSubNavDashboard();
}

/* ---------------------------------------------------------------------
   SUB-ABAS — usadas dentro de "Verificação" (Verificar/Crítica) e
   "Dashboard" (Análises/RMR/Metas), que reúnem telas que antes eram abas
   separadas no topo. Mesmo mecanismo de show/hide das abas principais,
   só que escopado a um grupo (só uma .sub-painel de cada grupo por vez).
--------------------------------------------------------------------- */
function montarSubNav(containerId, subAbas, grupo){
  const container = document.getElementById(containerId);
  const disponiveis = subAbas.filter(s => temPermissao(s.chave));
  container.innerHTML = '';
  disponiveis.forEach((s,i)=>{
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'sub-aba' + (i===0 ? ' ativa' : '');
    botao.textContent = s.rotulo;
    botao.dataset.subaba = s.id;
    botao.addEventListener('click', ()=>trocarSubAba(grupo, s.id, subAbas));
    container.appendChild(botao);
  });
  if(disponiveis.length){
    estado[grupo] = disponiveis[0].id;
    document.getElementById('painel-'+disponiveis[0].id).classList.add('ativa');
  }
}

async function trocarSubAba(grupo, subId, subAbas){
  estado[grupo] = subId;
  const idsDoGrupo = subAbas.map(s=>s.id);
  idsDoGrupo.forEach(id=>{
    const el = document.getElementById('painel-'+id);
    if(el) el.classList.toggle('ativa', id===subId);
  });
  const containerId = grupo==='subAbaVerificacao' ? 'subnav-verificacao' : 'subnav-dashboard';
  document.querySelectorAll(`#${containerId} .sub-aba`).forEach(b=>{
    b.classList.toggle('ativa', b.dataset.subaba===subId);
  });
  await atualizarSubAbaAtiva(subId);
}

const SUB_ABAS_VERIFICACAO = [
  {id:'editar', rotulo:'Verificar', chave:'ver_verificar'},
  {id:'critica', rotulo:'Crítica', chave:'ver_critica'}
];
const SUB_ABAS_DASHBOARD = [
  {id:'rmr', rotulo:'Análises', chave:'ver_rmr'},
  {id:'rmr-squad', rotulo:'RMR', chave:'ver_rmr_squad'},
  {id:'metas', rotulo:'Metas', chave:'ver_metas'}
];
function montarSubNavVerificacao(){ montarSubNav('subnav-verificacao', SUB_ABAS_VERIFICACAO, 'subAbaVerificacao'); }
function montarSubNavDashboard(){ montarSubNav('subnav-dashboard', SUB_ABAS_DASHBOARD, 'subAbaDashboard'); }

// Chama a função de atualização de dados de quem já existia pra cada sub-aba
// — mesmo nome de função de sempre, só que agora despachado por aqui.
async function atualizarSubAbaAtiva(subId){
  if(subId==='editar') await atualizarEditar();
  if(subId==='critica') await atualizarCritica();
  if(subId==='rmr') await atualizarRMR();
  if(subId==='rmr-squad') await atualizarRmrSquad();
  if(subId==='metas') await atualizarMetas();
}


async function trocarAba(idAba){
  estado.abaAtiva = idAba;
  document.querySelectorAll('.aba').forEach(b=>b.classList.toggle('ativa', b.dataset.aba===idAba));
  document.querySelectorAll('.painel').forEach(p=>p.classList.remove('ativo'));
  document.getElementById('painel-'+idAba).classList.add('ativo');
  // Só monta a sub-nav a primeira vez que a aba é aberta — depois disso, a
  // sub-aba escolhida fica como estava (o painel dela nunca perde a classe
  // .ativa só por trocar de aba principal e voltar).
  if(idAba==='verificacao' && !estado.subAbaVerificacao) montarSubNavVerificacao();
  if(idAba==='dashboard' && !estado.subAbaDashboard) montarSubNavDashboard();
  await atualizarPainelAtivo();
}


async function atualizarPainelAtivo(){
  if(estado.abaAtiva==='inicio') await atualizarInicio();
  if(estado.abaAtiva==='lancamento') await atualizarAbaLancamento();
  if(estado.abaAtiva==='verificacao') await atualizarSubAbaAtiva(estado.subAbaVerificacao);
  if(estado.abaAtiva==='configuracoes') await atualizarConfiguracoes();
  if(estado.abaAtiva==='dashboard') await atualizarSubAbaAtiva(estado.subAbaDashboard);
  if(estado.abaAtiva==='financeiro') await atualizarFinanceiro();
  if(estado.abaAtiva==='estoque') await atualizarEstoque();
}


/* ---------------------------------------------------------------------
   SELECTS DE PERÍODO (mês / ano) reaproveitados em gerencial e dashboard
--------------------------------------------------------------------- */
const DIMENSOES_ANALISE = [
  {chave:'prof', rotulo:'Profissional'},
  {chave:'andar', rotulo:'Andar'},
  {chave:'convenio', rotulo:'Convênio'},
  {chave:'procedimento', rotulo:'Atendimento'},
  {chave:'atendente', rotulo:'Atendente'},
  {chave:'turno', rotulo:'Turno'},
  {chave:'forma_pagamento', rotulo:'Forma de pagamento'},
  {chave:'biopsias', rotulo:'Biópsia (frascos)'},
  {chave:'exames', rotulo:'Exame'}
];


const CAMPOS_CRITICOS = [
  {chave:'prof', rotulo:'Profissional'},
  {chave:'andar', rotulo:'Andar'},
  {chave:'data', rotulo:'Data'},
  {chave:'turno', rotulo:'Turno'},
  {chave:'paciente', rotulo:'Paciente'},
  {chave:'procedimento', rotulo:'Atendimento'},
  {chave:'convenio', rotulo:'Convênio'},
  {chave:'valor', rotulo:'Valor'},
  {chave:'forma_pagamento', rotulo:'Forma de pagamento'},
  {chave:'atendente', rotulo:'Atendente'}
];


// Retorno e Cortesia não são cobrados — então Valor e Forma de pagamento não
// contam como pendência (nem como obrigatórios no formulário) quando
// QUALQUER UM desses 3 campos (Procedimento, Convênio ou Forma de
// pagamento) tiver um desses dois valores. Antes só olhava Procedimento e só
// reconhecia "RETORNO" — por isso lançamentos de Cortesia travavam ao
// salvar (a validação de Forma de pagamento continuava exigindo valor>0).
const CAMPOS_DISPENSADOS_SEM_COBRANCA = ['valor','forma_pagamento'];
const VALORES_SEM_COBRANCA = ['RETORNO','CORTESIA'];
function ehValorSemCobranca(valor){
  return VALORES_SEM_COBRANCA.includes(String(valor||'').trim().toUpperCase());
}
function registroSemCobranca(registro){
  return ehValorSemCobranca(registro.procedimento) ||
         ehValorSemCobranca(registro.convenio) ||
         ehValorSemCobranca(registro.forma_pagamento);
}


function campoCriticoVazio(registro, chave){
  if(CAMPOS_DISPENSADOS_SEM_COBRANCA.includes(chave) && registroSemCobranca(registro)){
    return false;
  }
  const v = registro[chave];
  if(chave==='valor'){
    return v===undefined || v===null || v==='' || Number(v)===0 || isNaN(Number(v));
  }
  return v===undefined || v===null || String(v).trim()==='';
}


function preencherSelectsPeriodo(){
  const hoje = new Date();
  const mesAtual = MESES[hoje.getMonth()];
  const anoAtual = hoje.getFullYear();
  const anos = [anoAtual-1, anoAtual, anoAtual+1];


  // A aba Editar usa só o intervalo de datas — começa preenchida com o mês atual inteiro.
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0);
  const paraISO = d => d.toISOString().slice(0,10);
  document.getElementById('filtro-data-inicio').value = paraISO(primeiroDiaMes);
  document.getElementById('filtro-data-fim').value = paraISO(ultimoDiaMes);


  [['filtro-mes-metas'],['filtro-mes-critica']].forEach(([id])=>{
    const sel = document.getElementById(id);
    sel.innerHTML = MESES.map(m=>`<option value="${m}" ${m===mesAtual?'selected':''}>${m}</option>`).join('');
    sel.addEventListener('change', atualizarPainelAtivo);
  });
  [['filtro-ano-metas'],['filtro-ano-critica']].forEach(([id])=>{
    const sel = document.getElementById(id);
    sel.innerHTML = anos.map(a=>`<option value="${a}" ${a===anoAtual?'selected':''}>${a}</option>`).join('');
    sel.addEventListener('change', atualizarPainelAtivo);
  });


  const filtroProf = document.getElementById('filtro-prof-gerencial');
  filtroProf.innerHTML = '<option value="">Todos</option>' +
    (estado.listas.profissionais||[]).map(p=>`<option value="${p}">${p}</option>`).join('');
  filtroProf.addEventListener('change', atualizarPainelAtivo);


  const filtroAndarGerencial = document.getElementById('filtro-andar-gerencial');
  filtroAndarGerencial.innerHTML = '<option value="">Todos</option>' +
    (estado.listas.andares||[]).map(a=>`<option value="${a}">${a}</option>`).join('');
  filtroAndarGerencial.addEventListener('change', atualizarEditar);


  montarMultiselectConvenio();


  const filtroFormaPagamentoGerencial = document.getElementById('filtro-forma-pagamento-gerencial');
  filtroFormaPagamentoGerencial.innerHTML = '<option value="">Todas</option>' +
    (estado.listas.formas_pagamento||[]).map(f=>`<option value="${f}">${f}</option>`).join('');
  filtroFormaPagamentoGerencial.addEventListener('change', atualizarEditar);


  const filtroExameGerencial = document.getElementById('filtro-exame-gerencial');
  filtroExameGerencial.innerHTML = '<option value="">Todos</option>' +
    (estado.listas.exames||[]).map(e=>`<option value="${e}">${e}</option>`).join('');
  filtroExameGerencial.addEventListener('change', atualizarEditar);


  const filtroProcedimentoGerencial = document.getElementById('filtro-procedimento-gerencial');
  filtroProcedimentoGerencial.innerHTML = '<option value="">Todos</option>' +
    (estado.listas.procedimentos||[]).map(p=>`<option value="${p}">${p}</option>`).join('');
  filtroProcedimentoGerencial.addEventListener('change', atualizarEditar);


  // Paciente é busca por texto (não é lista fixa) — atualiza a cada
  // digitação, igual à busca já existente na tabela nominal do RMR.
  document.getElementById('filtro-paciente-gerencial').addEventListener('input', atualizarEditar);


  const filtroProfCritica = document.getElementById('filtro-prof-critica');
  if(estado.papel==='profissional'){
    document.getElementById('campo-prof-critica').style.display = 'none';
  } else {
    filtroProfCritica.innerHTML = '<option value="">Todos</option>' +
      (estado.listas.profissionais||[]).map(p=>`<option value="${p}">${p}</option>`).join('');
    filtroProfCritica.addEventListener('change', atualizarPainelAtivo);
  }


  const filtroProfEvolucao = document.getElementById('filtro-prof-evolucao');
  filtroProfEvolucao.innerHTML = '<option value="">Todos (somado)</option>' +
    (estado.listas.profissionais||[]).map(p=>`<option value="${p}">${p}</option>`).join('');
  filtroProfEvolucao.addEventListener('change', atualizarEvolucaoAno);


  document.getElementById('botao-novo-registro-gerencial').addEventListener('click', ()=>abrirModal(null, [], 'verificar'));
  // "+ Novo registro" segue a permissão fragmentada criar_verificar (gerente sempre tem).
  document.getElementById('botao-novo-registro-gerencial').style.display = temPermissao('criar_verificar') ? 'inline-flex' : 'none';
  document.getElementById('botao-salvar-nota').addEventListener('click', salvarNota);
  document.querySelectorAll('.botao-exportar-pdf').forEach(b=>b.addEventListener('click', ()=>window.print()));


  document.getElementById('filtro-data-inicio').addEventListener('change', atualizarEditar);
  document.getElementById('filtro-data-fim').addEventListener('change', atualizarEditar);
  document.getElementById('botao-limpar-periodo').addEventListener('click', ()=>{
    const hoje = new Date();
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0);
    const paraISO = d => d.toISOString().slice(0,10);
    document.getElementById('filtro-data-inicio').value = paraISO(primeiroDiaMes);
    document.getElementById('filtro-data-fim').value = paraISO(ultimoDiaMes);
    document.getElementById('filtro-prof-gerencial').value = '';
    document.getElementById('filtro-andar-gerencial').value = '';
    estado.conveniosSelecionados = [];
    document.querySelectorAll('#painel-filtro-convenio input[type="checkbox"]').forEach(chk=>chk.checked=false);
    document.getElementById('botao-filtro-convenio').textContent = 'Todos';
    document.getElementById('filtro-forma-pagamento-gerencial').value = '';
    document.getElementById('filtro-exame-gerencial').value = '';
    document.getElementById('filtro-procedimento-gerencial').value = '';
    document.getElementById('filtro-paciente-gerencial').value = '';
    atualizarEditar();
  });


  // Repasse de coparticipados — botão de salvar a configuração (%) do
  // "mês de referência" (derivado da data de início do filtro acima).
  document.getElementById('botao-salvar-repasse').addEventListener('click', salvarConfigRepasseCoparticipados);
}


/* ---------------------------------------------------------------------
   CAMPOS DO FORMULÁRIO (compartilhados entre Lançamento e Modal)
--------------------------------------------------------------------- */
// Lista de "grupos travàveis" pra Configurações → Cadastros → "Campos
// travados por papel". Valor e Forma de pagamento andam juntos como um
// grupo só (chave 'valor', mas trava os dois — ver htmlSecaoFormaPagamento)
// porque são a mesma seção na tela, calculados juntos.
const CAMPOS_TRAVAVEIS = [
  {chave:'prof', rotulo:'Profissional'},
  {chave:'andar', rotulo:'Andar'},
  {chave:'data', rotulo:'Data'},
  {chave:'turno', rotulo:'Turno'},
  {chave:'paciente', rotulo:'Paciente'},
  {chave:'protocolo', rotulo:'Protocolo de realização'},
  {chave:'procedimento', rotulo:'Atendimento'},
  {chave:'exames', rotulo:'Exame'},
  {chave:'biopsias', rotulo:'Biópsia (frascos)'},
  {chave:'convenio', rotulo:'Convênio'},
  {chave:'carteirinha', rotulo:'Carteirinha'},
  {chave:'atendente', rotulo:'Atendente'},
  {chave:'valor', rotulo:'Valor / Forma de pagamento'}
];


// Campo travado por configuração (Configurações → Cadastros → "Campos
// travados por papel") — funciona junto com as travas fixas que já
// existiam (ex.: Profissional travado com o próprio nome pra quem é
// profissional). Gerente nunca é afetado por essa trava, só
// atendente/profissional.
function campoTravadoPorConfig(chave){
  if(estado.papel==='gerente') return false;
  const lista = estado.camposTravados[estado.papel] || [];
  return lista.includes(chave);
}

function definicaoCampos(){
  const L = estado.listas;
  return [
    {chave:'prof', rotulo:'Profissional', tipo:'select', opcoes:L.profissionais, obrigatorio:true,
      travado: estado.papel==='profissional' || campoTravadoPorConfig('prof')},
    {chave:'andar', rotulo:'Andar', tipo:'select', opcoes:L.andares, obrigatorio:true, travado: campoTravadoPorConfig('andar')},
    {chave:'data', rotulo:'Data', tipo:'date', obrigatorio:true, travado: campoTravadoPorConfig('data')},
    {chave:'turno', rotulo:'Turno', tipo:'select', opcoes:L.turnos, obrigatorio:true, travado: campoTravadoPorConfig('turno')},
    {chave:'paciente', rotulo:'Paciente (nome completo)', tipo:'autocomplete', obrigatorio:true, travado: campoTravadoPorConfig('paciente')},
    {chave:'protocolo', rotulo:'Protocolo de realização', tipo:'text', travado: campoTravadoPorConfig('protocolo')},
    {chave:'procedimento', rotulo:'Atendimento', tipo:'select', opcoes:L.procedimentos, obrigatorio:true, travado: campoTravadoPorConfig('procedimento')},
    {chave:'exames', rotulo:'Exame', tipo:'select', opcoes:L.exames, travado: campoTravadoPorConfig('exames')},
    {chave:'biopsias', rotulo:'Biópsia (frascos)', tipo:'select', opcoes:L.biopsias_frascos, travado: campoTravadoPorConfig('biopsias')},
    {chave:'convenio', rotulo:'Convênio', tipo:'select', opcoes:L.convenios, obrigatorio:true, travado: campoTravadoPorConfig('convenio')},
    {chave:'carteirinha', rotulo:'Carteirinha', tipo:'text', travado: campoTravadoPorConfig('carteirinha')},
    {chave:'atendente', rotulo:'Atendente', tipo:'select', opcoes:L.atendentes, obrigatorio:true, travado: campoTravadoPorConfig('atendente')}
    // "valor" e "forma_pagamento" saíram daqui — agora são calculados a partir
    // da seção de "Forma de pagamento" (que suporta pagamento dividido em mais
    // de uma forma). Ver htmlSecaoFormaPagamento / lerLinhasPagamento abaixo.
    // Essas duas também são travadas por config, mas em outro lugar — ver
    // htmlSecaoFormaPagamento e a trava de "valor"/"forma_pagamento" nela.
  ];
}


/* ---------------------------------------------------------------------
   FORMA DE PAGAMENTO — seção com uma ou mais linhas de "forma + valor",
   compartilhada entre o formulário de Lançamento (prefixo 'campo_') e o
   modal de edição (prefixo 'modal_'). Permite pagamento dividido (ex.:
   parte em dinheiro, parte no cartão) dentro do MESMO lançamento — sem
   duplicar o procedimento. O valor total do lançamento é sempre a soma
   das linhas preenchidas.
--------------------------------------------------------------------- */
function htmlSecaoFormaPagamento(prefixo, destacar=false){
  const travado = campoTravadoPorConfig('valor') || campoTravadoPorConfig('forma_pagamento');
  return `<div class="campo${destacar?' campo-pendente':''}" style="grid-column:1/-1;">
    <label>Forma de pagamento *${destacar?' <span class="tag tag-alerta" style="margin-left:4px;">preencher</span>':''}</label>
    <div id="${prefixo}pagamentos-linhas" class="linhas-pagamento" data-travado="${travado?'1':''}"></div>
    <div style="display:flex;align-items:center;gap:14px;margin-top:8px;flex-wrap:wrap;">
      <button type="button" class="botao sutil pequeno" id="${prefixo}botao-add-pagamento" ${travado?'style="display:none;"':''}>+ Adicionar forma de pagamento</button>
      <span style="font-size:13px;color:var(--ink-600);">Total: <b class="mono" id="${prefixo}pagamento-total">R$ 0,00</b></span>
    </div>
  </div>`;
}


function criarLinhaPagamentoHTML(forma='', valor='', travado=false){
  const opcoes = (estado.listas.formas_pagamento||[])
    .map(f=>`<option value="${f}" ${f===forma?'selected':''}>${f}</option>`).join('');
  const desabilitado = travado ? 'disabled' : '';
  return `<div class="linha-pagamento">
    <select class="input-pagamento-forma" ${desabilitado}><option value="">Selecionar...</option>${opcoes}</select>
    <input type="number" step="0.01" class="input-pagamento-valor" placeholder="Valor (R$)" value="${valor!==''&&valor!==undefined&&valor!==null?valor:''}" ${desabilitado}>
    <button type="button" class="botao-remover-pagamento" title="Remover" ${travado?'style="display:none;"':''}>×</button>
  </div>`;
}


// Monta a seção com as linhas iniciais (array de {forma, valor}, ou uma
// linha vazia por padrão) e liga os eventos por DELEGAÇÃO no container —
// assim adicionar/remover linha nunca duplica listener nas linhas antigas.
function montarSecaoPagamento(prefixo, formasIniciais){
  const container = document.getElementById(prefixo+'pagamentos-linhas');
  if(!container) return;
  const travado = campoTravadoPorConfig('valor') || campoTravadoPorConfig('forma_pagamento');
  const linhas = (formasIniciais && formasIniciais.length) ? formasIniciais : [{forma:'', valor:''}];
  container.innerHTML = linhas.map(l=>criarLinhaPagamentoHTML(l.forma, l.valor, travado)).join('');

  if(travado) return; // não religa os eventos de editar — campo travado por config

  container.addEventListener('input', (ev)=>{
    if(ev.target.classList.contains('input-pagamento-valor')) atualizarTotalPagamento(prefixo);
  });
  container.addEventListener('click', (ev)=>{
    const botao = ev.target.closest('.botao-remover-pagamento');
    if(!botao) return;
    if(container.querySelectorAll('.linha-pagamento').length<=1) return; // sempre deixa pelo menos 1 linha
    botao.closest('.linha-pagamento').remove();
    atualizarTotalPagamento(prefixo);
  });

  atualizarTotalPagamento(prefixo);
}


function adicionarLinhaPagamento(prefixo){
  const container = document.getElementById(prefixo+'pagamentos-linhas');
  if(!container) return;
  container.insertAdjacentHTML('beforeend', criarLinhaPagamentoHTML());
}


function lerLinhasPagamento(prefixo){
  const container = document.getElementById(prefixo+'pagamentos-linhas');
  if(!container) return [];
  return Array.from(container.querySelectorAll('.linha-pagamento'))
    .map(linha=>({
      forma: linha.querySelector('.input-pagamento-forma').value,
      valor: Number(linha.querySelector('.input-pagamento-valor').value)||0
    }))
    // Uma linha só conta se tiver forma escolhida E (valor>0 OU a forma for
    // Retorno/Cortesia, que por definição não cobra nada) — sem o segundo
    // caso, escolher "Retorno" como forma de pagamento e deixar o valor em
    // branco fazia a linha inteira ser descartada, e o registro salvava com
    // forma_pagamento vazio em vez de "Retorno".
    .filter(l=>l.forma && (l.valor>0 || ehValorSemCobranca(l.forma)));
}


// Só as formas escolhidas nas linhas de pagamento, SEM o filtro de valor>0
// (lerLinhasPagamento já filtra isso) — usado só pra checar se alguma linha
// já está com RETORNO/CORTESIA selecionado, mesmo com valor ainda vazio.
function formasPagamentoEscolhidas(prefixo){
  const container = document.getElementById(prefixo+'pagamentos-linhas');
  if(!container) return [];
  return Array.from(container.querySelectorAll('.input-pagamento-forma')).map(sel=>sel.value).filter(Boolean);
}


function atualizarTotalPagamento(prefixo){
  const total = lerLinhasPagamento(prefixo).reduce((s,l)=>s+l.valor,0);
  const el = document.getElementById(prefixo+'pagamento-total');
  if(el) el.textContent = formatarMoeda(total);
}


/* Confere os campos marcados obrigatorio:true num formulário (Lançamento ou Modal) e
   devolve a lista de rótulos que estão vazios — usada para bloquear o salvamento de
   verdade (o "*" no rótulo, sozinho, era só visual e não impedia salvar em branco). */
function camposObrigatoriosFaltando(prefixo){
  const elProcedimento = document.getElementById(prefixo+'procedimento');
  const elConvenio = document.getElementById(prefixo+'convenio');
  const dispensarCobranca = ehValorSemCobranca(elProcedimento ? elProcedimento.value : '') ||
    ehValorSemCobranca(elConvenio ? elConvenio.value : '') ||
    formasPagamentoEscolhidas(prefixo).some(ehValorSemCobranca);


  const faltando = definicaoCampos()
    .filter(c => c.obrigatorio)
    .filter(c => {
      // Paciente (autocompletar) — não basta ter texto digitado, precisa
      // ter vindo de uma seleção de verdade na lista (ver pedido do
      // usuário: nada de criar paciente novo só digitando o nome aqui).
      if(c.tipo === 'autocomplete'){
        const elId = document.getElementById(prefixo+c.chave+'_id');
        return !elId || !elId.value;
      }
      const el = document.getElementById(prefixo+c.chave);
      return !el || String(el.value||'').trim()==='';
    })
    .map(c => c.rotulo);


  // "Forma de pagamento" agora é validada à parte (precisa de pelo menos uma
  // linha com forma selecionada e valor > 0), exceto quando o procedimento é
  // RETORNO — mesma dispensa que já existia para valor/forma_pagamento antes.
  if(!dispensarCobranca){
    const total = lerLinhasPagamento(prefixo).reduce((s,l)=>s+l.valor,0);
    if(total<=0) faltando.push('Forma de pagamento');
  }


  return faltando;
}


function renderizarCampo(campo, valorAtual='', prefixo='campo_', destacar=false){
  const id = prefixo+campo.chave;
  let controle;
  if(campo.tipo==='select'){
    const opcoes = (campo.opcoes||[]).map(o=>`<option value="${o}" ${o===valorAtual?'selected':''}>${o||'—'}</option>`).join('');
    controle = `<select id="${id}" ${campo.travado?'disabled':''}><option value="">Selecionar...</option>${opcoes}</select>`;
  } else if(campo.tipo==='autocomplete'){
    // Busca em tempo real no cadastro (hoje só usado pra Paciente) — o
    // nome digitado fica no input visível, o id do cadastro (se veio de
    // uma seleção) fica num input escondido. Ver ligarAutocompletePaciente.
    // Só aceita quem já está cadastrado — não cria paciente novo digitando
    // (ver camposObrigatoriosFaltando, que bloqueia salvar sem seleção).
    // Pra paciente que chega na hora sem cadastro ainda, o botão "+ Novo"
    // abre o mesmo modal de Cadastro de Pacientes sem sair da tela — ao
    // salvar, volta e já preenche esse campo com quem acabou de cadastrar.
    controle = `<div style="display:flex;gap:8px;align-items:flex-start;">
      <div style="position:relative;flex:1;">
        <input type="text" id="${id}" value="${valorAtual!==undefined?valorAtual:''}" autocomplete="off" ${campo.travado?'disabled':''}>
        <input type="hidden" id="${id}_id" value="${campo.idAtual||''}">
        <div id="${id}-resultados" class="autocomplete-resultados" style="display:none;position:absolute;z-index:30;top:100%;left:0;right:0;background:#fff;border:1.5px solid var(--line);border-radius:9px;box-shadow:var(--shadow);max-height:220px;overflow-y:auto;margin-top:4px;"></div>
        ${campo.travado?'':'<div style="font-size:11px;color:var(--ink-400);margin-top:4px;">Digite pra buscar quem já está cadastrado, ou clique em "+ Novo" ao lado.</div>'}
        <div id="${id}-info" class="mono" style="display:none;font-size:12px;color:var(--ink-600);margin-top:6px;background:var(--rose-100);padding:6px 10px;border-radius:6px;"></div>
      </div>
      ${campo.travado?'':`<button type="button" class="botao sutil pequeno botao-novo-paciente-rapido" data-alvo="${id}" style="white-space:nowrap;">+ Novo</button>`}
    </div>`;
  } else {
    controle = `<input type="${campo.tipo}" id="${id}" value="${valorAtual!==undefined?valorAtual:''}" ${campo.travado?'disabled':''} ${campo.tipo==='number'?'step="0.01"':''}/>`;
  }
  return `<div class="campo${destacar?' campo-pendente':''}"><label>${campo.rotulo}${campo.obrigatorio?' *':''}${destacar?' <span class="tag tag-alerta" style="margin-left:4px;">preencher</span>':''}</label>${controle}</div>`;
}


// Liga a busca-enquanto-digita do campo Paciente (autocompletar). Chamado
// depois que o campo já está no DOM (Lançamento e Modal). Selecionar um
// resultado preenche o nome E guarda o id; editar o texto depois de
// selecionado LIMPA o id (evita salvar um paciente errado se a pessoa
// corrigir o nome na mão).
// Preenche o que dá pra puxar do cadastro do paciente assim que ele é
// selecionado: Convênio e Carteirinha (campos de verdade do lançamento,
// a pessoa pode sobrescrever se esse atendimento específico for
// diferente) + uma linha de referência com Data de Nascimento e CPF (só
// informativo, não é salvo no lançamento — o dado mora no cadastro do
// paciente, aqui é só pra facilitar conferir na hora).
function preencherCamposDerivadosPaciente(prefixo, paciente, opcoes){
  const sobrescrever = !opcoes || opcoes.sobrescreverConvenioCarteirinha !== false;
  const elConvenio = document.getElementById(prefixo+'convenio');
  const elCarteirinha = document.getElementById(prefixo+'carteirinha');
  const elInfo = document.getElementById(prefixo+'paciente-info');
  if(!paciente){
    if(elInfo){ elInfo.style.display = 'none'; elInfo.textContent = ''; }
    return;
  }
  if(sobrescrever){
    if(elConvenio && paciente.convenio) elConvenio.value = paciente.convenio;
    if(elCarteirinha && paciente.carteirinha) elCarteirinha.value = paciente.carteirinha;
  }
  if(elInfo){
    const partes = [];
    if(paciente.data_nascimento) partes.push(`Nascimento: ${formatarNascimentoComIdade(paciente.data_nascimento)}`);
    if(paciente.cpf) partes.push(`CPF: ${paciente.cpf}`);
    if(partes.length){
      elInfo.textContent = partes.join('  •  ');
      elInfo.style.display = 'block';
    } else {
      elInfo.style.display = 'none';
    }
  }
}

function ligarAutocompletePaciente(prefixo){
  const input = document.getElementById(prefixo+'paciente');
  const inputId = document.getElementById(prefixo+'paciente_id');
  const resultados = document.getElementById(prefixo+'paciente-resultados');
  if(!input || input.disabled) return;

  let timeoutBusca = null;
  let cachePacientesBusca = {}; // id -> objeto completo, pra achar depois de clicar
  input.addEventListener('input', ()=>{
    inputId.value = ''; // qualquer edição manual invalida a seleção anterior
    preencherCamposDerivadosPaciente(prefixo, null);
    clearTimeout(timeoutBusca);
    const termo = input.value.trim();
    if(termo.length < 2){ resultados.style.display = 'none'; return; }
    timeoutBusca = setTimeout(async ()=>{
      const resp = await api('buscarPacientes', {termo});
      if(!resp.ok || !resp.pacientes || resp.pacientes.length===0){ resultados.style.display = 'none'; return; }
      cachePacientesBusca = {};
      resp.pacientes.forEach(p=>{ cachePacientesBusca[p.id] = p; });
      resultados.innerHTML = resp.pacientes.map(p=>
        `<div class="autocomplete-item" data-id="${p.id}" data-nome="${p.nome.replace(/"/g,'&quot;')}" style="padding:9px 12px;cursor:pointer;font-size:13.5px;border-bottom:1px solid var(--line);">${p.nome}</div>`
      ).join('');
      resultados.style.display = 'block';
      resultados.querySelectorAll('.autocomplete-item').forEach(item=>{
        item.addEventListener('mousedown', (ev)=>{ // mousedown, não click — dispara antes do blur do input
          ev.preventDefault();
          input.value = item.dataset.nome;
          inputId.value = item.dataset.id;
          resultados.style.display = 'none';
          preencherCamposDerivadosPaciente(prefixo, cachePacientesBusca[item.dataset.id]);
        });
        item.addEventListener('mouseenter', ()=>{ item.style.background='var(--rose-100)'; });
        item.addEventListener('mouseleave', ()=>{ item.style.background=''; });
      });
    }, 300);
  });
  input.addEventListener('blur', ()=> setTimeout(()=>{ resultados.style.display = 'none'; }, 150));
}


// Liga o botão "+ Novo" que aparece do lado do campo Paciente — abre o
// mesmo modal de Cadastro de Pacientes (em configuracoes.js), sem sair da
// tela de Lançamento/Modal. Ao salvar, o modal já preenche esse campo
// específico com quem acabou de ser cadastrado (ver abrirModalPaciente).
function ligarBotaoNovoPacienteRapido(prefixo){
  const idCampo = prefixo+'paciente';
  const botao = document.querySelector(`.botao-novo-paciente-rapido[data-alvo="${idCampo}"]`);
  if(botao) botao.addEventListener('click', ()=> abrirModalPaciente(null, idCampo));
}


// Garante que o registro tem paciente_id e profissional_id preenchidos
// antes de salvar — chamado logo depois de lerValoresCampos, tanto no
// Lançamento quanto no Modal.
// - Paciente: se já veio um id da seleção no autocompletar, usa esse. Se
//   o nome foi digitado sem selecionar nada (paciente novo, ou alguém que
//   não apareceu na busca), CRIA o cadastro na hora (criarPaciente é
//   idempotente — se já existir esse nome, reaproveita em vez de duplicar).
// - Profissional: resolve pelo nome contra o cadastro já carregado no
//   login (estado.profissionaisCadastro) — não devia precisar criar
//   nenhum na hora, já que a lista de profissionais vem de um select
//   fechado, não de texto livre.
async function resolverVinculosPacienteProfissional(registro){
  // Paciente NÃO cria mais sozinho aqui — a validação em
  // camposObrigatoriosFaltando já bloqueia o salvamento antes de chegar
  // até aqui se não veio de uma seleção real da lista (pedido do
  // usuário: nada de paciente novo só de digitar o nome no Lançamento).
  // Cadastro de paciente novo passou a ser só pela tela própria
  // (Lançamento → Cadastro de Clientes → "+ Novo paciente").
  const prof = (estado.profissionaisCadastro||[]).find(p => p.nome.trim().toLowerCase() === String(registro.prof||'').trim().toLowerCase());
  registro.profissional_id = prof ? prof.id : null;
  return registro;
}


function lerValoresCampos(prefixo='campo_'){
  const registro = {};
  definicaoCampos().forEach(c=>{
    const el = document.getElementById(prefixo+c.chave);
    registro[c.chave] = el ? el.value : '';
  });
  // Paciente vem via autocompletar — o id (se veio de uma seleção da busca)
  // fica num input escondido ao lado do nome. Ver resolverVinculoPaciente,
  // que preenche isso pra nomes digitados sem seleção (nome novo).
  const elPacienteId = document.getElementById(prefixo+'paciente_id');
  registro.paciente_id = elPacienteId ? (elPacienteId.value || null) : null;


  // Valor total = soma das linhas de pagamento preenchidas. Com uma linha só,
  // continua salvando exatamente como antes (forma_pagamento simples, sem
  // detalhamento) — só grava "MISTO" + o array formas_pagamento quando há
  // de fato mais de uma forma na mesma nota, pra não inflar o banco à toa.
  const linhasPagamento = lerLinhasPagamento(prefixo);
  registro.valor = linhasPagamento.reduce((s,l)=>s+l.valor,0);
  if(linhasPagamento.length===0){
    registro.forma_pagamento = '';
    registro.formas_pagamento = null;
  } else if(linhasPagamento.length===1){
    registro.forma_pagamento = linhasPagamento[0].forma;
    registro.formas_pagamento = null;
  } else {
    registro.forma_pagamento = 'MISTO';
    registro.formas_pagamento = linhasPagamento;
  }
  return registro;
}


