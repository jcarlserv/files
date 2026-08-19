/* =====================================================================
   ABA APRESENTAÇÃO — monta sozinha, a partir do banco, uma "reunião mensal
   de resultados" navegável em slides (e exportável em PDF), sem que
   ninguém precise exportar/enviar nada manualmente todo mês.

   Duas fontes de dado bem diferentes:
   1) Produção (tabela `producao`) — 100% automático, igual ao resto do
      sistema, incluindo a quebra por Andar (Térreo × Coparticipados).
   2) Financeiro/DRE (tabela `financeiro_dre`) — digitado manualmente uma
      vez por mês na aba Metas (não dá pra calcular a partir da produção,
      é dado contábil). Se o mês não tiver DRE cadastrado, as telas
      financeiras aparecem em branco, com um aviso — não inventamos nada.

   Simplificação assumida (documentada aqui, não escondida): "Previsto ×
   Realizado" por andar usa a SOMA de meta_qtd/meta_valor dos profissionais
   cadastrados NAQUELE andar (só entram profissionais ligados a um único
   andar — ver `estado.profissionaisAndares` — para não contar duas vezes
   quem atende nos dois). O ProdClin não guarda meta por categoria de
   procedimento (consulta/exame/cirurgia em separado), só por profissional
   e mês — então essa quebra fina, que existia no PDF de referência, não
   está disponível aqui.
===================================================================== */
let apresentacaoSelectsProntos = false;
let apresentacaoSlides = [];
let apresentacaoIndice = 0;

function apresentacaoPrepararSelects(){
  if(apresentacaoSelectsProntos) return;
  const hoje = new Date();
  const anos = [hoje.getFullYear()-1, hoje.getFullYear()];
  const selAno = document.getElementById('apresentacao-ano');
  selAno.innerHTML = anos.map(a=>`<option value="${a}" ${a===hoje.getFullYear()?'selected':''}>${a}</option>`).join('');
  const selMes = document.getElementById('apresentacao-mes');
  selMes.innerHTML = MESES.map((m,i)=>`<option value="${m}" ${i===hoje.getMonth()?'selected':''}>${m}</option>`).join('');
  selAno.addEventListener('change', atualizarApresentacao);
  selMes.addEventListener('change', atualizarApresentacao);

  document.getElementById('apresentacao-anterior').addEventListener('click', ()=>apresentacaoIrPara(apresentacaoIndice-1));
  document.getElementById('apresentacao-proxima').addEventListener('click', ()=>apresentacaoIrPara(apresentacaoIndice+1));
  document.getElementById('apresentacao-botao-tela-cheia').addEventListener('click', apresentacaoAlternarTelaCheia);
  document.getElementById('apresentacao-botao-exportar-pdf').addEventListener('click', apresentacaoExportarPdf);

  document.addEventListener('keydown', (ev)=>{
    if(estado.abaAtiva!=='apresentacao') return;
    if(ev.key==='ArrowRight') apresentacaoIrPara(apresentacaoIndice+1);
    if(ev.key==='ArrowLeft') apresentacaoIrPara(apresentacaoIndice-1);
  });

  apresentacaoSelectsProntos = true;
}

// Alterna tela cheia SÓ do palco (#apresentacao-stage) — não a janela toda.
function apresentacaoAlternarTelaCheia(){
  const palco = document.getElementById('apresentacao-stage');
  if(document.fullscreenElement){
    document.exitFullscreen();
  } else if(palco.requestFullscreen){
    palco.requestFullscreen();
  }
}

// Mostra TODAS as slides (via classe no body, ver CSS) e imprime — depois
// volta ao normal (evento afterprint). Não depende de nenhuma função
// definida em outro arquivo, então é seguro registrar aqui mesmo no topo.
function apresentacaoExportarPdf(){
  document.body.classList.add('apresentacao-imprimindo');
  window.print();
}
window.addEventListener('afterprint', ()=>{
  document.body.classList.remove('apresentacao-imprimindo');
});

function apresentacaoIrPara(indice){
  if(apresentacaoSlides.length===0) return;
  apresentacaoIndice = Math.max(0, Math.min(apresentacaoSlides.length-1, indice));
  document.querySelectorAll('.apresentacao-slide').forEach((el,i)=>{
    el.classList.toggle('ativa', i===apresentacaoIndice);
  });
  document.getElementById('apresentacao-indicador').textContent = `${apresentacaoIndice+1} / ${apresentacaoSlides.length}`;
}

/* ---------------------------------------------------------------------
   BUSCA DE DADOS
--------------------------------------------------------------------- */
function apresentacaoMesAnterior(mes, ano){
  const idx = MESES.indexOf(mes);
  if(idx===0) return { mes: 'Dezembro', ano: Number(ano)-1 };
  return { mes: MESES[idx-1], ano: Number(ano) };
}

// Profissionais ligados a UM SÓ andar (ver simplificação no cabeçalho do arquivo).
function apresentacaoProfissionaisDeUmAndarSo(andarAlvo){
  const resultado = [];
  Object.keys(estado.profissionaisAndares||{}).forEach(prof=>{
    const andares = estado.profissionaisAndares[prof]||[];
    if(andares.length===1 && andares[0].trim().toUpperCase()===andarAlvo) resultado.push(prof);
  });
  return resultado;
}

function apresentacaoFiltrarAndar(registros, andar){
  const alvo = andar.trim().toUpperCase();
  return registros.filter(r => String(r.andar||'').trim().toUpperCase()===alvo);
}

async function atualizarApresentacao(){
  apresentacaoPrepararSelects();
  const mes = document.getElementById('apresentacao-mes').value;
  const ano = Number(document.getElementById('apresentacao-ano').value);
  const anoAnterior = ano - 1;
  const { mes: mesAnt, ano: anoAnt } = apresentacaoMesAnterior(mes, ano);

  const stage = document.getElementById('apresentacao-stage');
  stage.innerHTML = '<p class="vazio">Montando a apresentação...</p>';

  let registrosAno, registrosAnoAnterior, registrosMesAnterior, metasMes, dreResp;
  try{
    const { dataInicio, dataFim } = primeiroEUltimoDiaDoMes(mes, ano);
    const { dataInicio: diAnt, dataFim: dfAnt } = primeiroEUltimoDiaDoMes(mesAnt, anoAnt);
    [registrosAno, registrosAnoAnterior, registrosMesAnterior, metasMes, dreResp] = await Promise.all([
      buscarProducaoCompleta({ano}),
      buscarProducaoCompleta({ano:anoAnterior}),
      buscarProducaoCompleta({dataInicio:diAnt, dataFim:dfAnt}),
      api('listarMetas', {mes, ano}),
      api('obterFinanceiroDre', {mes, ano})
    ]);
  }catch(e){
    stage.innerHTML = `<p class="vazio">Erro ao carregar os dados: ${e.message||e}</p>`;
    return;
  }
  if(!registrosAno.ok || !registrosAnoAnterior.ok || !registrosMesAnterior.ok){
    stage.innerHTML = '<p class="vazio">Não foi possível carregar os dados de produção.</p>';
    return;
  }

  const todosRegistrosAno = registrosAno.registros||[];
  const registrosMes = todosRegistrosAno.filter(r=>r.mes===mes);
  const registrosMesAnt = registrosMesAnterior.registros||[];
  const registrosAnoAnt = registrosAnoAnterior.registros||[];
  const metas = metasMes.ok ? metasMes.metas : [];
  const dre = (dreResp.ok && dreResp.dre) ? dreResp.dre : null;

  const dados = {
    mes, ano, mesAnt, anoAnt, anoAnterior,
    registrosMes, registrosMesAnt, todosRegistrosAno, registrosAnoAnt, metas, dre
  };

  const slidesHtml = apresentacaoConstruirSlides(dados);
  stage.innerHTML = slidesHtml.map((html,i)=>`<div class="apresentacao-slide ${html.classe||''}">${html.conteudo}</div>`).join('');
  apresentacaoSlides = slidesHtml;
  apresentacaoIndice = 0;
  apresentacaoIrPara(0);

  // Desenha os gráficos DEPOIS do innerHTML acima ter sido aplicado —
  // funciona em slides escondidas também (SVG com viewBox fixo).
  apresentacaoDesenharGraficos(dados);
}

/* ---------------------------------------------------------------------
   AGREGAÇÕES REUTILIZÁVEIS
--------------------------------------------------------------------- */
function apresentacaoAgruparPorConvenio(registros){
  const grupos = {};
  registros.forEach(r=>{
    const c = r.convenio || 'PARTICULAR';
    if(!grupos[c]) grupos[c] = {quantidade:0, valor:0};
    grupos[c].quantidade++; grupos[c].valor += Number(r.valor)||0;
  });
  return grupos;
}

function apresentacaoAgruparPorMes(registros){
  const porMes = {};
  MESES.forEach(m=>porMes[m]={quantidade:0, valor:0});
  registros.forEach(r=>{ if(porMes[r.mes]){ porMes[r.mes].quantidade++; porMes[r.mes].valor += Number(r.valor)||0; } });
  return porMes;
}

function apresentacaoMesesAte(mes, ano){
  const hoje = new Date();
  const idxLimite = (Number(ano)===hoje.getFullYear()) ? Math.min(hoje.getMonth(), MESES.indexOf(mes)) : MESES.indexOf(mes);
  return MESES.slice(0, idxLimite+1);
}

/* ---------------------------------------------------------------------
   MONTAGEM DAS SLIDES (HTML) — cada função devolve {classe, conteudo}
--------------------------------------------------------------------- */
function apresentacaoConstruirSlides(d){
  const slides = [];
  const add = (classe, conteudo) => slides.push({classe, conteudo});

  const totalMes = d.registrosMes.length;
  const totalMesAnt = d.registrosMesAnt.length;
  const valorMes = d.registrosMes.reduce((s,r)=>s+(Number(r.valor)||0),0);
  const valorMesAnt = d.registrosMesAnt.reduce((s,r)=>s+(Number(r.valor)||0),0);
  const profissionaisAtivos = new Set(d.registrosMes.map(r=>r.prof)).size;
  const variacao = (atual, anterior) => anterior ? Math.round(((atual-anterior)/anterior)*1000)/10 : null;
  const varValor = variacao(valorMes, valorMesAnt);
  const varQtd = variacao(totalMes, totalMesAnt);

  // ---------- 1. CAPA ----------
  add('apresentacao-capa', `
    <div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--plum-300);margin-bottom:14px;">REUNIÃO MENSAL DE RESULTADOS</div>
    <h1 style="font-family:'Fraunces',serif;font-size:38px;margin:0 0 8px;">Relatório de Produção e Desempenho Clínico</h1>
    <div style="font-size:17px;color:var(--plum-300);margin-bottom:18px;">${d.mes} de ${d.ano}</div>
    <p style="max-width:640px;font-size:13px;color:var(--rose-100);font-style:italic;">
      Consolidação automática da produção, faturamento e eficiência operacional, com base nos dados do ProdClin.
    </p>`);

  // ---------- 2. RESUMO EXECUTIVO ----------
  add('', `
    <h2>Resumo Executivo — ${d.mes} ${d.ano}</h2>
    <p class="apresentacao-legenda">Principais indicadores do mês e comparação com ${d.mesAnt}</p>
    <div class="grade-kpi" style="margin-bottom:0;">
      <div class="kpi"><div class="rotulo">Valor produzido</div><div class="valor teal">${formatarMoeda(valorMes)}</div>
        ${varValor!==null?`<div style="font-size:12px;font-weight:600;margin-top:4px;color:${varValor>=0?'var(--teal-700)':'var(--danger)'};">${varValor>=0?'▲':'▼'} ${Math.abs(varValor)}% vs ${d.mesAnt}</div>`:''}
      </div>
      <div class="kpi"><div class="rotulo">Atendimentos no mês</div><div class="valor">${totalMes}</div>
        ${varQtd!==null?`<div style="font-size:12px;font-weight:600;margin-top:4px;color:${varQtd>=0?'var(--teal-700)':'var(--danger)'};">${varQtd>=0?'▲':'▼'} ${Math.abs(varQtd)}% vs ${d.mesAnt}</div>`:''}
      </div>
      <div class="kpi"><div class="rotulo">Ticket médio</div><div class="valor">${formatarMoeda(totalMes?valorMes/totalMes:0)}</div></div>
      <div class="kpi"><div class="rotulo">Profissionais ativos</div><div class="valor">${profissionaisAtivos}</div></div>
    </div>`);

  // ---------- 3. EVOLUÇÃO ANO ----------
  const mesesAte = apresentacaoMesesAte(d.mes, d.ano);
  add('', `
    <h2>Evolução da Produção Financeira (${d.ano})</h2>
    <p class="apresentacao-legenda">Faturamento mensal — Janeiro a ${d.mes}</p>
    <div id="apr-grafico-evolucao" class="mini-grafico" style="min-height:280px;"></div>`);

  // ---------- 4. COMPOSIÇÃO POR ANDAR ----------
  add('', `
    <h2>Composição da Receita por Andar</h2>
    <p class="apresentacao-legenda">Faturamento mensal — Térreo × Coparticipados</p>
    <div id="apr-grafico-composicao-andar" class="mini-grafico" style="min-height:280px;"></div>`);

  // ---------- 5. DIVISOR TÉRREO ----------
  add('apresentacao-divisor', `
    <h1 style="font-family:'Fraunces',serif;font-size:32px;margin:0 0 8px;">SETOR TÉRREO</h1>
    <p class="apresentacao-legenda" style="font-size:14px;">Consultas, exames, cirurgias e procedimentos</p>`);

  const registrosTerreo = apresentacaoFiltrarAndar(d.registrosMes, 'TÉRREO');
  const registrosCoparticipados = apresentacaoFiltrarAndar(d.registrosMes, 'COPARTICIPADOS');

  // ---------- 6. TÉRREO — Particular × Convênios ----------
  const porConvenioTerreo = apresentacaoAgruparPorConvenio(registrosTerreo);
  const chavesConvTerreo = Object.keys(porConvenioTerreo).sort((a,b)=>porConvenioTerreo[b].valor-porConvenioTerreo[a].valor);
  const totalTerreo = registrosTerreo.reduce((s,r)=>s+(Number(r.valor)||0),0);
  add('', `
    <h2>Térreo — Particular × Convênios</h2>
    <p class="apresentacao-legenda">${d.mes} de ${d.ano} • Total do setor: ${formatarMoeda(totalTerreo)}</p>
    <div class="grade-2">
      <div id="apr-grafico-terreo-convenio" class="mini-grafico" style="min-height:260px;"></div>
      <div class="tabela-scroll"><table>
        <thead><tr><th>Convênio</th><th>Qtd.</th><th>Valor</th><th>%</th></tr></thead>
        <tbody>${chavesConvTerreo.slice(0,8).map(c=>`
          <tr><td>${c}</td><td>${porConvenioTerreo[c].quantidade}</td><td class="mono">${formatarMoeda(porConvenioTerreo[c].valor)}</td>
          <td class="mono">${totalTerreo?Math.round(porConvenioTerreo[c].valor/totalTerreo*100):0}%</td></tr>`).join('')}
        </tbody>
      </table></div>
    </div>`);

  // ---------- 7. TÉRREO — Previsto × Realizado ----------
  const profsTerreo = apresentacaoProfissionaisDeUmAndarSo('TÉRREO');
  const metasTerreo = d.metas.filter(m=>profsTerreo.includes(m.prof));
  const previstoQtdTerreo = arredondar1(metasTerreo.reduce((s,m)=>s+(Number(m.meta_qtd)||0),0));
  const previstoValorTerreo = metasTerreo.reduce((s,m)=>s+(Number(m.meta_valor)||0),0);
  add('', `
    <h2>Térreo — Atendimentos: Previsto × Realizado</h2>
    <p class="apresentacao-legenda">Previsto = soma das metas dos profissionais só do Térreo cadastradas em Metas</p>
    <div class="grade-kpi" style="margin-bottom:0;">
      <div class="kpi"><div class="rotulo">Atendimentos previstos</div><div class="valor">${previstoQtdTerreo||'—'}</div></div>
      <div class="kpi"><div class="rotulo">Atendimentos realizados</div><div class="valor teal">${registrosTerreo.length}</div></div>
      <div class="kpi"><div class="rotulo">Valor previsto</div><div class="valor">${previstoValorTerreo?formatarMoeda(previstoValorTerreo):'—'}</div></div>
      <div class="kpi"><div class="rotulo">Valor realizado</div><div class="valor teal">${formatarMoeda(totalTerreo)}</div></div>
    </div>
    ${metasTerreo.length===0?'<p class="vazio" style="margin-top:20px;">Nenhum profissional cadastrado como exclusivo do Térreo em Metas para este mês.</p>':''}`);

  // ---------- 8. TÉRREO — Volume operacional ----------
  const examesTerreo = registrosTerreo.filter(r=>r.exames);
  const porExameTerreo = {};
  examesTerreo.forEach(r=>{ porExameTerreo[r.exames]=(porExameTerreo[r.exames]||0)+1; });
  const chavesExameTerreo = Object.keys(porExameTerreo).sort((a,b)=>porExameTerreo[b]-porExameTerreo[a]).slice(0,8);
  const biopsiasTerreo = registrosTerreo.filter(r=>r.biopsias).length;
  add('', `
    <h2>Térreo — Volume Operacional</h2>
    <p class="apresentacao-legenda">Exames e biópsias realizados no mês</p>
    <div class="grade-2">
      <div id="apr-grafico-terreo-exames" class="mini-grafico" style="min-height:260px;"></div>
      <div class="grade-kpi" style="margin-bottom:0;">
        <div class="kpi"><div class="rotulo">Exames no mês</div><div class="valor">${examesTerreo.length}</div></div>
        <div class="kpi"><div class="rotulo">Biópsias no mês</div><div class="valor">${biopsiasTerreo}</div></div>
      </div>
    </div>`);

  // ---------- 9. TÉRREO — Ticket médio comparativo ----------
  add('', `
    <h2>Térreo — Ticket Médio</h2>
    <p class="apresentacao-legenda">Comparativo ${d.ano} × ${d.anoAnterior}, mês a mês</p>
    <div id="apr-grafico-terreo-ticket" class="mini-grafico" style="min-height:280px;"></div>`);

  // ---------- 10. DIVISOR COPARTICIPADOS ----------
  add('apresentacao-divisor', `
    <h1 style="font-family:'Fraunces',serif;font-size:32px;margin:0 0 8px;">1º ANDAR — COPARTICIPADOS</h1>
    <p class="apresentacao-legenda" style="font-size:14px;">Atendimentos, ocupação de turnos e rentabilidade por profissional</p>`);

  // ---------- 11. COPARTICIPADOS — Faturamento mensal comparativo ----------
  add('', `
    <h2>Coparticipados — Faturamento Mensal</h2>
    <p class="apresentacao-legenda">Comparativo ${d.ano} × ${d.anoAnterior}</p>
    <div id="apr-grafico-copart-faturamento" class="mini-grafico" style="min-height:280px;"></div>`);

  // ---------- 12. COPARTICIPADOS — Top 10 profissionais ----------
  const porProfCopart = {};
  registrosCoparticipados.forEach(r=>{
    if(!porProfCopart[r.prof]) porProfCopart[r.prof]={quantidade:0, valor:0};
    porProfCopart[r.prof].quantidade++; porProfCopart[r.prof].valor+=Number(r.valor)||0;
  });
  const topProfCopart = Object.keys(porProfCopart).sort((a,b)=>porProfCopart[b].quantidade-porProfCopart[a].quantidade).slice(0,10);
  add('', `
    <h2>Coparticipados — Top 10 Profissionais por Atendimento</h2>
    <p class="apresentacao-legenda">${d.mes} de ${d.ano}</p>
    <div id="apr-grafico-copart-top10" class="mini-grafico" style="min-height:300px;"></div>`);

  // ---------- 13. COPARTICIPADOS — Ocupação de turnos ----------
  const profsCopart = apresentacaoProfissionaisDeUmAndarSo('COPARTICIPADOS');
  const metasCopart = d.metas.filter(m=>profsCopart.includes(m.prof));
  const usoCopart = {};
  registrosCoparticipados.forEach(r=>{ usoCopart[r.prof]=usoCopart[r.prof]||new Set(); usoCopart[r.prof].add(r.data+'_'+r.turno); });
  const linhasTurnoCopart = metasCopart.map(m=>{
    const usados = usoCopart[m.prof]?usoCopart[m.prof].size:0;
    const disp = Number(m.turnos_disponibilizados)||0;
    return {prof:m.prof, disp, usados, ociosos:Math.max(0,disp-usados), pct: disp?Math.round(usados/disp*100):0};
  }).sort((a,b)=>b.disp-a.disp);
  add('', `
    <h2>Coparticipados — Ocupação de Turnos</h2>
    <p class="apresentacao-legenda">${d.mes} de ${d.ano} • profissionais cadastrados só nesse andar</p>
    <div class="tabela-scroll"><table>
      <thead><tr><th>Profissional</th><th>Disponibilizados</th><th>Usados</th><th>Ociosos</th><th>% eficiência</th></tr></thead>
      <tbody>${linhasTurnoCopart.length?linhasTurnoCopart.map(l=>`
        <tr><td>${l.prof}</td><td>${l.disp}</td><td>${l.usados}</td><td>${l.ociosos}</td><td>${l.pct}%</td></tr>`).join('')
        :'<tr><td class="vazio">Nenhum profissional exclusivo dos Coparticipados com meta cadastrada.</td></tr>'}
      </tbody>
    </table></div>`);

  // ---------- 14. COPARTICIPADOS — Ultrassom histórico ----------
  add('', `
    <h2>Coparticipados — Ultrassom (Comparativo Histórico)</h2>
    <p class="apresentacao-legenda">Volume mensal de USG — ${d.ano} × ${d.anoAnterior}</p>
    <div id="apr-grafico-copart-usg" class="mini-grafico" style="min-height:280px;"></div>`);

  // ---------- 15. DIVISOR FINANCEIRO ----------
  add('apresentacao-divisor', `
    <h1 style="font-family:'Fraunces',serif;font-size:32px;margin:0 0 8px;">ACOMPANHAMENTO FINANCEIRO</h1>
    <p class="apresentacao-legenda" style="font-size:14px;">DRE e estrutura de custos</p>`);

  // ---------- 16 e 17. FINANCEIRO (DRE) ----------
  if(d.dre){
    const dre = d.dre;
    const receitaLiquida = dre.faturamento_bruto - dre.deducoes_impostos;
    const margem = receitaLiquida - dre.custo_servico_prestado;
    const totalDespesas = dre.despesas_pessoal + dre.despesas_compras_manutencao + dre.despesas_operacionais + dre.despesas_financeiras + dre.prolabore;
    const resultado = margem - totalDespesas;
    add('', `
      <h2>DRE — Demonstrativo de Resultados</h2>
      <p class="apresentacao-legenda">${d.mes} de ${d.ano}</p>
      <div class="tabela-scroll"><table>
        <tbody>
          <tr class="linha-total"><td>Faturamento total</td><td class="mono">${formatarMoeda(dre.faturamento_bruto)}</td></tr>
          <tr><td>(-) Deduções e impostos</td><td class="mono">${formatarMoeda(dre.deducoes_impostos)}</td></tr>
          <tr><td>(-) Custo do serviço prestado</td><td class="mono">${formatarMoeda(dre.custo_servico_prestado)}</td></tr>
          <tr class="linha-total"><td>(=) Margem de contribuição</td><td class="mono">${formatarMoeda(margem)}</td></tr>
          <tr><td>(-) Despesas — Setor pessoal</td><td class="mono">${formatarMoeda(dre.despesas_pessoal)}</td></tr>
          <tr><td>(-) Despesas — Compras e manutenções</td><td class="mono">${formatarMoeda(dre.despesas_compras_manutencao)}</td></tr>
          <tr><td>(-) Despesas — Operacionais</td><td class="mono">${formatarMoeda(dre.despesas_operacionais)}</td></tr>
          <tr><td>(-) Despesas — Financeiras</td><td class="mono">${formatarMoeda(dre.despesas_financeiras)}</td></tr>
          <tr><td>(-) Prolabore</td><td class="mono">${formatarMoeda(dre.prolabore)}</td></tr>
          <tr class="linha-total"><td>(=) Resultado da operação</td><td class="mono" style="color:${resultado<0?'var(--danger)':'inherit'};">${formatarMoeda(resultado)}</td></tr>
        </tbody>
      </table></div>`);

    add('', `
      <h2>Estrutura de Custos</h2>
      <p class="apresentacao-legenda">${d.mes} de ${d.ano} • % sobre o faturamento bruto</p>
      <div id="apr-grafico-estrutura-custos" class="mini-grafico" style="min-height:300px;"></div>`);
  } else {
    add('', `
      <h2>DRE — Demonstrativo de Resultados</h2>
      <p class="apresentacao-legenda">${d.mes} de ${d.ano}</p>
      <div class="cartao" style="box-shadow:none;border:1.5px dashed var(--line);">
        <p class="vazio">Nenhum DRE cadastrado para ${d.mes} de ${d.ano} ainda. Cadastre em <b>Metas → Financeiro (DRE)</b> para essa tela aparecer preenchida.</p>
      </div>`);
  }

  // ---------- 18. FECHAMENTO ----------
  add('apresentacao-fechamento', `
    <h1 style="font-family:'Fraunces',serif;font-size:34px;margin:0 0 10px;text-align:center;">Perguntas & Discussão</h1>
    <p style="text-align:center;color:var(--rose-100);font-style:italic;">Reunião Mensal de Resultados — ${d.mes} de ${d.ano} • ProdClin</p>`);

  return slides;
}

/* ---------------------------------------------------------------------
   DESENHO DOS GRÁFICOS — reaproveita a mini-biblioteca SVG de graficos.js
--------------------------------------------------------------------- */
function apresentacaoDesenharGraficos(d){
  const mesesAte = apresentacaoMesesAte(d.mes, d.ano);

  // 3. Evolução do ano
  const porMesAno = apresentacaoAgruparPorMes(d.todosRegistrosAno.filter(r=>mesesAte.includes(r.mes)));
  miniGraficoLinhas('apr-grafico-evolucao', mesesAte, [
    {nome:'Faturamento', dados: mesesAte.map(m=>Math.round(porMesAno[m].valor)), cor:'#146B5D'}
  ]);

  // 4. Composição por andar (empilhado)
  const registrosAnoAteData = d.todosRegistrosAno.filter(r=>mesesAte.includes(r.mes));
  const porMesTerreo = apresentacaoAgruparPorMes(apresentacaoFiltrarAndar(registrosAnoAteData, 'TÉRREO'));
  const porMesCopart = apresentacaoAgruparPorMes(apresentacaoFiltrarAndar(registrosAnoAteData, 'COPARTICIPADOS'));
  miniGraficoBarrasEmpilhadas('apr-grafico-composicao-andar', mesesAte, [
    {nome:'Térreo', dados: mesesAte.map(m=>Math.round(porMesTerreo[m].valor)), cor:'#5C2350'},
    {nome:'Coparticipados', dados: mesesAte.map(m=>Math.round(porMesCopart[m].valor)), cor:'#146B5D'}
  ]);

  // 6. Térreo — convênio
  const registrosTerreo = apresentacaoFiltrarAndar(d.registrosMes, 'TÉRREO');
  const porConvenioTerreo = apresentacaoAgruparPorConvenio(registrosTerreo);
  const chavesConv = Object.keys(porConvenioTerreo).sort((a,b)=>porConvenioTerreo[b].valor-porConvenioTerreo[a].valor);
  if(document.getElementById('apr-grafico-terreo-convenio')){
    miniGraficoRosca('apr-grafico-terreo-convenio', chavesConv, chavesConv.map(c=>porConvenioTerreo[c].valor));
  }

  // 8. Térreo — exames
  const examesTerreo = registrosTerreo.filter(r=>r.exames);
  const porExameTerreo = {};
  examesTerreo.forEach(r=>{ porExameTerreo[r.exames]=(porExameTerreo[r.exames]||0)+1; });
  const chavesExame = Object.keys(porExameTerreo).sort((a,b)=>porExameTerreo[b]-porExameTerreo[a]).slice(0,8);
  if(document.getElementById('apr-grafico-terreo-exames')){
    miniGraficoBarras('apr-grafico-terreo-exames', chavesExame, chavesExame.map(e=>porExameTerreo[e]), '#146B5D');
  }

  // 9. Térreo — ticket médio comparativo
  const terreoAno = apresentacaoFiltrarAndar(registrosAnoAteData, 'TÉRREO');
  const terreoAnoAnt = apresentacaoFiltrarAndar(d.registrosAnoAnt.filter(r=>mesesAte.includes(r.mes)), 'TÉRREO');
  const porMesTerreoAno = apresentacaoAgruparPorMes(terreoAno);
  const porMesTerreoAnoAnt = apresentacaoAgruparPorMes(terreoAnoAnt);
  const ticketMedio = grupo => mesesAte.map(m=>grupo[m].quantidade ? Math.round(grupo[m].valor/grupo[m].quantidade) : 0);
  miniGraficoLinhas('apr-grafico-terreo-ticket', mesesAte, [
    {nome:String(d.ano), dados: ticketMedio(porMesTerreoAno), cor:'#5C2350'},
    {nome:String(d.anoAnterior), dados: ticketMedio(porMesTerreoAnoAnt), cor:'#C495B8', tracejado:true}
  ]);

  // 11. Coparticipados — faturamento comparativo
  const copartAno = apresentacaoFiltrarAndar(registrosAnoAteData, 'COPARTICIPADOS');
  const copartAnoAnt = apresentacaoFiltrarAndar(d.registrosAnoAnt.filter(r=>mesesAte.includes(r.mes)), 'COPARTICIPADOS');
  const porMesCopartAno = apresentacaoAgruparPorMes(copartAno);
  const porMesCopartAnoAnt = apresentacaoAgruparPorMes(copartAnoAnt);
  miniGraficoLinhas('apr-grafico-copart-faturamento', mesesAte, [
    {nome:String(d.ano), dados: mesesAte.map(m=>Math.round(porMesCopartAno[m].valor)), cor:'#146B5D'},
    {nome:String(d.anoAnterior), dados: mesesAte.map(m=>Math.round(porMesCopartAnoAnt[m].valor)), cor:'#9FD6C8', tracejado:true}
  ]);

  // 12. Coparticipados — top 10
  const registrosCopart = apresentacaoFiltrarAndar(d.registrosMes, 'COPARTICIPADOS');
  const porProfCopart = {};
  registrosCopart.forEach(r=>{ porProfCopart[r.prof]=(porProfCopart[r.prof]||0)+1; });
  const topProf = Object.keys(porProfCopart).sort((a,b)=>porProfCopart[b]-porProfCopart[a]).slice(0,10);
  if(document.getElementById('apr-grafico-copart-top10')){
    miniGraficoBarras('apr-grafico-copart-top10', topProf, topProf.map(p=>porProfCopart[p]), '#0E5548');
  }

  // 14. Coparticipados — USG histórico
  const usgAno = copartAno.filter(r=>String(r.procedimento||'').trim().toUpperCase()==='USG');
  const usgAnoAnt = copartAnoAnt.filter(r=>String(r.procedimento||'').trim().toUpperCase()==='USG');
  const porMesUsgAno = apresentacaoAgruparPorMes(usgAno);
  const porMesUsgAnoAnt = apresentacaoAgruparPorMes(usgAnoAnt);
  miniGraficoLinhas('apr-grafico-copart-usg', mesesAte, [
    {nome:String(d.ano), dados: mesesAte.map(m=>porMesUsgAno[m].quantidade), cor:'#146B5D'},
    {nome:String(d.anoAnterior), dados: mesesAte.map(m=>porMesUsgAnoAnt[m].quantidade), cor:'#9FD6C8', tracejado:true}
  ]);

  // 17. Estrutura de custos (se tiver DRE)
  if(d.dre && document.getElementById('apr-grafico-estrutura-custos')){
    const dre = d.dre;
    const faturamento = Number(dre.faturamento_bruto)||1;
    const itens = [
      ['Prolabore', dre.prolabore], ['Custo do serviço', dre.custo_servico_prestado],
      ['Setor pessoal', dre.despesas_pessoal], ['Op. operacionais', dre.despesas_operacionais],
      ['Compras/manut.', dre.despesas_compras_manutencao], ['Deduções/impostos', dre.deducoes_impostos],
      ['Despesas fin.', dre.despesas_financeiras]
    ];
    miniGraficoBarras('apr-grafico-estrutura-custos', itens.map(i=>i[0]), itens.map(i=>Math.round((i[1]/faturamento)*1000)/10), '#9C6E22');
  }
}
