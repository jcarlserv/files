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
  {chave:'procedimentos', rotulo:'Procedimentos'},
  {chave:'atendentes', rotulo:'Atendentes'},
  {chave:'turnos', rotulo:'Turnos'},
  {chave:'formas_pagamento', rotulo:'Formas de pagamento'},
  {chave:'biopsias_frascos', rotulo:'Biópsia (frascos)'},
  {chave:'exames', rotulo:'Exames'}
];
let listaConfigSelectPronto = false;


async function atualizarConfiguracoes(){
  document.getElementById('config-nome-clinica').value = nomeClinicaAtual;
  prepararSelectListaConfig();
  renderizarItensListaConfig();
  prepararLogoCores();
  if(estado.logoClinica && !logoBase64Pendente){
    document.getElementById('config-preview-logo').style.display = 'block';
    document.getElementById('config-preview-logo-img').src = estado.logoClinica;
  }


  // Direitos e Privilégios nunca é liberado pela própria matriz de permissões —
  // isso evitaria alguém se autoconceder mais acesso. É sempre exclusivo do gerente.
  // Os cadastros de andar/procedimento/exame por profissional seguem a mesma regra
  // (são configuração sensível, só o gerente mexe).
  const cartaoPermissoes = document.getElementById('cartao-direitos-privilegios');
  const cartaoProfAndares = document.getElementById('cartao-profissionais-andares');
  const cartaoProfProcedimentos = document.getElementById('cartao-profissionais-procedimentos');
  const cartaoProfExames = document.getElementById('cartao-profissionais-exames');
  const cartaoAtendentesProf = document.getElementById('cartao-atendentes-profissionais');
  if(estado.papel === 'gerente'){
    cartaoPermissoes.style.display = '';
    cartaoProfAndares.style.display = '';
    cartaoProfProcedimentos.style.display = '';
    cartaoProfExames.style.display = '';
    cartaoAtendentesProf.style.display = '';
    await carregarPermissoes();
    await carregarProfissionaisAndares();
    await carregarProfissionaisProcedimentos();
    await carregarProfissionaisExames();
    await carregarAtendentesProfissionais();
  } else {
    cartaoPermissoes.style.display = 'none';
    cartaoProfAndares.style.display = 'none';
    cartaoProfProcedimentos.style.display = 'none';
    cartaoProfExames.style.display = 'none';
    cartaoAtendentesProf.style.display = 'none';
  }


  const podeEditarConfig = temPermissao('editar_configuracoes');
  document.getElementById('botao-salvar-config').style.display = podeEditarConfig ? 'inline-flex' : 'none';
  document.getElementById('config-nome-clinica').disabled = !podeEditarConfig;
  document.getElementById('botao-adicionar-item-lista').style.display = podeEditarConfig ? 'inline-flex' : 'none';
  document.getElementById('config-novo-item-lista').disabled = !podeEditarConfig;
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
    classeCheckbox: 'chk-prof-andar'
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
    classeCheckbox: 'chk-prof-procedimento'
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
    classeCheckbox: 'chk-prof-exame'
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
    }
  });
}


// Desenha uma matriz linha × coluna (checkbox em cada célula) e liga os
// eventos de salvar — reaproveitada por Profissional×Andar,
// Profissional×Procedimento, Profissional×Exame e Atendente×Profissional,
// já que as quatro seguem exatamente a mesma mecânica (só muda o que é
// linha/coluna).
function renderizarMatrizProfissionalCampo({tabela, porLinha, rotuloLinha, linhas, colunas, acao, nomeCampoLinha, nomeCampoAcao, classeCheckbox, aoAlterar}){
  if(linhas.length===0 || colunas.length===0){
    tabela.innerHTML = '<tr><td class="vazio">Cadastre os itens correspondentes em "Listas do sistema" primeiro.</td></tr>';
    return;
  }
  tabela.innerHTML = `
    <thead><tr><th>${rotuloLinha}</th>${colunas.map(o=>`<th style="text-align:center;">${o}</th>`).join('')}</tr></thead>
    <tbody>${linhas.map(linha=>`
      <tr data-linha="${linha}">
        <td>${linha}</td>
        ${colunas.map(o=>`<td style="text-align:center;"><input type="checkbox" class="${classeCheckbox}" data-valor="${o}" ${(porLinha[linha]||[]).includes(o)?'checked':''}></td>`).join('')}
      </tr>`).join('')}</tbody>`;

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
  const grupos = agruparPermissoesPorTela();
  const linhaGrupos = grupos.map(g=>`<th colspan="${g.itens.length}" style="text-align:center;border-left:2px solid var(--line);">${g.tela}</th>`).join('');
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
  const podeEditarConfig = temPermissao('editar_configuracoes');
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


async function atualizarMetas(){
  const mes = document.getElementById('filtro-mes-metas').value;
  const ano = document.getElementById('filtro-ano-metas').value;
  document.getElementById('tabela-metas').innerHTML = '<tr><td class="vazio">Carregando metas...</td></tr>';
  await atualizarTabelaMetas(mes, ano);
  await carregarNota(mes, ano);
  await carregarFinanceiroDre(mes, ano);
  const podeEditarMetas = temPermissao('editar_metas');
  document.getElementById('botao-salvar-nota').style.display = podeEditarMetas ? 'inline-flex' : 'none';
  document.getElementById('texto-nota').disabled = !podeEditarMetas;
}


async function atualizarTabelaMetas(mes, ano){
  const respMetas = await api('listarMetas', {mes, ano});
  const metas = respMetas.metas||[];
  const profissionais = estado.listas.profissionais||[];
  const podeEditarMetas = temPermissao('editar_metas');
  const desabilitado = podeEditarMetas ? '' : 'disabled';
  const tabela = document.getElementById('tabela-metas');
  tabela.innerHTML = `
    <thead><tr><th>Profissional</th><th>Turnos disponibilizados</th><th>Meta de valor (R$)</th><th>Meta de qtde</th><th></th></tr></thead>
    <tbody>${profissionais.map(prof=>{
      const m = metas.find(x=>x.prof===prof) || {};
      return `<tr data-prof="${prof}">
        <td>${prof}</td>
        <td><input type="number" class="input-turnos" value="${m.turnos_disponibilizados||''}" ${desabilitado} style="width:90px;padding:6px;border-radius:6px;border:1.5px solid var(--line);"></td>
        <td><input type="number" class="input-meta" value="${m.meta_valor||''}" ${desabilitado} style="width:120px;padding:6px;border-radius:6px;border:1.5px solid var(--line);"></td>
        <td><input type="number" class="input-meta-qtd" value="${m.meta_qtd||''}" ${desabilitado} style="width:100px;padding:6px;border-radius:6px;border:1.5px solid var(--line);"></td>
        <td>${podeEditarMetas?'<button class="botao secundario pequeno botao-salvar-meta">Salvar</button>':''}</td>
      </tr>`;
    }).join('')}</tbody>`;


  if(!podeEditarMetas) return;


  tabela.querySelectorAll('.botao-salvar-meta').forEach(botao=>{
    botao.addEventListener('click', async (ev)=>{
      const linha = ev.target.closest('tr');
      await api('salvarMeta', {
        prof: linha.dataset.prof, mes, ano,
        turnos_disponibilizados: linha.querySelector('.input-turnos').value,
        meta_valor: linha.querySelector('.input-meta').value,
        meta_qtd: linha.querySelector('.input-meta-qtd').value
      });
      ev.target.textContent = 'Salvo ✓';
      setTimeout(()=>ev.target.textContent='Salvar', 1800);
    });
  });
}


async function carregarNota(mes, ano){
  const resp = await api('obterNota', {mes, ano});
  document.getElementById('texto-nota').value = resp.texto || '';
}
async function salvarNota(){
  const mes = document.getElementById('filtro-mes-metas').value;
  const ano = document.getElementById('filtro-ano-metas').value;
  const texto = document.getElementById('texto-nota').value;
  const botao = document.getElementById('botao-salvar-nota');
  await api('salvarNota', {mes, ano, texto});
  botao.textContent = 'Anotação salva ✓';
  setTimeout(()=>botao.textContent='Salvar anotação', 1800);
}


/* ---------------------------------------------------------------------
   FINANCEIRO (DRE) — cartão na aba Metas. Dado contábil digitado
   manualmente (não é derivado da produção) — uma linha por mês/ano.
   Alimenta a aba Apresentação; ver tabela `financeiro_dre` no Supabase.
--------------------------------------------------------------------- */
const CAMPOS_DRE = [
  ['dre-faturamento-bruto', 'faturamento_bruto'],
  ['dre-deducoes-impostos', 'deducoes_impostos'],
  ['dre-custo-servico', 'custo_servico_prestado'],
  ['dre-despesas-pessoal', 'despesas_pessoal'],
  ['dre-despesas-compras', 'despesas_compras_manutencao'],
  ['dre-despesas-operacionais', 'despesas_operacionais'],
  ['dre-despesas-financeiras', 'despesas_financeiras'],
  ['dre-prolabore', 'prolabore']
];

// Soma a margem/resultado a partir dos campos já digitados na tela (chamado a
// cada digitação, pra já mostrar o resultado antes mesmo de salvar).
function recalcularDreNaTela(){
  const v = campo => Number(document.getElementById(campo).value) || 0;
  const faturamento = v('dre-faturamento-bruto');
  const margemContribuicao = faturamento - v('dre-deducoes-impostos') - v('dre-custo-servico');
  const resultado = margemContribuicao - v('dre-despesas-pessoal') - v('dre-despesas-compras')
    - v('dre-despesas-operacionais') - v('dre-despesas-financeiras') - v('dre-prolabore');
  document.getElementById('dre-margem-contribuicao').textContent = formatarMoeda(margemContribuicao);
  const elResultado = document.getElementById('dre-resultado-operacao');
  elResultado.textContent = formatarMoeda(resultado);
  elResultado.className = 'valor' + (resultado < 0 ? '' : ' teal');
  elResultado.style.color = resultado < 0 ? 'var(--danger)' : '';
}

let dreCamposProntos = false;
function prepararCamposDre(){
  if(dreCamposProntos) return;
  CAMPOS_DRE.forEach(([id])=>document.getElementById(id).addEventListener('input', recalcularDreNaTela));
  dreCamposProntos = true;
}

async function carregarFinanceiroDre(mes, ano){
  prepararCamposDre();
  document.getElementById('dre-mes-referencia').textContent = `${mes} de ${ano}`;
  const resp = await api('obterFinanceiroDre', {mes, ano});
  const dre = (resp.ok && resp.dre) ? resp.dre : null;
  CAMPOS_DRE.forEach(([id, campoBanco])=>{
    document.getElementById(id).value = dre ? (dre[campoBanco] || '') : '';
  });
  recalcularDreNaTela();

  const podeEditarMetas = temPermissao('editar_metas');
  CAMPOS_DRE.forEach(([id])=>document.getElementById(id).disabled = !podeEditarMetas);
  document.getElementById('botao-salvar-dre').style.display = podeEditarMetas ? 'inline-flex' : 'none';
}

async function salvarFinanceiroDre(){
  const mes = document.getElementById('filtro-mes-metas').value;
  const ano = document.getElementById('filtro-ano-metas').value;
  const confirmacao = document.getElementById('confirmacao-dre');
  const dados = { mes, ano };
  CAMPOS_DRE.forEach(([id, campoBanco])=>{ dados[campoBanco] = document.getElementById(id).value; });

  confirmacao.style.color = 'var(--ink-400)';
  confirmacao.textContent = 'Salvando...';
  const resp = await api('salvarFinanceiroDre', dados);
  if(!resp.ok){
    confirmacao.style.color = 'var(--danger)';
    confirmacao.textContent = resp.erro || 'Não foi possível salvar o DRE deste mês.';
    return;
  }
  confirmacao.style.color = 'var(--teal-700)';
  confirmacao.textContent = 'DRE salvo ✓';
  setTimeout(()=>{ if(confirmacao.textContent==='DRE salvo ✓') confirmacao.textContent=''; }, 2500);
}


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
