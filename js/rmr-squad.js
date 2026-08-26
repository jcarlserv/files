/* =====================================================================
   ProdClin — rmr-squad.js
   Aba RMR (drill-down por andar → médico): Squad Atendimento, com Visão geral por andar e
   o detalhamento mensal de cada profissional.
   Este arquivo é carregado via <script src> em index.html, na mesma ordem
   em que aparecia originalmente dentro do <script> único — variáveis e
   funções continuam compartilhando o escopo global, exatamente como antes.
===================================================================== */

/* =====================================================================
   ABA RMR (nova) — "Squad Atendimento": drill-down por andar → médico.
   Modelo definido e validado com o usuário antes de codar (ver prompt de
   handoff, se existir, ou o histórico da conversa que introduziu esta
   versão). Resumo das decisões:
   - Andares e médicos são 100% dinâmicos (quem tiver lançamento aparece).
   - "Turnos utilizados" = combinações distintas de (data,turno) com
     lançamento naquele mês — não é mais digitado, é calculado.
   - "Valor da meta"/"Previsto" = Turnos utilizados × Vr mínimo por
     profissional (aba Metas) — substituiu os antigos "Turnos
     disponibilizados" e "Meta de quantidade" (digitados à mão), que não
     são mais usados em lugar nenhum do sistema.
   - "Meta per." = meta acumulada (soma corrida) do ano até aquele mês.
   - Categorias (a partir do campo "procedimento" + "exames" + "biopsias"):
     CONSULTA→Consultas, CIRURGIA→Cirurgias, USG ou campo Exame preenchido
     →Exames, biopsias preenchido→Biópsias (não exclusiva), resto→Procedimentos.
   - Cada médico mostra: tabela mensal "Dados de atendimento", contagem do
     mês selecionado + tabela mensal por categoria, e gráfico comparativo
     anual (ano atual × anterior).
   - Cada andar também tem uma "Visão geral" agregada (todos os médicos
     somados): Consultas/Exames/Procedimentos/Cirurgias/Biópsias do mês,
     mais Convênio e Forma de pagamento (quantidade + valor).
   - Tudo fica sempre aberto (sem colapsar), por decisão do usuário.
   - Busca própria (não reaproveita o rmrCache da aba Análises), porque
     tem filtro de Mês/Ano independente.
--------------------------------------------------------------------- */
let squadCache = {};
let squadSelectsProntos = false;


function squadSlug(texto){
  return String(texto||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-zA-Z0-9]+/g,'-').toLowerCase().replace(/^-+|-+$/g,'');
}


// Categoriza um lançamento em Consultas/Cirurgias/Exames/Procedimentos —
// Biópsias é tratada à parte (não exclusiva, ver squadRenderVisaoGeralAndar
// e squadRenderMedico) porque um lançamento pode ser, por exemplo, um
// "Procedimento" que também teve biópsia.
function squadCategoria(registro){
  const p = String(registro.procedimento||'').trim().toUpperCase();
  if(p==='CONSULTA') return 'Consultas';
  if(p==='CIRURGIA') return 'Cirurgias';
  if(p==='USG' || String(registro.exames||'').trim()) return 'Exames';
  return 'Procedimentos';
}

// Retorno (procedimento) — conta TODO Retorno, não importa o convênio (a
// versão anterior só contava Retorno + convênio particular; o usuário
// pediu pra tirar esse filtro e contar Retorno de forma geral).
function squadEhRetorno(registro){
  return String(registro.procedimento||'').trim().toUpperCase() === 'RETORNO';
}


function squadPrepararSelects(){
  if(squadSelectsProntos) return;
  const hoje = new Date();
  const anos = [hoje.getFullYear()-1, hoje.getFullYear()];
  const selAno = document.getElementById('squad-ano');
  selAno.innerHTML = anos.map(a=>`<option value="${a}" ${a===hoje.getFullYear()?'selected':''}>${a}</option>`).join('');
  const selMes = document.getElementById('squad-mes');
  selMes.innerHTML = MESES.map((m,i)=>`<option value="${m}" ${i===hoje.getMonth()?'selected':''}>${m}</option>`).join('');
  selAno.addEventListener('change', atualizarRmrSquad);
  selMes.addEventListener('change', atualizarRmrSquad);


  // Andar e Profissional não precisam buscar de novo — os dados do ano já
  // estão no squadCache, então só reprocessam (squadRenderizarTudo) na hora.
  // "Todos" (sem escolher andar) mostra Térreo e Coparticipados juntos —
  // necessário pra Apresentação, que soma os dois. O Profissional só lista
  // quem realmente atua no(s) andar(es) visível(is) no momento.
  const selAndar = document.getElementById('squad-andar');
  selAndar.innerHTML = '<option value="">Todos</option>' +
    (estado.listas.andares||[]).map(a=>`<option value="${a}">${a}</option>`).join('');
  selAndar.addEventListener('change', ()=>{
    squadAtualizarFiltroProfissional();
    squadRenderizarTudo();
  });


  const selProf = document.getElementById('squad-prof');
  selProf.addEventListener('change', squadRenderizarTudo);
  squadAtualizarFiltroProfissional();

  document.getElementById('rmr-botao-apresentar').style.display = temPermissao('ver_apresentacao') ? 'inline-flex' : 'none';
  apresentacaoPrepararSelects();

  squadSelectsProntos = true;
}


// Lista de profissionais que têm pelo menos um lançamento no andar
// escolhido (dentro do ano já carregado em squadCache) — usada tanto pra
// popular o select quanto internamente.
function squadProfissionaisDoAndar(andar){
  if(!squadCache.registrosAno) return [];
  const alvo = (andar||'').trim().toUpperCase();
  return Array.from(new Set(
    squadCache.registrosAno
      .filter(r => !alvo || String(r.andar||'').trim().toUpperCase()===alvo)
      .map(r => r.prof)
  )).filter(Boolean).sort();
}


// Reconstrói o select de Profissional de acordo com o andar escolhido — sem
// andar escolhido, lista todo mundo (Térreo + Coparticipados juntos).
function squadAtualizarFiltroProfissional(){
  const selProf = document.getElementById('squad-prof');
  const andar = document.getElementById('squad-andar').value;
  const valorAnterior = selProf.value;

  const profissionais = squadProfissionaisDoAndar(andar);
  selProf.disabled = false;
  selProf.innerHTML = '<option value="">Todos</option>' +
    profissionais.map(p=>`<option value="${p}">${p}</option>`).join('');
  if(profissionais.includes(valorAnterior)) selProf.value = valorAnterior;
}


async function atualizarRmrSquad(){
  squadPrepararSelects();
  const mes = document.getElementById('squad-mes').value;
  const ano = Number(document.getElementById('squad-ano').value);
  const anoAnterior = ano - 1;
  const container = document.getElementById('squad-conteudo');
  container.innerHTML = '<p class="vazio">Carregando dados do período...</p>';


  let prodAno, prodAnoAnterior, metasAno;
  try{
    [prodAno, prodAnoAnterior, metasAno] = await Promise.all([
      buscarProducaoCompleta({ano}),
      buscarProducaoCompleta({ano:anoAnterior}),
      api('listarMetas', {ano})
    ]);
  }catch(e){
    container.innerHTML = '<p class="vazio">Erro de conexão com o servidor.</p>';
    return;
  }
  if(!prodAno.ok || !prodAnoAnterior.ok){
    container.innerHTML = `<p class="vazio">${(prodAno.erro||prodAnoAnterior.erro)||'Não foi possível carregar os dados.'}</p>`;
    return;
  }


  squadCache = {
    mes, ano, anoAnterior,
    registrosAno: prodAno.registros||[],
    registrosAnoAnterior: prodAnoAnterior.registros||[],
    metasAno: metasAno.metas||[]
  };


  // O ano pode ter mudado, então a lista de profissionais do andar
  // escolhido pode ter mudado também — atualiza antes de renderizar.
  squadAtualizarFiltroProfissional();
  squadRenderizarTudo();
}


function squadRenderizarTudo(){
  if(!squadCache.registrosAno) return; // ainda não carregou (guarda contra troca de filtro muito rápida)
  const { mes, ano, anoAnterior, registrosAno, registrosAnoAnterior, metasAno } = squadCache;
  const container = document.getElementById('squad-conteudo');
  const andarFiltro = document.getElementById('squad-andar').value;
  const profFiltro = document.getElementById('squad-prof').value;


  const tituloHtml = `<div style="margin:8px 0 22px;">
    <div style="font-family:'Fraunces',serif;font-weight:700;font-size:26px;color:var(--plum-900);">Squad Atendimento</div>
    <div style="height:3px;background:var(--plum-900);border-radius:2px;margin-top:8px;"></div>
  </div>`;


  // Ordem dos andares: usa a ordem já configurada em Configurações > Listas
  // (estado.listas.andares), filtrando só os que realmente têm lançamento
  // no ano — assim não aparece um andar vazio, e a ordem fica previsível.
  // Sem "Andar" escolhido (Todos), mostra os dois juntos — a Apresentação
  // (aberta a partir desta aba) precisa dos dados combinados dos dois.
  let andaresPresentes = (estado.listas.andares||[]).filter(a =>
    registrosAno.some(r => String(r.andar||'').trim().toUpperCase() === a.trim().toUpperCase())
  );
  if(andarFiltro){
    andaresPresentes = andaresPresentes.filter(a => a.trim().toUpperCase()===andarFiltro.trim().toUpperCase());
  }


  if(andaresPresentes.length===0){
    container.innerHTML = tituloHtml + '<p class="vazio">Nenhum lançamento encontrado nesse andar/período.</p>';
    return;
  }


  const blocosAndar = andaresPresentes
    .map(andar => squadRenderAndar(andar, mes, ano, anoAnterior, registrosAno, registrosAnoAnterior, metasAno, profFiltro))
    .filter(bloco => bloco); // squadRenderAndar devolve '' quando o profissional filtrado não está naquele andar


  if(blocosAndar.length===0){
    container.innerHTML = tituloHtml + '<p class="vazio">Nenhum lançamento encontrado com esses filtros.</p>';
    return;
  }


  let html = tituloHtml;
  html += blocosAndar.join('');
  html += `<div id="squad-financeiro-conteudo" style="margin-top:36px;"></div>`;


  container.innerHTML = html;


  // Os gráficos precisam dos elementos já no DOM, então só são desenhados
  // depois que o innerHTML acima terminou de ser aplicado.
  andaresPresentes.forEach(andar=>{
    squadDesenharGraficosAndar(andar, mes, ano, anoAnterior, registrosAno, registrosAnoAnterior, profFiltro);
  });


  // Squad Financeiro — resumo do DRE do mesmo mês/ano, no final da tela.
  // Assíncrono à parte (não trava o resto do render, que já é tudo síncrono
  // a partir dos dados já carregados em squadCache).
  squadRenderizarFinanceiro(mes, ano);
}


function squadRenderAndar(andar, mes, ano, anoAnterior, registrosAno, registrosAnoAnterior, metasAno, profFiltro){
  const alvo = andar.trim().toUpperCase();
  const registrosAndarAno = registrosAno.filter(r=>String(r.andar||'').trim().toUpperCase()===alvo);
  const registrosAndarAnoAnterior = registrosAnoAnterior.filter(r=>String(r.andar||'').trim().toUpperCase()===alvo);
  const doMesAndar = registrosAndarAno.filter(r=>r.mes===mes);


  let profissionais = Array.from(new Set(registrosAndarAno.map(r=>r.prof))).filter(Boolean).sort();
  if(profFiltro) profissionais = profissionais.filter(p=>p===profFiltro);


  // Se filtrou por um profissional que não atua nesse andar, não mostra o
  // subcapítulo inteiro (evita título de andar vazio, sem médico nenhum).
  if(profFiltro && profissionais.length===0) return '';


  let html = `<div style="display:flex;align-items:center;gap:10px;margin:28px 0 14px 4px;">
    <span style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--plum-500);">${andar}</span>
    <div style="flex:1;height:1px;background:var(--line);"></div>
  </div>`;


  // A "Visão geral" soma todos os médicos do andar — não faz sentido
  // mostrar quando o usuário já filtrou por um médico específico.
  if(!profFiltro){
    html += squadRenderVisaoGeralAndar(andar, doMesAndar);
  }


  profissionais.forEach(prof=>{
    html += squadRenderMedico(andar, prof, mes, ano, anoAnterior, registrosAndarAno, registrosAndarAnoAnterior, metasAno);
  });


  return html;
}


// "Visão geral" do andar inteiro (todos os médicos somados) — reaproveita a
// mesma lógica de categorização, convênio e forma de pagamento (incluindo
// pagamento dividido, via partesPagamentoDe) já usadas no resto do sistema.
function squadRenderVisaoGeralAndar(andar, doMesAndar){
  const porCategoria = {};
  doMesAndar.forEach(r=>{
    const cat = squadCategoria(r);
    porCategoria[cat] = (porCategoria[cat]||0) + 1;
  });
  const comBiopsia = doMesAndar.filter(r=>r.biopsias).length;


  const porConvenio = {};
  doMesAndar.forEach(r=>{
    const c = r.convenio || 'PARTICULAR';
    if(!porConvenio[c]) porConvenio[c] = {quantidade:0, valor:0};
    porConvenio[c].quantidade++; porConvenio[c].valor += Number(r.valor)||0;
  });


  const porForma = {};
  doMesAndar.forEach(r=>{
    partesPagamentoDe(r).forEach(p=>{
      const forma = String(p.forma||'').trim().toUpperCase() || 'NÃO INFORMADA';
      if(!porForma[forma]) porForma[forma] = {quantidade:0, valor:0};
      porForma[forma].quantidade++; porForma[forma].valor += Number(p.valor)||0;
    });
  });


  const linhasResumo = [
    {rotulo:'Consultas', valor:porCategoria['Consultas']||0},
    {rotulo:'Exames', valor:porCategoria['Exames']||0},
    {rotulo:'Procedimentos', valor:porCategoria['Procedimentos']||0},
    {rotulo:'Cirurgias', valor:porCategoria['Cirurgias']||0},
    {rotulo:'Biópsias', valor:comBiopsia}
  ];


  const linhasConvenio = Object.keys(porConvenio).sort((a,b)=>porConvenio[b].valor-porConvenio[a].valor);
  const linhasForma = Object.keys(porForma).sort((a,b)=>porForma[b].valor-porForma[a].valor);


  return `<div class="cartao" style="margin-left:10px;">
    <h3>Visão geral — ${andar}</h3>
    <div class="grade-kpi" style="margin-bottom:18px;">
      ${linhasResumo.map(l=>`<div class="kpi"><div class="rotulo">${l.rotulo}</div><div class="valor">${l.valor}</div></div>`).join('')}
    </div>
    <div class="grade-2">
      <div>
        <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-600);margin-bottom:10px;">Convênio</div>
        <div class="tabela-scroll"><table>
          <thead><tr><th>Convênio</th><th>Qtd.</th><th>Valor</th></tr></thead>
          <tbody>${linhasConvenio.length ? linhasConvenio.map(c=>`
            <tr><td>${c}</td><td>${porConvenio[c].quantidade}</td><td class="mono">${formatarMoeda(porConvenio[c].valor)}</td></tr>`).join('') : '<tr><td class="vazio">Sem dados.</td></tr>'}</tbody>
        </table></div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-600);margin-bottom:10px;">Forma de pagamento</div>
        <div class="tabela-scroll"><table>
          <thead><tr><th>Forma</th><th>Qtd.</th><th>Valor</th></tr></thead>
          <tbody>${linhasForma.length ? linhasForma.map(f=>`
            <tr><td>${f}</td><td>${porForma[f].quantidade}</td><td class="mono">${formatarMoeda(porForma[f].valor)}</td></tr>`).join('') : '<tr><td class="vazio">Sem dados.</td></tr>'}</tbody>
        </table></div>
      </div>
    </div>
  </div>`;
}


// Bloco completo de um médico dentro de um andar: tabela mensal "Dados de
// atendimento", categorias (mês selecionado + mensal) e o container do
// gráfico (desenhado depois, em squadDesenharGraficosAndar).
function squadRenderMedico(andar, prof, mesRef, ano, anoAnterior, registrosAndarAno, registrosAndarAnoAnterior, metasAno){
  const idSlug = squadSlug(andar)+'-'+squadSlug(prof);
  const registrosProfAno = registrosAndarAno.filter(r=>r.prof===prof);
  const registrosProfAnoAnterior = registrosAndarAnoAnterior.filter(r=>r.prof===prof);
  const metasProf = metasAno.filter(m=>m.prof===prof);


  const idxMesRef = MESES.indexOf(mesRef);
  const mesesAteRef = MESES.slice(0, idxMesRef+1);


  // "Dados de atendimento" — Meta per. é a meta ACUMULADA (soma corrida)
  // até aquele mês, não o valor isolado do mês (esse é a coluna Previsto).
  // Previsto = Turnos Utilizados SALVO na aba Metas (editável — vem
  // sugerido com a contagem real, mas o usuário pode ajustar) × Vr
  // mínimo esperado por turno daquele profissional.
  let metaAcumulada = 0;
  const linhasAtendimento = mesesAteRef.map(mes=>{
    const doMes = registrosProfAno.filter(r=>r.mes===mes);
    const doMesAnterior = registrosProfAnoAnterior.filter(r=>r.mes===mes);
    const metaDoMes = metasProf.find(m=>m.mes===mes) || {};
    const turnosUsados = new Set(doMes.map(r=>r.data+'_'+r.turno)).size;
    const turnosMeta = Number(metaDoMes.turnos_utilizados)||0;
    const vrMinimo = Number(metaDoMes.valor_minimo_turno)||0;
    const previsto = turnosMeta * vrMinimo;
    metaAcumulada += previsto;
    const realizadoAno = doMes.reduce((s,r)=>s+(Number(r.valor)||0),0);
    const realizadoAnoAnterior = doMesAnterior.reduce((s,r)=>s+(Number(r.valor)||0),0);
    const mediaPer = turnosUsados ? realizadoAno/turnosUsados : 0;
    return {mes, prdUteis:turnosUsados, previsto, realizadoAno, realizadoAnoAnterior, metaPer: metaAcumulada, mediaPer};
  });


  const tabelaAtendimentoHtml = `<div class="tabela-scroll"><table>
    <thead><tr><th>Mês</th><th>Turnos utilizados</th><th>Valor da meta</th><th>Realizado ${ano}</th><th>Realizado ${anoAnterior}</th><th>Meta per.</th><th>Média per.</th></tr></thead>
    <tbody>${linhasAtendimento.map(l=>`
      <tr><td>${l.mes}</td><td>${l.prdUteis||'—'}</td><td class="mono">${l.previsto?formatarMoeda(l.previsto):'—'}</td>
      <td class="mono">${formatarMoeda(l.realizadoAno)}</td><td class="mono">${formatarMoeda(l.realizadoAnoAnterior)}</td>
      <td class="mono">${l.metaPer?formatarMoeda(l.metaPer):'—'}</td><td class="mono">${formatarMoeda(l.mediaPer)}</td></tr>`).join('')}</tbody>
  </table></div>`;


  // Categorias — contagem do mês selecionado (linha de KPIs) + tabela
  // mensal (uma tabela só, categorias em coluna, mais compacta que 5
  // tabelas separadas).
  const categorias = ['Consultas','Exames','Procedimentos','Cirurgias'];
  const doMesAtualProf = registrosProfAno.filter(r=>r.mes===mesRef);
  const contagemMesAtual = {};
  categorias.forEach(c=>contagemMesAtual[c]=0);
  doMesAtualProf.forEach(r=>{ const c = squadCategoria(r); contagemMesAtual[c] = (contagemMesAtual[c]||0)+1; });
  contagemMesAtual['Biópsias'] = doMesAtualProf.filter(r=>r.biopsias).length;
  contagemMesAtual['Retorno'] = doMesAtualProf.filter(squadEhRetorno).length;
  const categoriasComBiopsia = [...categorias, 'Biópsias', 'Retorno'];


  const resumoMesAtualHtml = `<div class="grade-kpi" style="margin-bottom:16px;">
    ${categoriasComBiopsia.map(c=>`<div class="kpi"><div class="rotulo">${c}</div><div class="valor">${contagemMesAtual[c]||0}</div></div>`).join('')}
  </div>`;


  const linhasMensalCategoria = mesesAteRef.map(mes=>{
    const doMes = registrosProfAno.filter(r=>r.mes===mes);
    const contagem = {};
    categorias.forEach(c=>contagem[c]=0);
    doMes.forEach(r=>{ const c = squadCategoria(r); contagem[c] = (contagem[c]||0)+1; });
    contagem['Biópsias'] = doMes.filter(r=>r.biopsias).length;
    contagem['Retorno'] = doMes.filter(squadEhRetorno).length;
    return {mes, ...contagem};
  });
  const tabelaMensalCategoriaHtml = `<div class="tabela-scroll"><table>
    <thead><tr><th>Mês</th>${categoriasComBiopsia.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
    <tbody>${linhasMensalCategoria.map(l=>`<tr><td>${l.mes}</td>${categoriasComBiopsia.map(c=>`<td>${l[c]||0}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;


  const graficoId = `squad-grafico-${idSlug}`;


  return `<div class="cartao" style="margin:0 0 14px 10px;">
    <h3>${prof}</h3>


    <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-600);margin-bottom:10px;">Dados de atendimento</div>
    ${tabelaAtendimentoHtml}


    <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-600);margin:18px 0 10px;">Exames, procedimentos, consultas, cirurgias e biópsias</div>
    ${resumoMesAtualHtml}
    ${tabelaMensalCategoriaHtml}


    <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-600);margin:18px 0 10px;">Comparativo anual</div>
    <div id="${graficoId}" class="mini-grafico" style="min-height:220px;"></div>
  </div>`;
}


// Desenha os gráficos de todos os médicos de um andar — precisa rodar
// DEPOIS do innerHTML já ter sido aplicado (os containers só existem no
// DOM nesse momento).
function squadDesenharGraficosAndar(andar, mes, ano, anoAnterior, registrosAno, registrosAnoAnterior, profFiltro){
  const alvo = andar.trim().toUpperCase();
  const registrosAndarAno = registrosAno.filter(r=>String(r.andar||'').trim().toUpperCase()===alvo);
  const registrosAndarAnoAnterior = registrosAnoAnterior.filter(r=>String(r.andar||'').trim().toUpperCase()===alvo);
  let profissionais = Array.from(new Set(registrosAndarAno.map(r=>r.prof))).filter(Boolean).sort();
  if(profFiltro) profissionais = profissionais.filter(p=>p===profFiltro);
  const idxMesRef = MESES.indexOf(mes);
  const mesesAteRef = MESES.slice(0, idxMesRef+1);


  profissionais.forEach(prof=>{
    const idSlug = squadSlug(andar)+'-'+squadSlug(prof);
    const registrosProfAno = registrosAndarAno.filter(r=>r.prof===prof);
    const registrosProfAnoAnterior = registrosAndarAnoAnterior.filter(r=>r.prof===prof);
    const valoresAno = mesesAteRef.map(m=>registrosProfAno.filter(r=>r.mes===m).reduce((s,r)=>s+(Number(r.valor)||0),0));
    const valoresAnoAnterior = mesesAteRef.map(m=>registrosProfAnoAnterior.filter(r=>r.mes===m).reduce((s,r)=>s+(Number(r.valor)||0),0));
    miniGraficoLinhas(`squad-grafico-${idSlug}`, mesesAteRef, [
      {nome:String(ano), dados:valoresAno, cor:'#5C2350'},
      {nome:String(anoAnterior), dados:valoresAnoAnterior, cor:'#C495B8', tracejado:true}
    ]);
  });
}


/* ---------------------------------------------------------------------
   SQUAD FINANCEIRO — resumo do DRE do plano de contas (aba Financeiro),
   pro mesmo mês/ano já selecionado aqui na RMR. Reaproveita as funções de
   financeiro.js — não duplica a lógica de soma/natureza.
--------------------------------------------------------------------- */
async function squadRenderizarFinanceiro(mes, ano){
  const container = document.getElementById('squad-financeiro-conteudo');
  if(!container) return; // usuário já trocou de tela antes disso terminar
  container.innerHTML = '<p class="vazio">Carregando financeiro...</p>';

  await financeiroCarregarContas();
  await financeiroCarregarValores(mes, ano);

  const temFinanceiro = Object.keys(financeiroValoresCache).some(cod=>Number(financeiroValoresCache[cod])>0);
  if(!temFinanceiro){
    container.innerHTML = `
      <div style="margin:8px 0 22px;">
        <div style="font-family:'Fraunces',serif;font-weight:700;font-size:26px;color:var(--plum-900);">Squad Financeiro</div>
        <div style="height:3px;background:var(--plum-900);border-radius:2px;margin-top:8px;"></div>
      </div>
      <p class="vazio">Nenhum valor lançado no plano de contas para ${mes} de ${ano} ainda. Cadastre na aba Financeiro para este resumo aparecer.</p>`;
    return;
  }

  const dre = financeiroCalcularDre();
  container.innerHTML = `
    <div style="margin:8px 0 22px;">
      <div style="font-family:'Fraunces',serif;font-weight:700;font-size:26px;color:var(--plum-900);">Squad Financeiro</div>
      <div style="height:3px;background:var(--plum-900);border-radius:2px;margin-top:8px;"></div>
    </div>
    <div class="grade-kpi">
      <div class="kpi"><div class="rotulo">Receita líquida</div><div class="valor teal">${formatarMoeda(dre.receitaLiquida)}</div></div>
      <div class="kpi"><div class="rotulo">Lucro bruto</div><div class="valor">${formatarMoeda(dre.lucroBruto)}</div></div>
      <div class="kpi"><div class="rotulo">Resultado operacional (EBITDA)</div><div class="valor">${formatarMoeda(dre.resultadoOperacional)}</div></div>
      <div class="kpi"><div class="rotulo">Lucro líquido</div><div class="valor" style="color:${dre.lucroLiquido<0?'var(--danger)':'inherit'};">${formatarMoeda(dre.lucroLiquido)}</div></div>
      <div class="kpi"><div class="rotulo">Margem líquida</div><div class="valor">${dre.margemLiquidaPct===null?'—':dre.margemLiquidaPct.toFixed(1)+'%'}</div></div>
    </div>
    <div class="cartao" style="margin-top:18px;">
      <h3>Estrutura de Custos</h3>
      <p style="margin:-6px 0 14px;color:var(--ink-400);font-size:12.5px;">% sobre a receita bruta</p>
      <div id="squad-grafico-estrutura-custos" class="mini-grafico" style="min-height:260px;"></div>
    </div>`;

  const receitaBruta = financeiroValorDaConta('3.1', financeiroContasCache, financeiroValoresCache) || 1;
  const grupos = financeiroFilhosDe('5', financeiroContasCache).slice();
  const contaCsp = financeiroContasCache.find(c=>c.codigo==='4');
  if(contaCsp) grupos.unshift(contaCsp);
  const itens = grupos.map(g=>[
    g.nome.length>16 ? g.nome.slice(0,15)+'…' : g.nome,
    Math.abs(financeiroValorDaConta(g.codigo, financeiroContasCache, financeiroValoresCache))
  ]).filter(i=>i[1]>0);
  if(itens.length){
    miniGraficoBarras('squad-grafico-estrutura-custos', itens.map(i=>i[0]), itens.map(i=>Math.round((i[1]/receitaBruta)*1000)/10), '#9C6E22');
  }
}
