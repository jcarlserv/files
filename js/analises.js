/* =====================================================================
   ProdClin — analises.js
   Aba Análises (fusão do antigo Dashboard + Análises Cruzadas + RMR): KPIs, todos os
   gráficos e tabelas da aba, Evolução do ano e Análise flexível (dimensão + correlação).
   Este arquivo é carregado via <script src> em index.html, na mesma ordem
   em que aparecia originalmente dentro do <script> único — variáveis e
   funções continuam compartilhando o escopo global, exatamente como antes.
===================================================================== */

/* ---------------------------------------------------------------------
   PAINEL: DASHBOARD
--------------------------------------------------------------------- */
function desenharGraficoProfissional(porProfissional){
  const rotulos = Object.keys(porProfissional);
  const valores = rotulos.map(r=>porProfissional[r].quantidade);
  miniGraficoBarras('grafico-profissional', rotulos, valores, '#5C2350');
}


function desenharGraficoConvenio(porConvenio){
  const rotulos = Object.keys(porConvenio);
  const valores = rotulos.map(r=>porConvenio[r]);
  miniGraficoRosca('grafico-convenio', rotulos, valores);
}


function desenharGraficoAndar(porAndar){
  const rotulos = Object.keys(porAndar);
  const valores = rotulos.map(r=>porAndar[r]);
  miniGraficoRosca('grafico-andar', rotulos, valores);
}


/* ---------------------------------------------------------------------
   EVOLUÇÃO DO ANO — matriz Jan..mês selecionado + gráficos comparativos
   (baseados na META, diferente da "Evolução anual" da RMR que compara com
   o ano anterior). Fundida na aba RMR: em vez de buscar o ano inteiro de
   novo, reaproveita o rmrCache que atualizarRMR() já buscou — evita um
   fetch duplicado e garante que os números batem com o resto da aba.
--------------------------------------------------------------------- */
function atualizarEvolucaoAno(){
  if(!rmrCache || !rmrCache.registrosAno) return; // ainda não carregou (guarda contra clique muito rápido)
  const mesSelecionado = rmrCache.mes;
  const ano = rmrCache.ano;
  const prof = document.getElementById('filtro-prof-evolucao').value;
  const idxMes = MESES.indexOf(mesSelecionado);
  const mesesConsiderados = MESES.slice(0, idxMes+1);


  document.getElementById('titulo-evolucao-ano').textContent = `Janeiro até ${mesSelecionado} — ${ano}`;


  let registros = rmrCache.registrosAno; // já filtrado por andar dentro de atualizarRMR
  if(prof) registros = registros.filter(r=>r.prof===prof);
  const metas = (rmrCache.metasAno || []).filter(m => !prof || m.prof===prof);


  const linhas = mesesConsiderados.map(mes=>{
    const doMes = registros.filter(r=>r.mes===mes);
    const metasDoMes = metas.filter(m=>m.mes===mes);
    const qtdeRealizada = doMes.length;
    const valorRealizado = doMes.reduce((s,r)=>s+(Number(r.valor)||0),0);
    const turnosDisp = metasDoMes.reduce((s,m)=>s+(Number(m.turnos_disponibilizados)||0),0);
    const qtdePrevista = arredondar1(metasDoMes.reduce((s,m)=>s+(Number(m.meta_qtd)||0),0));
    const valorPrevisto = metasDoMes.reduce((s,m)=>s+(Number(m.meta_valor)||0),0);
    const turnosUsados = new Set(doMes.map(r=>r.data+'_'+r.turno)).size;
    const mediaPeriodo = turnosUsados ? valorRealizado/turnosUsados : 0;
    const pctEficiencia = turnosDisp ? Math.round((turnosUsados/turnosDisp)*100) : null;
    const pctMetaValor = valorPrevisto ? Math.round((valorRealizado/valorPrevisto)*100) : null;
    const pctMetaQtde = qtdePrevista ? Math.round((qtdeRealizada/qtdePrevista)*100) : null;
    return {mes, turnosDisp, turnosUsados, qtdePrevista, qtdeRealizada, valorPrevisto, valorRealizado, mediaPeriodo, pctEficiencia, pctMetaValor, pctMetaQtde};
  });


  const tabela = document.getElementById('tabela-evolucao-ano');
  tabela.innerHTML = `
    <thead><tr>
      <th>Mês</th><th>Turnos disp.</th><th>Turnos usados</th><th>% eficiência</th>
      <th>Qtde prevista</th><th>Qtde realizada</th><th>% meta qtde</th>
      <th>Valor previsto</th><th>Valor realizado</th><th>% meta valor</th><th>Média período</th>
    </tr></thead>
    <tbody>${linhas.map(l=>`
      <tr>
        <td>${l.mes}</td>
        <td>${l.turnosDisp||'—'}</td>
        <td>${l.turnosUsados||'—'}</td>
        <td>${l.pctEficiencia!==null? l.pctEficiencia+'%' : '—'}</td>
        <td>${l.qtdePrevista||'—'}</td>
        <td>${l.qtdeRealizada}</td>
        <td>${l.pctMetaQtde!==null? l.pctMetaQtde+'%' : '—'}</td>
        <td class="mono">${l.valorPrevisto?formatarMoeda(l.valorPrevisto):'—'}</td>
        <td class="mono">${formatarMoeda(l.valorRealizado)}</td>
        <td>${l.pctMetaValor!==null? l.pctMetaValor+'%' : '—'}</td>
        <td class="mono">${formatarMoeda(l.mediaPeriodo)}</td>
      </tr>`).join('')}
    <tr class="linha-total">
      <td>Total</td>
      <td>${arredondar1(linhas.reduce((s,l)=>s+l.turnosDisp,0))}</td>
      <td>${arredondar1(linhas.reduce((s,l)=>s+l.turnosUsados,0))}</td>
      <td></td>
      <td>${arredondar1(linhas.reduce((s,l)=>s+l.qtdePrevista,0))}</td>
      <td>${arredondar1(linhas.reduce((s,l)=>s+l.qtdeRealizada,0))}</td>
      <td></td>
      <td class="mono">${formatarMoeda(linhas.reduce((s,l)=>s+l.valorPrevisto,0))}</td>
      <td class="mono">${formatarMoeda(linhas.reduce((s,l)=>s+l.valorRealizado,0))}</td>
      <td></td>
      <td></td>
    </tr>
    </tbody>`;


  miniGraficoLinhas('grafico-evolucao-valor', mesesConsiderados, [
    {nome:'Previsto', dados: linhas.map(l=>l.valorPrevisto), cor:'#C495B8', tracejado:true},
    {nome:'Realizado', dados: linhas.map(l=>l.valorRealizado), cor:'#5C2350'}
  ]);
  miniGraficoLinhas('grafico-evolucao-qtd', mesesConsiderados, [
    {nome:'Prevista', dados: linhas.map(l=>l.qtdePrevista), cor:'#9FD6C8', tracejado:true},
    {nome:'Realizada', dados: linhas.map(l=>l.qtdeRealizada), cor:'#146B5D'}
  ]);
}


/* ---------------------------------------------------------------------
   ANÁLISE FLEXÍVEL — fundida na aba RMR (não busca dados própria: usa
   estado.registrosDashboard, preenchido por atualizarRMR() a partir do
   rmrCache já carregado).
--------------------------------------------------------------------- */
let selectsAnaliseProntos = false;


function prepararSelectsAnalise(){
  if(selectsAnaliseProntos) return;
  const opcoesDimensao = DIMENSOES_ANALISE.map(d=>`<option value="${d.chave}">${d.rotulo}</option>`).join('');
  document.getElementById('filtro-dimensao-analise').innerHTML = opcoesDimensao;
  document.getElementById('filtro-correlacao-a').innerHTML = opcoesDimensao;
  document.getElementById('filtro-correlacao-b').innerHTML = opcoesDimensao;
  document.getElementById('filtro-correlacao-a').value = 'convenio';
  document.getElementById('filtro-correlacao-b').value = 'procedimento';
  document.getElementById('filtro-dimensao-analise').addEventListener('change', atualizarAnaliseDimensao);
  document.getElementById('filtro-correlacao-a').addEventListener('change', atualizarCorrelacao);
  document.getElementById('filtro-correlacao-b').addEventListener('change', atualizarCorrelacao);
  document.getElementById('filtro-correlacao-metrica').addEventListener('change', atualizarCorrelacao);
  selectsAnaliseProntos = true;
}
function rotuloValorAnalise(v){
  if(v===undefined || v===null || v==='') return 'Não informado';
  return String(v);
}


function atualizarAnaliseDimensao(){
  const campo = document.getElementById('filtro-dimensao-analise').value;
  const registros = estado.registrosDashboard || [];
  const grupos = {};
  registros.forEach(r=>{
    const chave = rotuloValorAnalise(r[campo]);
    if(!grupos[chave]) grupos[chave] = {quantidade:0, valor:0};
    grupos[chave].quantidade += 1;
    grupos[chave].valor += Number(r.valor)||0;
  });
  const chaves = Object.keys(grupos).sort((a,b)=>grupos[b].valor-grupos[a].valor);
  const rotuloCampo = DIMENSOES_ANALISE.find(d=>d.chave===campo).rotulo;


  const tabela = document.getElementById('tabela-analise-dimensao');
  tabela.innerHTML = chaves.length===0 ? '<tr><td class="vazio">Sem dados para o período.</td></tr>' : `
    <thead><tr><th>${rotuloCampo}</th><th>Qtd.</th><th>Valor total</th><th>Valor médio</th></tr></thead>
    <tbody>${chaves.map(c=>`<tr><td>${c}</td><td>${grupos[c].quantidade}</td><td class="mono">${formatarMoeda(grupos[c].valor)}</td><td class="mono">${formatarMoeda(grupos[c].valor/grupos[c].quantidade)}</td></tr>`).join('')}
    <tr class="linha-total"><td>Total</td><td>${chaves.reduce((s,c)=>s+grupos[c].quantidade,0)}</td><td class="mono">${formatarMoeda(chaves.reduce((s,c)=>s+grupos[c].valor,0))}</td><td></td></tr>
    </tbody>`;


  miniGraficoBarras('grafico-analise-dimensao', chaves, chaves.map(c=>grupos[c].quantidade), '#5C2350');
}


function atualizarCorrelacao(){
  const campoA = document.getElementById('filtro-correlacao-a').value;
  const campoB = document.getElementById('filtro-correlacao-b').value;
  const metrica = document.getElementById('filtro-correlacao-metrica').value;
  const registros = estado.registrosDashboard || [];
  const tabela = document.getElementById('tabela-correlacao');


  const valoresA = Array.from(new Set(registros.map(r=>rotuloValorAnalise(r[campoA])))).sort();
  const valoresB = Array.from(new Set(registros.map(r=>rotuloValorAnalise(r[campoB])))).sort();


  if(valoresA.length===0 || valoresB.length===0){
    tabela.innerHTML = '<tr><td class="vazio">Sem dados suficientes para correlação neste período.</td></tr>';
    return;
  }


  const matriz = {};
  registros.forEach(r=>{
    const a = rotuloValorAnalise(r[campoA]), b = rotuloValorAnalise(r[campoB]);
    matriz[a] = matriz[a] || {};
    matriz[a][b] = matriz[a][b] || {quantidade:0, valor:0};
    matriz[a][b].quantidade += 1;
    matriz[a][b].valor += Number(r.valor)||0;
  });


  const formatarCelula = v => metrica==='valor' ? formatarMoeda(v) : v;
  const rotuloA = DIMENSOES_ANALISE.find(d=>d.chave===campoA).rotulo;
  const rotuloB = DIMENSOES_ANALISE.find(d=>d.chave===campoB).rotulo;


  tabela.innerHTML = `
    <thead><tr><th>${rotuloA} \\ ${rotuloB}</th>${valoresB.map(b=>`<th>${b}</th>`).join('')}<th>Total</th></tr></thead>
    <tbody>${valoresA.map(a=>{
      const totalLinha = valoresB.reduce((s,b)=> s + ((matriz[a] && matriz[a][b]) ? matriz[a][b][metrica] : 0), 0);
      return `<tr><td>${a}</td>${valoresB.map(b=>{
        const celula = matriz[a] && matriz[a][b];
        return `<td class="mono">${celula ? formatarCelula(celula[metrica]) : '—'}</td>`;
      }).join('')}<td class="mono"><b>${formatarCelula(totalLinha)}</b></td></tr>`;
    }).join('')}
    <tr class="linha-total"><td>Total</td>${valoresB.map(b=>{
      const totalColuna = valoresA.reduce((s,a)=> s + ((matriz[a] && matriz[a][b]) ? matriz[a][b][metrica] : 0), 0);
      return `<td class="mono">${formatarCelula(totalColuna)}</td>`;
    }).join('')}<td></td></tr>
    </tbody>`;
}


/* =====================================================================
   ABA RMR — indicadores completos, nativos (sem depender de iframe)
===================================================================== */
let rmrSelectsProntos = false;
let rmrCache = {};


function rmrPrepararSelects(){
  if(rmrSelectsProntos) return;
  const hoje = new Date();
  const anos = [hoje.getFullYear()-1, hoje.getFullYear()];
  const selAno = document.getElementById('rmr-ano');
  selAno.innerHTML = anos.map(a=>`<option value="${a}" ${a===hoje.getFullYear()?'selected':''}>${a}</option>`).join('');
  const selMes = document.getElementById('rmr-mes');
  selMes.innerHTML = MESES.map((m,i)=>`<option value="${m}" ${i===hoje.getMonth()?'selected':''}>${m}</option>`).join('');
  selAno.addEventListener('change', atualizarRMR);
  selMes.addEventListener('change', atualizarRMR);
  const selAndar = document.getElementById('rmr-andar');
  selAndar.innerHTML = '<option value="">Todos</option>' +
    (estado.listas.andares||[]).map(a=>`<option value="${a}">${a}</option>`).join('');
  selAndar.addEventListener('change', atualizarRMR);
  document.getElementById('rmr-busca-detalhe').addEventListener('input', rmrFiltrarTabelaDetalhe);
  document.getElementById('rmr-botao-salvar-nota').addEventListener('click', rmrSalvarNota);
  document.getElementById('rmr-botao-exportar-dados-mes').addEventListener('click', ()=>gerarRelatorioDadosBrutos('mes'));
  document.getElementById('rmr-botao-exportar-dados-ano').addEventListener('click', ()=>gerarRelatorioDadosBrutos('ano'));
  rmrSelectsProntos = true;
}


async function atualizarRMR(){
  rmrPrepararSelects();
  const mes = document.getElementById('rmr-mes').value;
  const ano = Number(document.getElementById('rmr-ano').value);
  const anoAnterior = ano - 1;
  const andar = document.getElementById('rmr-andar').value;
  document.getElementById('rmr-legenda-periodo').textContent = `Referência: ${mes} de ${ano} · comparativo com ${mes} de ${anoAnterior}` + (andar ? ` · Andar: ${andar}` : '');


  let prodAno, prodAnoAnterior, metasAno, metasAnoAnterior, nota;
  try{
    [prodAno, prodAnoAnterior, metasAno, metasAnoAnterior, nota] = await Promise.all([
      buscarProducaoCompleta({ano}),
      buscarProducaoCompleta({ano:anoAnterior}),
      api('listarMetas', {ano}),
      api('listarMetas', {ano:anoAnterior}),
      api('obterNota', {mes, ano})
    ]);
  }catch(e){
    document.getElementById('rmr-legenda-periodo').textContent = 'Erro de conexão com o servidor.';
    return;
  }


  const filtrarPorAndar = registros => andar
    ? registros.filter(r=>String(r.andar||'').trim().toUpperCase()===andar.trim().toUpperCase())
    : registros;


  rmrCache = {
    mes, ano, anoAnterior,
    registrosAno: filtrarPorAndar(prodAno.registros||[]),
    registrosAnoAnterior: filtrarPorAndar(prodAnoAnterior.registros||[]),
    metasAno: metasAno.metas||[],
    metasAnoAnterior: metasAnoAnterior.metas||[]
  };


  document.getElementById('rmr-texto-nota').value = (nota && nota.texto) || '';


  const doMesAtual = rmrCache.registrosAno.filter(r=>r.mes===mes);
  const doMesAnterior = rmrCache.registrosAnoAnterior.filter(r=>r.mes===mes);
  const metasDoMes = rmrCache.metasAno.filter(m=>m.mes===mes);


  rmrRenderResumo(doMesAtual, doMesAnterior, metasDoMes);
  rmrRenderSquadAtendimento(doMesAtual);
  rmrRenderProfissionais(mes, ano, anoAnterior);
  rmrRenderExames(doMesAtual);
  rmrRenderProcedimentosBiopsias(doMesAtual);
  rmrRenderDetalheNominal(doMesAtual);
  rmrRenderTurnos(doMesAtual, metasDoMes);
  rmrRenderFaturamentoParticular(doMesAtual);
  rmrRenderMatrizConvenio(doMesAtual);
  rmrRenderEficiencia(doMesAtual, metasDoMes);
  rmrRenderEvolucaoAnual();
  atualizarEvolucaoAno();


  // Análise flexível (dimensão + correlação) — reaproveita doMesAtual, já
  // filtrado por andar, sem precisar de outra busca ao banco.
  prepararSelectsAnalise();
  estado.registrosDashboard = doMesAtual;
  atualizarAnaliseDimensao();
  atualizarCorrelacao();
}


/* Gráficos de distribuição (Squad Atendimento) — calculados a partir do
   doMesAtual que atualizarRMR() já tem em mãos, sem busca própria. */
function rmrRenderSquadAtendimento(doMesAtual){
  const porProfissional = {}, porConvenio = {}, porAndar = {};
  doMesAtual.forEach(r=>{
    const prof = r.prof || 'Não informado';
    const conv = r.convenio || 'PARTICULAR';
    const andarReg = r.andar || 'Não informado';
    const valor = Number(r.valor)||0;
    if(!porProfissional[prof]) porProfissional[prof] = {quantidade:0, valor:0};
    porProfissional[prof].quantidade++; porProfissional[prof].valor += valor;
    porConvenio[conv] = (porConvenio[conv]||0) + valor;
    porAndar[andarReg] = (porAndar[andarReg]||0) + valor;
  });
  desenharGraficoProfissional(porProfissional);
  desenharGraficoConvenio(porConvenio);
  desenharGraficoAndar(porAndar);
}


function rmrOrigemPagamento(r){
  return r.forma_pagamento === 'CONVÊNIO' ? (r.convenio || 'CONVÊNIO (não especificado)') : (r.forma_pagamento || 'PARTICULAR');
}


function rmrRenderResumo(doMesAtual, doMesAnterior, metasDoMes){
  const totalAtual = doMesAtual.length;
  const totalAnterior = doMesAnterior.length;
  const valorAtual = doMesAtual.reduce((s,r)=>s+(Number(r.valor)||0),0);
  const valorAnterior = doMesAnterior.reduce((s,r)=>s+(Number(r.valor)||0),0);
  const metaTotal = metasDoMes.reduce((s,m)=>s+(Number(m.meta_valor)||0),0);
  const profissionaisAtivos = new Set(doMesAtual.map(r=>r.prof)).size;


  document.getElementById('rmr-kpi-atendimentos').textContent = totalAtual;
  document.getElementById('rmr-kpi-valor').textContent = formatarMoeda(valorAtual);
  document.getElementById('rmr-kpi-ticket').textContent = formatarMoeda(totalAtual ? valorAtual/totalAtual : 0);
  document.getElementById('rmr-kpi-meta').textContent = metaTotal ? Math.round((valorAtual/metaTotal)*100)+'%' : '—';
  document.getElementById('rmr-kpi-profissionais').textContent = profissionaisAtivos;


  rmrCompararEExibir('rmr-kpi-atendimentos-comp', totalAtual, totalAnterior);
  rmrCompararEExibir('rmr-kpi-valor-comp', valorAtual, valorAnterior);
}
function rmrCompararEExibir(idEl, atual, anterior){
  const el = document.getElementById(idEl);
  if(!anterior){ el.textContent = ''; return; }
  const variacao = ((atual-anterior)/anterior)*100;
  const seta = variacao>=0 ? '▲' : '▼';
  el.style.color = variacao>=0 ? 'var(--teal-700)' : 'var(--danger)';
  el.textContent = `${seta} ${Math.abs(variacao).toFixed(0)}% vs. ano anterior`;
}


function rmrRenderProfissionais(mesRef, ano, anoAnterior){
  const profissionais = Array.from(new Set(rmrCache.registrosAno.map(r=>r.prof))).sort();
  const seletor = document.getElementById('rmr-seletor-profissional');
  const valorSelecionado = seletor.value;
  seletor.innerHTML = profissionais.map(p=>`<option value="${p}">${p}</option>`).join('');
  if(profissionais.includes(valorSelecionado)) seletor.value = valorSelecionado;
  seletor.onchange = () => rmrRenderTabelaProfissionalDetalhe(seletor.value, mesRef, ano, anoAnterior);
  rmrRenderTabelaProfissionalDetalhe(seletor.value || profissionais[0], mesRef, ano, anoAnterior);


  const doMes = rmrCache.registrosAno.filter(r=>r.mes===mesRef);
  const metasDoMes = rmrCache.metasAno.filter(m=>m.mes===mesRef);
  const porProf = {};
  doMes.forEach(r=>{
    if(!porProf[r.prof]) porProf[r.prof] = {quantidade:0, valor:0};
    porProf[r.prof].quantidade++; porProf[r.prof].valor += Number(r.valor)||0;
  });
  const metaPorProf = {}; metasDoMes.forEach(m=>metaPorProf[m.prof]=m);
  const linhas = Object.keys(porProf).sort().map(prof=>{
    const meta = metaPorProf[prof]||{};
    const temMeta = Number(meta.meta_valor) > 0;
    const pct = temMeta ? Math.min(150,(porProf[prof].valor/meta.meta_valor)*100) : null;
    return {prof, ...porProf[prof], turnos:meta.turnos_disponibilizados||'—', meta:meta.meta_valor||0, pct};
  });
  const tabela = document.getElementById('rmr-tabela-profissionais-mes');
  if(linhas.length===0){
    tabela.innerHTML='<tr><td class="vazio">Sem dados no período.</td></tr>';
    graficoVazio('grafico-meta-realizado');
    return;
  }
  tabela.innerHTML = `
    <thead><tr><th>Profissional</th><th>Turnos disp.</th><th>Atendimentos</th><th>Valor realizado</th><th>Meta (R$)</th><th>% atingido</th></tr></thead>
    <tbody>${linhas.map(l=>`
      <tr><td>${l.prof}</td><td>${l.turnos}</td><td>${l.quantidade}</td><td class="mono">${formatarMoeda(l.valor)}</td>
      <td class="mono">${l.meta?formatarMoeda(l.meta):'—'}</td>
      <td>${l.pct!==null ? `<div class="mono" style="font-size:11.5px;">${l.pct.toFixed(0)}%</div><div class="barra-meta"><div style="width:${Math.min(100,l.pct)}%;"></div></div>` : `<div class="mono" style="font-size:11.5px;color:var(--ink-400);">—</div>`}</td></tr>`).join('')}
    </tbody>`;
  miniGraficoBarras('grafico-meta-realizado', linhas.map(l=>l.prof), linhas.map(l=>Math.round(l.valor)), '#5C2350');
}


function rmrRenderTabelaProfissionalDetalhe(prof, mesRef, ano, anoAnterior){
  if(!prof) return;
  const idxMesRef = MESES.indexOf(mesRef);
  const mesesAteRef = MESES.slice(0, idxMesRef+1);
  const metaMap = {}; rmrCache.metasAno.filter(m=>m.prof===prof).forEach(m=>metaMap[m.mes]=m);


  const linhas = mesesAteRef.map(mes=>{
    const doMesAtual = rmrCache.registrosAno.filter(r=>r.prof===prof && r.mes===mes);
    const doMesAnterior = rmrCache.registrosAnoAnterior.filter(r=>r.prof===prof && r.mes===mes);
    const valorAtual = doMesAtual.reduce((s,r)=>s+(Number(r.valor)||0),0);
    const valorAnterior = doMesAnterior.reduce((s,r)=>s+(Number(r.valor)||0),0);
    const meta = metaMap[mes]||{};
    const turnosUsados = new Set(doMesAtual.map(r=>r.data+'_'+r.turno)).size;
    const media = turnosUsados ? valorAtual/turnosUsados : 0;
    return {mes, turnos:meta.turnos_disponibilizados||'—', metaValor:meta.meta_valor||0, valorAtual, valorAnterior, media};
  });


  const tabela = document.getElementById('rmr-tabela-profissional-detalhe');
  tabela.innerHTML = `
    <thead><tr><th>Mês</th><th>Turnos disp.</th><th>Meta (R$)</th><th>Realizado ${ano}</th><th>Realizado ${anoAnterior}</th><th>Média/turno</th></tr></thead>
    <tbody>${linhas.map(l=>`
      <tr><td>${l.mes}</td><td>${l.turnos}</td><td class="mono">${l.metaValor?formatarMoeda(l.metaValor):'—'}</td>
      <td class="mono">${formatarMoeda(l.valorAtual)}</td><td class="mono">${formatarMoeda(l.valorAnterior)}</td>
      <td class="mono">${formatarMoeda(l.media)}</td></tr>`).join('')}
    </tbody>`;
}


function rmrRenderExames(doMesAtual){
  const exames = doMesAtual.filter(r=>r.exames);
  const linhas = {};
  exames.forEach(r=>{
    const tipo = r.exames;
    const origem = rmrOrigemPagamento(r);
    linhas[tipo] = linhas[tipo] || {};
    linhas[tipo][origem] = (linhas[tipo][origem]||0)+1;
  });
  const origens = Array.from(new Set(exames.map(rmrOrigemPagamento))).sort();
  const tabela = document.getElementById('rmr-tabela-exames');
  const tipos = Object.keys(linhas).sort();
  if(tipos.length===0){
    tabela.innerHTML='<tr><td class="vazio">Nenhum exame registrado no período.</td></tr>';
    graficoVazio('grafico-exames');
    return;
  }
  tabela.innerHTML = `
    <thead><tr><th>Tipo de exame</th>${origens.map(o=>`<th>${o}</th>`).join('')}<th>Total</th></tr></thead>
    <tbody>${tipos.map(tipo=>{
      const total = origens.reduce((s,o)=>s+(linhas[tipo][o]||0),0);
      return `<tr><td>${tipo}</td>${origens.map(o=>`<td>${linhas[tipo][o]||0}</td>`).join('')}<td><b>${total}</b></td></tr>`;
    }).join('')}
    <tr class="linha-total"><td>Total</td>${origens.map(o=>`<td>${tipos.reduce((s,t)=>s+(linhas[t][o]||0),0)}</td>`).join('')}<td>${exames.length}</td></tr>
    </tbody>`;
  const totaisPorTipo = tipos.map(tipo=>origens.reduce((s,o)=>s+(linhas[tipo][o]||0),0));
  miniGraficoBarras('grafico-exames', tipos, totaisPorTipo, '#146B5D');
}


function rmrRenderProcedimentosBiopsias(doMesAtual){
  const porProcedimento = {};
  doMesAtual.forEach(r=>{ const p=r.procedimento||'Não informado'; porProcedimento[p]=(porProcedimento[p]||0)+1; });
  const tProc = document.getElementById('rmr-tabela-procedimentos');
  const chavesProc = Object.keys(porProcedimento).sort((a,b)=>porProcedimento[b]-porProcedimento[a]);
  tProc.innerHTML = chavesProc.length===0 ? '<tr><td class="vazio">Sem dados.</td></tr>' : `
    <thead><tr><th>Atendimento</th><th>Quantidade</th></tr></thead>
    <tbody>${chavesProc.map(p=>`<tr><td>${p}</td><td>${porProcedimento[p]}</td></tr>`).join('')}</tbody>`;
  if(chavesProc.length===0) graficoVazio('grafico-procedimentos');
  else miniGraficoBarras('grafico-procedimentos', chavesProc, chavesProc.map(p=>porProcedimento[p]), '#8A3D79');


  const comBiopsia = doMesAtual.filter(r=>r.biopsias);
  const porFrasco = {};
  comBiopsia.forEach(r=>{ porFrasco[r.biopsias]=(porFrasco[r.biopsias]||0)+1; });
  const tBio = document.getElementById('rmr-tabela-biopsias');
  const chavesBio = Object.keys(porFrasco).sort();
  tBio.innerHTML = chavesBio.length===0 ? '<tr><td class="vazio">Nenhuma biópsia registrada no período.</td></tr>' : `
    <thead><tr><th>Frascos</th><th>Quantidade</th></tr></thead>
    <tbody>${chavesBio.map(f=>`<tr><td>${f}</td><td>${porFrasco[f]}</td></tr>`).join('')}
    <tr class="linha-total"><td>Total</td><td>${comBiopsia.length}</td></tr></tbody>`;
  if(chavesBio.length===0) graficoVazio('grafico-biopsias');
  else miniGraficoBarras('grafico-biopsias', chavesBio, chavesBio.map(f=>porFrasco[f]), '#9C6E22');
}


function rmrRenderDetalheNominal(doMesAtual){
  window.__rmrRegistrosDetalhe = doMesAtual.slice().sort((a,b)=>a.data.localeCompare(b.data));
  rmrDesenharTabelaDetalhe(window.__rmrRegistrosDetalhe);
}
function rmrDesenharTabelaDetalhe(registros){
  const tabela = document.getElementById('rmr-tabela-detalhe-nominal');
  if(registros.length===0){ tabela.innerHTML='<tr><td class="vazio">Nenhum atendimento no período.</td></tr>'; return; }
  tabela.innerHTML = `
    <thead><tr><th>Data</th><th>Profissional</th><th>Andar</th><th>Paciente</th><th>Convênio/Forma</th><th>Atendimento</th><th>Exame</th><th>Atendente</th><th>Valor</th></tr></thead>
    <tbody>${registros.map(r=>`
      <tr><td>${formatarDataExibicao(r.data)}</td><td>${r.prof}</td><td>${r.andar||'—'}</td><td>${r.paciente||''}</td>
      <td>${r.convenio || r.forma_pagamento || '—'}</td><td>${r.procedimento||''}</td><td>${r.exames||'—'}</td><td>${r.atendente||''}</td>
      <td class="mono">${formatarMoeda(r.valor)}</td></tr>`).join('')}</tbody>`;
}
function rmrFiltrarTabelaDetalhe(){
  const termo = document.getElementById('rmr-busca-detalhe').value.trim().toUpperCase();
  const base = window.__rmrRegistrosDetalhe || [];
  if(!termo){ rmrDesenharTabelaDetalhe(base); return; }
  const filtrados = base.filter(r =>
    (r.paciente||'').toUpperCase().includes(termo) ||
    (r.prof||'').toUpperCase().includes(termo) ||
    (r.andar||'').toUpperCase().includes(termo) ||
    (r.convenio||'').toUpperCase().includes(termo) ||
    (r.procedimento||'').toUpperCase().includes(termo) ||
    (r.exames||'').toUpperCase().includes(termo)
  );
  rmrDesenharTabelaDetalhe(filtrados);
}


function rmrRenderTurnos(doMesAtual, metasDoMes){
  const usoPorProf = {};
  doMesAtual.forEach(r=>{
    usoPorProf[r.prof] = usoPorProf[r.prof] || new Set();
    usoPorProf[r.prof].add(r.data+'_'+r.turno);
  });
  const linhas = metasDoMes.map(m=>{
    const usados = usoPorProf[m.prof] ? usoPorProf[m.prof].size : 0;
    const disp = Number(m.turnos_disponibilizados)||0;
    const ociosos = Math.max(0, disp-usados);
    const pct = disp ? Math.round((usados/disp)*100) : 0;
    return {prof:m.prof, disp, usados, ociosos, pct};
  }).sort((a,b)=>b.disp-a.disp);


  const tabela = document.getElementById('rmr-tabela-turnos');
  tabela.innerHTML = linhas.length===0 ? '<tr><td class="vazio">Cadastre metas de turnos disponibilizados para ver esta tabela.</td></tr>' : `
    <thead><tr><th>Profissional</th><th>Disponibilizados</th><th>Vendidos</th><th>Ociosos</th><th>% eficiência</th></tr></thead>
    <tbody>${linhas.map(l=>`<tr><td>${l.prof}</td><td>${l.disp}</td><td>${l.usados}</td><td>${l.ociosos}</td><td>${l.pct}%</td></tr>`).join('')}</tbody>`;


  miniGraficoBarrasEmpilhadas('rmr-grafico-turnos', linhas.map(l=>l.prof), [
    {nome:'Vendidos', dados: linhas.map(l=>l.usados), cor:'#146B5D'},
    {nome:'Ociosos', dados: linhas.map(l=>l.ociosos), cor:'#C495B8'}
  ]);
}


function rmrRenderFaturamentoParticular(doMesAtual){
  // Soma só a PARTE particular de cada lançamento — num pagamento dividido
  // (ex.: metade convênio, metade dinheiro), só a metade em dinheiro entra
  // aqui, não o valor cheio do lançamento.
  const porProf = {};
  doMesAtual.forEach(r=>{
    const valorParticular = partesPagamentoDe(r)
      .filter(p=>p.forma && p.forma!=='CONVÊNIO')
      .reduce((s,p)=>s+(Number(p.valor)||0),0);
    if(valorParticular>0) porProf[r.prof] = (porProf[r.prof]||0) + valorParticular;
  });
  const rotulos = Object.keys(porProf).sort((a,b)=>porProf[b]-porProf[a]);
  miniGraficoBarras('rmr-grafico-particular', rotulos, rotulos.map(r=>porProf[r]), '#8A3D79');
}


function rmrRenderMatrizConvenio(doMesAtual){
  // Idem: soma só a PARTE em convênio de cada lançamento, não o valor cheio.
  const matriz = {};
  const profissionaisSet = new Set(), conveniosSet = new Set();
  doMesAtual.forEach(r=>{
    if(!r.convenio) return;
    const valorConvenio = partesPagamentoDe(r)
      .filter(p=>p.forma==='CONVÊNIO')
      .reduce((s,p)=>s+(Number(p.valor)||0),0);
    if(valorConvenio<=0) return;
    matriz[r.prof] = matriz[r.prof] || {};
    matriz[r.prof][r.convenio] = (matriz[r.prof][r.convenio]||0) + valorConvenio;
    profissionaisSet.add(r.prof);
    conveniosSet.add(r.convenio);
  });
  const profissionais = Array.from(profissionaisSet).sort();
  const convenios = Array.from(conveniosSet).sort();
  const tabela = document.getElementById('rmr-tabela-matriz-convenio');
  if(profissionais.length===0){ tabela.innerHTML='<tr><td class="vazio">Nenhum atendimento por convênio no período.</td></tr>'; return; }
  tabela.innerHTML = `
    <thead><tr><th>Profissional</th>${convenios.map(c=>`<th>${c}</th>`).join('')}<th>Total</th></tr></thead>
    <tbody>${profissionais.map(p=>{
      const total = convenios.reduce((s,c)=>s+((matriz[p]&&matriz[p][c])||0),0);
      return `<tr><td>${p}</td>${convenios.map(c=>`<td class="mono">${formatarMoeda((matriz[p]&&matriz[p][c])||0)}</td>`).join('')}<td class="mono"><b>${formatarMoeda(total)}</b></td></tr>`;
    }).join('')}
    <tr class="linha-total"><td>Total</td>${convenios.map(c=>`<td class="mono">${formatarMoeda(profissionais.reduce((s,p)=>s+((matriz[p]&&matriz[p][c])||0),0))}</td>`).join('')}<td></td></tr>
    </tbody>`;
}


function rmrRenderEficiencia(doMesAtual, metasDoMes){
  const porProf = {};
  doMesAtual.forEach(r=>{
    porProf[r.prof] = porProf[r.prof] || {quantidade:0, valor:0, turnos:new Set()};
    porProf[r.prof].quantidade++;
    porProf[r.prof].valor += Number(r.valor)||0;
    porProf[r.prof].turnos.add(r.data+'_'+r.turno);
  });
  const metaMap = {}; metasDoMes.forEach(m=>metaMap[m.prof]=m);
  const todosProf = Array.from(new Set([...Object.keys(porProf), ...metasDoMes.map(m=>m.prof)])).sort();


  const tabela = document.getElementById('rmr-tabela-eficiencia');
  if(todosProf.length===0){
    tabela.innerHTML='<tr><td class="vazio">Sem dados no período.</td></tr>';
    graficoVazio('grafico-eficiencia');
    return;
  }
  const linhasCalculadas = todosProf.map(prof=>{
    const dados = porProf[prof] || {quantidade:0, valor:0, turnos:new Set()};
    const meta = metaMap[prof] || {};
    const disp = Number(meta.turnos_disponibilizados)||0;
    const vendidos = dados.turnos.size;
    const pctTurnos = disp ? Math.round((vendidos/disp)*100) : 0;
    const temMeta = Number(meta.meta_valor) > 0;
    const pctMeta = temMeta ? Math.round((dados.valor/meta.meta_valor)*100) : null;
    const media = vendidos ? dados.valor/vendidos : 0;
    return {prof, disp, vendidos, pctTurnos, temMeta, pctMeta, valor:dados.valor, meta:meta.meta_valor, media};
  });
  tabela.innerHTML = `
    <thead><tr><th>Profissional</th><th>Turnos disp.</th><th>Turnos vendidos</th><th>% eficiência turnos</th><th>Meta (R$)</th><th>Realizado (R$)</th><th>% meta atingida</th><th>Média/turno</th></tr></thead>
    <tbody>${linhasCalculadas.map(l=>{
      return `<tr><td>${l.prof}</td><td>${l.disp||'—'}</td><td>${l.vendidos}</td><td>${l.pctTurnos}%</td>
        <td class="mono">${l.temMeta?formatarMoeda(l.meta):'—'}</td><td class="mono">${formatarMoeda(l.valor)}</td>
        <td>${l.temMeta ? `<div class="mono" style="font-size:11.5px;">${l.pctMeta}%</div><div class="barra-meta"><div style="width:${Math.min(100,l.pctMeta)}%;"></div></div>` : `<div class="mono" style="font-size:11.5px;color:var(--ink-400);">—</div>`}</td>
        <td class="mono">${formatarMoeda(l.media)}</td></tr>`;
    }).join('')}</tbody>`;
  miniGraficoBarras('grafico-eficiencia', linhasCalculadas.map(l=>l.prof), linhasCalculadas.map(l=>l.pctTurnos), '#0E5548');
}


function rmrRenderEvolucaoAnual(){
  const idxMesRef = MESES.indexOf(rmrCache.mes);
  const mesesAteRef = MESES.slice(0, idxMesRef+1);


  const valorAtual = mesesAteRef.map(m=>rmrCache.registrosAno.filter(r=>r.mes===m).reduce((s,r)=>s+(Number(r.valor)||0),0));
  const valorAnterior = mesesAteRef.map(m=>rmrCache.registrosAnoAnterior.filter(r=>r.mes===m).reduce((s,r)=>s+(Number(r.valor)||0),0));
  const qtdAtual = mesesAteRef.map(m=>rmrCache.registrosAno.filter(r=>r.mes===m).length);
  const qtdAnterior = mesesAteRef.map(m=>rmrCache.registrosAnoAnterior.filter(r=>r.mes===m).length);


  miniGraficoLinhas('rmr-grafico-evolucao-valor', mesesAteRef, [
    {nome:String(rmrCache.ano), dados:valorAtual, cor:'#5C2350'},
    {nome:String(rmrCache.anoAnterior), dados:valorAnterior, cor:'#C495B8', tracejado:true}
  ]);
  miniGraficoLinhas('rmr-grafico-evolucao-qtd', mesesAteRef, [
    {nome:String(rmrCache.ano), dados:qtdAtual, cor:'#146B5D'},
    {nome:String(rmrCache.anoAnterior), dados:qtdAnterior, cor:'#9FD6C8', tracejado:true}
  ]);
}


async function rmrSalvarNota(){
  const mes = document.getElementById('rmr-mes').value;
  const ano = document.getElementById('rmr-ano').value;
  const texto = document.getElementById('rmr-texto-nota').value;
  const botao = document.getElementById('rmr-botao-salvar-nota');
  await api('salvarNota', {mes, ano, texto});
  botao.textContent = 'Salvo ✓';
  setTimeout(()=>botao.textContent='Salvar anotação', 1800);
}




/* =====================================================================
   EXPORTAR DADOS BRUTOS (mês ou ano) — diferente do "Exportar PDF" comum
   (que é só um print da tela atual, respeitando os filtros). Esse gera um
   documento à parte, sempre com TODOS os profissionais e TODOS os andares
   (ignora o filtro "Andar" da tela — só usa Mês/Ano já selecionados),
   pensado pra alimentar uma IA externa que vai montar uma apresentação
   (o usuário já faz isso hoje colando um PDF assim numa IA de terceiros).
   Por isso é só TABELA/NÚMERO, sem nenhum texto de análise redigido por
   aqui, e sem dado nominal de paciente (só agregados), por privacidade.
   Abre uma aba nova e imprime — mesmo mecanismo (sem lib externa) do resto
   do sistema. A janela é aberta ANTES de qualquer busca ao banco, porque
   navegadores bloqueiam popup se o window.open não for a primeiríssima
   coisa a rodar no clique do usuário.
===================================================================== */
function relatorioAgruparESomar(registros, campo){
  const grupos = {};
  registros.forEach(r=>{
    const chave = r[campo] || 'Não informado';
    if(!grupos[chave]) grupos[chave] = {quantidade:0, valor:0};
    grupos[chave].quantidade++;
    grupos[chave].valor += Number(r.valor)||0;
  });
  return grupos;
}

function relatorioTabelaHtml(titulo, cabecalhos, linhas){
  if(linhas.length===0) return `<h3>${titulo}</h3><p class="vazio-rel">Sem dados neste período.</p>`;
  return `<h3>${titulo}</h3>
    <table>
      <thead><tr>${cabecalhos.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${linhas.map(l=>`<tr>${l.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
}

async function gerarRelatorioDadosBrutos(modo){
  const mes = document.getElementById('rmr-mes').value;
  const ano = Number(document.getElementById('rmr-ano').value);

  // Abre a aba/janela JÁ (sem esperar a busca) pra não ser bloqueada como popup.
  const janela = window.open('', '_blank');
  if(!janela){
    alert('O navegador bloqueou a abertura da nova aba. Permita pop-ups para este site e tente de novo.');
    return;
  }
  janela.document.write('<p style="font-family:sans-serif;padding:40px;color:#5B4A57;">Preparando relatório...</p>');
  janela.document.close();

  let registros, metas;
  try{
    if(modo==='mes'){
      const { dataInicio, dataFim } = primeiroEUltimoDiaDoMes(mes, ano);
      const respProd = await buscarProducaoCompleta({dataInicio, dataFim});
      registros = respProd.ok ? respProd.registros : [];
      const respMetas = await api('listarMetas', {mes, ano});
      metas = respMetas.ok ? respMetas.metas : [];
    } else {
      const respProd = await buscarProducaoCompleta({ano});
      registros = respProd.ok ? respProd.registros : [];
      const respMetas = await api('listarMetas', {ano});
      metas = respMetas.ok ? respMetas.metas : [];
    }
  }catch(e){
    janela.document.body.innerHTML = '<p style="font-family:sans-serif;padding:40px;color:#B23A3A;">Erro ao buscar os dados. Feche esta aba e tente de novo.</p>';
    return;
  }

  const tituloPeriodoSimples = modo==='mes' ? `${mes} de ${ano}` : `Ano de ${ano}`;

  const totalValor = registros.reduce((s,r)=>s+(Number(r.valor)||0),0);
  const profissionaisAtivos = new Set(registros.map(r=>r.prof)).size;

  // --- Ranking por profissional ---
  const porProf = {};
  registros.forEach(r=>{
    const p = r.prof||'Não informado';
    if(!porProf[p]) porProf[p] = {quantidade:0, valor:0};
    porProf[p].quantidade++; porProf[p].valor += Number(r.valor)||0;
  });
  const linhasProf = Object.keys(porProf).sort((a,b)=>porProf[b].valor-porProf[a].valor).map(p=>[
    p, porProf[p].quantidade, formatarMoeda(porProf[p].valor), formatarMoeda(porProf[p].valor/porProf[p].quantidade)
  ]);

  // --- Financeiro por forma de pagamento (considera pagamento dividido) ---
  const porForma = {};
  registros.forEach(r=>{
    partesPagamentoDe(r).forEach(p=>{
      const forma = String(p.forma||'Não informada').trim().toUpperCase() || 'NÃO INFORMADA';
      if(!porForma[forma]) porForma[forma] = {quantidade:0, valor:0};
      porForma[forma].quantidade++; porForma[forma].valor += Number(p.valor)||0;
    });
  });
  const linhasForma = Object.keys(porForma).sort((a,b)=>porForma[b].valor-porForma[a].valor).map(f=>[
    f, porForma[f].quantidade, formatarMoeda(porForma[f].valor)
  ]);

  // --- Financeiro por convênio ---
  const porConvenio = relatorioAgruparESomar(registros.map(r=>Object.assign({},r,{convenio:r.convenio||'PARTICULAR'})), 'convenio');
  const linhasConvenio = Object.keys(porConvenio).sort((a,b)=>porConvenio[b].valor-porConvenio[a].valor).map(c=>[
    c, porConvenio[c].quantidade, formatarMoeda(porConvenio[c].valor)
  ]);

  // --- Procedimentos ---
  const porProcedimento = relatorioAgruparESomar(registros.map(r=>Object.assign({},r,{procedimento:r.procedimento||'Não informado'})), 'procedimento');
  const linhasProcedimento = Object.keys(porProcedimento).sort((a,b)=>porProcedimento[b].quantidade-porProcedimento[a].quantidade).map(p=>[
    p, porProcedimento[p].quantidade, formatarMoeda(porProcedimento[p].valor)
  ]);

  // --- Exames ---
  const comExame = registros.filter(r=>r.exames);
  const porExame = {};
  comExame.forEach(r=>{ if(!porExame[r.exames]) porExame[r.exames]={quantidade:0}; porExame[r.exames].quantidade++; });
  const linhasExame = Object.keys(porExame).sort((a,b)=>porExame[b].quantidade-porExame[a].quantidade).map(e=>[e, porExame[e].quantidade]);

  // --- Biópsias ---
  const comBiopsia = registros.filter(r=>r.biopsias);
  const porBiopsia = {};
  comBiopsia.forEach(r=>{ porBiopsia[r.biopsias]=(porBiopsia[r.biopsias]||0)+1; });
  const linhasBiopsia = Object.keys(porBiopsia).sort().map(f=>[f, porBiopsia[f]]);

  // --- Eficiência de turnos por profissional (usa metas do período) ---
  const usoPorProf = {};
  registros.forEach(r=>{
    usoPorProf[r.prof] = usoPorProf[r.prof] || new Set();
    usoPorProf[r.prof].add(r.data+'_'+r.turno);
  });
  const linhasEficiencia = metas.map(m=>{
    const usados = usoPorProf[m.prof] ? usoPorProf[m.prof].size : 0;
    const disp = Number(m.turnos_disponibilizados)||0;
    const ociosos = Math.max(0, disp-usados);
    const pct = disp ? Math.round((usados/disp)*100)+'%' : '—';
    return [m.prof, disp, usados, ociosos, pct];
  }).sort((a,b)=>b[1]-a[1]);

  // --- Evolução mensal (só no modo "ano") ---
  let blocoEvolucao = '';
  if(modo==='ano'){
    const porMes = {};
    MESES.forEach(m=>porMes[m]={quantidade:0, valor:0});
    registros.forEach(r=>{ if(porMes[r.mes]){ porMes[r.mes].quantidade++; porMes[r.mes].valor+=Number(r.valor)||0; } });
    const hoje = new Date();
    const idxLimite = (ano === hoje.getFullYear()) ? hoje.getMonth() : 11;
    const linhasEvolucao = MESES.slice(0, idxLimite+1).map(m=>[m, porMes[m].quantidade, formatarMoeda(porMes[m].valor)]);
    blocoEvolucao = relatorioTabelaHtml('Evolução mensal', ['Mês','Atendimentos','Valor'], linhasEvolucao);
  }

  const geradoEm = new Date().toLocaleString('pt-BR');

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>ProdClin — Dados brutos — ${tituloPeriodoSimples}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#241522;padding:32px;max-width:1000px;margin:0 auto;}
  h1{font-size:22px;margin:0 0 4px;}
  .subtitulo{color:#5B4A57;font-size:13px;margin:0 0 24px;}
  h2{font-size:15px;background:#F6ECF2;padding:8px 12px;border-radius:6px;margin:28px 0 4px;}
  h3{font-size:13px;color:#5C2350;margin:18px 0 8px;}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:6px;}
  th,td{padding:6px 10px;border-bottom:1px solid #E7DDE4;text-align:left;}
  th{background:#FAFAF8;font-weight:700;text-transform:uppercase;font-size:10.5px;color:#5B4A57;}
  .kpis{display:flex;gap:16px;margin:16px 0 8px;flex-wrap:wrap;}
  .kpi{border:1px solid #E7DDE4;border-radius:8px;padding:10px 16px;min-width:140px;}
  .kpi .r{font-size:10.5px;color:#8B7A87;text-transform:uppercase;}
  .kpi .v{font-size:18px;font-weight:700;color:#3D1636;}
  .vazio-rel{color:#8B7A87;font-size:12px;}
  .rodape{margin-top:32px;font-size:11px;color:#8B7A87;border-top:1px solid #E7DDE4;padding-top:10px;}
  @media print{ body{padding:0;} h2{break-after:avoid;} table{break-inside:avoid;} }
</style></head><body>

<h1>ProdClin — Relatório de dados brutos</h1>
<p class="subtitulo">Período: <b>${tituloPeriodoSimples}</b> • Todos os profissionais e andares (sem filtros) • Gerado em ${geradoEm}</p>

<div class="kpis">
  <div class="kpi"><div class="r">Atendimentos</div><div class="v">${registros.length}</div></div>
  <div class="kpi"><div class="r">Valor total</div><div class="v">${formatarMoeda(totalValor)}</div></div>
  <div class="kpi"><div class="r">Ticket médio</div><div class="v">${formatarMoeda(registros.length?totalValor/registros.length:0)}</div></div>
  <div class="kpi"><div class="r">Profissionais ativos</div><div class="v">${profissionaisAtivos}</div></div>
</div>

<h2>Financeiro</h2>
${relatorioTabelaHtml('Por forma de pagamento', ['Forma','Qtd.','Valor'], linhasForma)}
${relatorioTabelaHtml('Por convênio', ['Convênio','Qtd.','Valor'], linhasConvenio)}

<h2>Produção por profissional</h2>
${relatorioTabelaHtml('Ranking', ['Profissional','Atendimentos','Valor realizado','Ticket médio'], linhasProf)}
${relatorioTabelaHtml('Eficiência de turnos', ['Profissional','Turnos disp.','Turnos usados','Ociosos','% eficiência'], linhasEficiencia)}

<h2>Atendimentos e exames</h2>
${relatorioTabelaHtml('Por atendimento', ['Atendimento','Qtd.','Valor'], linhasProcedimento)}
${relatorioTabelaHtml('Por exame', ['Exame','Qtd.'], linhasExame)}
${relatorioTabelaHtml('Biópsias por frascos', ['Frascos','Qtd.'], linhasBiopsia)}

${blocoEvolucao}

<div class="rodape">ProdClin — relatório de dados agregados (sem identificação de pacientes), gerado automaticamente para uso interno/análise.</div>

</body></html>`;

  janela.document.open();
  janela.document.write(html);
  janela.document.close();
  setTimeout(()=>{ try{ janela.focus(); janela.print(); }catch(e){} }, 400);
}
