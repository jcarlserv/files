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
    {id:'lancamento', rotulo:'Lançamento', chave:'ver_lancamento'},
    {id:'editar', rotulo:'Verificar', chave:'ver_verificar'},
    {id:'critica', rotulo:'Crítica', chave:'ver_critica'},
    {id:'metas', rotulo:'Metas', chave:'ver_metas'},
    {id:'rmr', rotulo:'Análises', chave:'ver_rmr'},
    {id:'rmr-squad', rotulo:'RMR', chave:'ver_rmr_squad'},
    {id:'financeiro', rotulo:'Financeiro', chave:'ver_financeiro'},
    {id:'configuracoes', rotulo:'Configurações', chave:'ver_configuracoes'}
  ];
  const abasDisponiveis = TODAS_ABAS.filter(a => temPermissao(a.chave));
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
}


async function trocarAba(idAba){
  estado.abaAtiva = idAba;
  document.querySelectorAll('.aba').forEach(b=>b.classList.toggle('ativa', b.dataset.aba===idAba));
  document.querySelectorAll('.painel').forEach(p=>p.classList.remove('ativo'));
  document.getElementById('painel-'+idAba).classList.add('ativo');
  await atualizarPainelAtivo();
}


async function atualizarPainelAtivo(){
  if(estado.abaAtiva==='lancamento') await atualizarMeusLancamentos();
  if(estado.abaAtiva==='editar') await atualizarEditar();
  if(estado.abaAtiva==='critica') await atualizarCritica();
  if(estado.abaAtiva==='metas') await atualizarMetas();
  if(estado.abaAtiva==='configuracoes') await atualizarConfiguracoes();
  if(estado.abaAtiva==='rmr') await atualizarRMR();
  if(estado.abaAtiva==='rmr-squad') await atualizarRmrSquad();
  if(estado.abaAtiva==='financeiro') await atualizarFinanceiro();
}


/* ---------------------------------------------------------------------
   SELECTS DE PERÍODO (mês / ano) reaproveitados em gerencial e dashboard
--------------------------------------------------------------------- */
const DIMENSOES_ANALISE = [
  {chave:'prof', rotulo:'Profissional'},
  {chave:'andar', rotulo:'Andar'},
  {chave:'convenio', rotulo:'Convênio'},
  {chave:'procedimento', rotulo:'Procedimento'},
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
  {chave:'procedimento', rotulo:'Procedimento'},
  {chave:'convenio', rotulo:'Convênio'},
  {chave:'valor', rotulo:'Valor'},
  {chave:'forma_pagamento', rotulo:'Forma de pagamento'},
  {chave:'atendente', rotulo:'Atendente'}
];


// Retorno não é cobrado — então Valor e Forma de pagamento não contam como pendência
// (nem como obrigatórios no formulário) quando o procedimento for "RETORNO".
const CAMPOS_DISPENSADOS_NO_RETORNO = ['valor','forma_pagamento'];
function ehProcedimentoRetorno(valorProcedimento){
  return String(valorProcedimento||'').trim().toUpperCase() === 'RETORNO';
}


function campoCriticoVazio(registro, chave){
  if(CAMPOS_DISPENSADOS_NO_RETORNO.includes(chave) && ehProcedimentoRetorno(registro.procedimento)){
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
function definicaoCampos(){
  const L = estado.listas;
  return [
    {chave:'prof', rotulo:'Profissional', tipo:'select', opcoes:L.profissionais, obrigatorio:true,
      travado: estado.papel==='profissional'},
    {chave:'andar', rotulo:'Andar', tipo:'select', opcoes:L.andares, obrigatorio:true},
    {chave:'data', rotulo:'Data', tipo:'date', obrigatorio:true},
    {chave:'turno', rotulo:'Turno', tipo:'select', opcoes:L.turnos, obrigatorio:true},
    {chave:'paciente', rotulo:'Paciente (nome completo)', tipo:'text', obrigatorio:true},
    {chave:'protocolo', rotulo:'Protocolo de realização', tipo:'text'},
    {chave:'procedimento', rotulo:'Procedimento', tipo:'select', opcoes:L.procedimentos, obrigatorio:true},
    {chave:'exames', rotulo:'Exame', tipo:'select', opcoes:L.exames},
    {chave:'biopsias', rotulo:'Biópsia (frascos)', tipo:'select', opcoes:L.biopsias_frascos},
    {chave:'convenio', rotulo:'Convênio', tipo:'select', opcoes:L.convenios, obrigatorio:true},
    {chave:'carteirinha', rotulo:'Carteirinha', tipo:'text'},
    {chave:'atendente', rotulo:'Atendente', tipo:'select', opcoes:L.atendentes, obrigatorio:true}
    // "valor" e "forma_pagamento" saíram daqui — agora são calculados a partir
    // da seção de "Forma de pagamento" (que suporta pagamento dividido em mais
    // de uma forma). Ver htmlSecaoFormaPagamento / lerLinhasPagamento abaixo.
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
  return `<div class="campo${destacar?' campo-pendente':''}" style="grid-column:1/-1;">
    <label>Forma de pagamento *${destacar?' <span class="tag tag-alerta" style="margin-left:4px;">preencher</span>':''}</label>
    <div id="${prefixo}pagamentos-linhas" class="linhas-pagamento"></div>
    <div style="display:flex;align-items:center;gap:14px;margin-top:8px;flex-wrap:wrap;">
      <button type="button" class="botao sutil pequeno" id="${prefixo}botao-add-pagamento">+ Adicionar forma de pagamento</button>
      <span style="font-size:13px;color:var(--ink-600);">Total: <b class="mono" id="${prefixo}pagamento-total">R$ 0,00</b></span>
    </div>
  </div>`;
}


function criarLinhaPagamentoHTML(forma='', valor=''){
  const opcoes = (estado.listas.formas_pagamento||[])
    .map(f=>`<option value="${f}" ${f===forma?'selected':''}>${f}</option>`).join('');
  return `<div class="linha-pagamento">
    <select class="input-pagamento-forma"><option value="">Selecionar...</option>${opcoes}</select>
    <input type="number" step="0.01" class="input-pagamento-valor" placeholder="Valor (R$)" value="${valor!==''&&valor!==undefined&&valor!==null?valor:''}">
    <button type="button" class="botao-remover-pagamento" title="Remover">×</button>
  </div>`;
}


// Monta a seção com as linhas iniciais (array de {forma, valor}, ou uma
// linha vazia por padrão) e liga os eventos por DELEGAÇÃO no container —
// assim adicionar/remover linha nunca duplica listener nas linhas antigas.
function montarSecaoPagamento(prefixo, formasIniciais){
  const container = document.getElementById(prefixo+'pagamentos-linhas');
  if(!container) return;
  const linhas = (formasIniciais && formasIniciais.length) ? formasIniciais : [{forma:'', valor:''}];
  container.innerHTML = linhas.map(l=>criarLinhaPagamentoHTML(l.forma, l.valor)).join('');

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
    .filter(l=>l.forma && l.valor>0);
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
  const dispensarCobranca = ehProcedimentoRetorno(elProcedimento ? elProcedimento.value : '');


  const faltando = definicaoCampos()
    .filter(c => c.obrigatorio)
    .filter(c => {
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
  } else {
    controle = `<input type="${campo.tipo}" id="${id}" value="${valorAtual!==undefined?valorAtual:''}" ${campo.travado?'disabled':''} ${campo.tipo==='number'?'step="0.01"':''}/>`;
  }
  return `<div class="campo${destacar?' campo-pendente':''}"><label>${campo.rotulo}${campo.obrigatorio?' *':''}${destacar?' <span class="tag tag-alerta" style="margin-left:4px;">preencher</span>':''}</label>${controle}</div>`;
}


function lerValoresCampos(prefixo='campo_'){
  const registro = {};
  definicaoCampos().forEach(c=>{
    const el = document.getElementById(prefixo+c.chave);
    registro[c.chave] = el ? el.value : '';
  });


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


