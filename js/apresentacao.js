/* =====================================================================
   APRESENTAÇÃO — monta sozinha, a partir do banco, uma "reunião mensal
   de resultados" navegável em slides (e exportável em PDF), sem que
   ninguém precise exportar/enviar nada manualmente todo mês.

   Abre como OVERLAY em tela cheia (botão "Apresentação" na aba Análises),
   usando o Mês/Ano JÁ selecionados ali — não tem filtro próprio, de
   propósito, pra não duplicar a mesma escolha em dois lugares.

   Duas fontes de dado bem diferentes:
   1) Produção (tabela `producao`) — 100% automático, igual ao resto do
      sistema, incluindo a quebra por Andar (Térreo × Coparticipados).
   2) Financeiro (plano de contas, aba Financeiro) — digitado manualmente
      (não dá pra calcular a partir da produção, é dado contábil). Se o
      mês não tiver valores lançados, as telas financeiras aparecem em
      branco, com um aviso — não inventamos nada.

   Simplificação assumida (documentada aqui, não escondida): "Previsto ×
   Realizado" por andar usa TURNOS UTILIZADOS × VALOR MÍNIMO POR
   PROFISSIONAL (aba Metas) dos profissionais cadastrados NAQUELE andar
   (só entram profissionais ligados a um único andar — ver
   `estado.profissionaisAndares` — para não contar duas vezes quem atende
   nos dois). O ProdClin não guarda meta por categoria de procedimento
   (consulta/exame/cirurgia em separado), só por profissional e mês —
   então essa quebra fina, que existia no PDF de referência, não está
   disponível aqui.
===================================================================== */
let apresentacaoSelectsProntos = false;
let apresentacaoSlides = [];
let apresentacaoIndice = 0;

function apresentacaoPrepararSelects(){
  if(apresentacaoSelectsProntos) return;

  document.getElementById('rmr-botao-apresentar').addEventListener('click', abrirApresentacao);
  document.getElementById('apresentacao-botao-fechar').addEventListener('click', fecharApresentacao);
  document.getElementById('sobreposicao-apresentacao').addEventListener('click', (ev)=>{
    if(ev.target.id==='sobreposicao-apresentacao') fecharApresentacao();
  });

  document.getElementById('apresentacao-anterior').addEventListener('click', ()=>apresentacaoIrPara(apresentacaoIndice-1));
  document.getElementById('apresentacao-proxima').addEventListener('click', ()=>apresentacaoIrPara(apresentacaoIndice+1));
  document.getElementById('apresentacao-botao-tela-cheia').addEventListener('click', apresentacaoAlternarTelaCheia);
  document.getElementById('apresentacao-botao-exportar-pdf').addEventListener('click', apresentacaoExportarPdf);

  document.addEventListener('keydown', (ev)=>{
    if(!document.getElementById('sobreposicao-apresentacao').classList.contains('aberta')) return;
    if(ev.key==='ArrowRight') apresentacaoIrPara(apresentacaoIndice+1);
    if(ev.key==='ArrowLeft') apresentacaoIrPara(apresentacaoIndice-1);
    if(ev.key==='Escape') fecharApresentacao();
  });

  apresentacaoSelectsProntos = true;
}

// Abre o overlay e monta a apresentação com o Mês/Ano JÁ selecionados na
// aba Análises — é por isso que esse botão só existe dentro dela.
async function abrirApresentacao(){
  apresentacaoPrepararSelects();
  const mes = document.getElementById('squad-mes').value;
  const ano = document.getElementById('squad-ano').value;
  document.getElementById('sobreposicao-apresentacao').classList.add('aberta');
  await atualizarApresentacao(mes, ano);
}

function fecharApresentacao(){
  document.getElementById('sobreposicao-apresentacao').classList.remove('aberta');
  if(document.fullscreenElement) document.exitFullscreen();
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

async function atualizarApresentacao(mes, ano){
  ano = Number(ano);
  const anoAnterior = ano - 1;
  const { mes: mesAnt, ano: anoAnt } = apresentacaoMesAnterior(mes, ano);

  const stage = document.getElementById('apresentacao-stage');
  stage.innerHTML = '<p class="vazio">Montando a apresentação...</p>';

  let registrosAno, registrosAnoAnterior, registrosMesAnterior, metasMes;
  try{
    const { dataInicio, dataFim } = primeiroEUltimoDiaDoMes(mes, ano);
    const { dataInicio: diAnt, dataFim: dfAnt } = primeiroEUltimoDiaDoMes(mesAnt, anoAnt);
    [registrosAno, registrosAnoAnterior, registrosMesAnterior, metasMes] = await Promise.all([
      buscarProducaoCompleta({ano}),
      buscarProducaoCompleta({ano:anoAnterior}),
      buscarProducaoCompleta({dataInicio:diAnt, dataFim:dfAnt}),
      api('listarMetas', {mes, ano})
    ]);
    // Financeiro (plano de contas) — mesmas funções da aba Financeiro
    // (js/financeiro.js), pra não duplicar lógica de árvore/soma.
    await financeiroCarregarContas();
    await financeiroCarregarValores(mes, ano);
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
  // "tem financeiro cadastrado" = alguma conta-folha do plano de contas tem
  // valor lançado nesse mês (senão, as telas financeiras ficam em branco).
  const temFinanceiro = Object.keys(financeiroValoresCache).some(cod=>Number(financeiroValoresCache[cod])>0);

  const dados = {
    mes, ano, mesAnt, anoAnt, anoAnterior,
    registrosMes, registrosMesAnt, todosRegistrosAno, registrosAnoAnt, metas, temFinanceiro
  };

  const slidesHtml = apresentacaoConstruirSlides(dados);
  stage.innerHTML = slidesHtml.map((html,i)=>`<div class="apresentacao-slide ${html.classe||''}">${html.conteudo}</div>`).join('');
  apresentacaoSlides = slidesHtml;
  apresentacaoIndice = 0;
  apresentacaoIrPara(0);

  // Desenha os gráficos DEPOIS do innerHTML acima ter sido aplicado —
  // funciona em slides escondidas também (SVG com viewBox fixo).
  apresentacaoDesenharGraficos(dados);

  // Árvore expansível do plano de contas (slide "Principais Contas") —
  // mesma função da aba Financeiro, só que sem os botões de editar
  // (podeEditar:false — a Apresentação é só consulta).
  if(dados.temFinanceiro && document.getElementById('apr-arvore-plano-contas')){
    montarArvoreContas('apr-arvore-plano-contas', {comValores:true, podeEditar:false});
  }
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

  // ---------- 4b. TODOS OS PROCEDIMENTOS (clínica inteira, Térreo + Coparticipados) ----------
  const porProcedimentoGeral = {};
  d.registrosMes.forEach(r=>{
    const proc = r.procedimento || '(não informado)';
    if(!porProcedimentoGeral[proc]) porProcedimentoGeral[proc] = {quantidade:0, valor:0};
    porProcedimentoGeral[proc].quantidade++;
    porProcedimentoGeral[proc].valor += Number(r.valor)||0;
  });
  const procedimentosGeral = Object.keys(porProcedimentoGeral).sort((a,b)=>porProcedimentoGeral[b].valor-porProcedimentoGeral[a].valor);
  add('', `
    <h2>Todos os Atendimentos</h2>
    <p class="apresentacao-legenda">${d.mes} de ${d.ano} • Térreo + Coparticipados juntos, todo atendimento com lançamento no mês</p>
    <div class="tabela-scroll"><table>
      <thead><tr><th>Atendimento</th><th>Qtd.</th><th>Valor</th><th>Ticket médio</th></tr></thead>
      <tbody>${procedimentosGeral.length?procedimentosGeral.map(p=>{
        const info = porProcedimentoGeral[p];
        return `<tr><td>${p}</td><td>${info.quantidade}</td><td class="mono">${formatarMoeda(info.valor)}</td><td class="mono">${formatarMoeda(info.valor/info.quantidade)}</td></tr>`;
      }).join('') : '<tr><td class="vazio">Nenhum lançamento nesse mês.</td></tr>'}
      </tbody>
    </table></div>`);

  // ---------- 4c. UM SLIDE POR PROCEDIMENTO (comparativo histórico, igual ao padrão do Ultrassom) ----------
  procedimentosGeral.forEach((proc, idx)=>{
    const info = porProcedimentoGeral[proc];
    add('', `
      <h2>${proc} — Comparativo Histórico</h2>
      <p class="apresentacao-legenda">Faturamento mensal — ${d.ano} × ${d.anoAnterior}</p>
      <div class="grade-kpi" style="margin-bottom:14px;">
        <div class="kpi"><div class="rotulo">Qtd. no mês</div><div class="valor">${info.quantidade}</div></div>
        <div class="kpi"><div class="rotulo">Valor no mês</div><div class="valor teal">${formatarMoeda(info.valor)}</div></div>
        <div class="kpi"><div class="rotulo">Ticket médio</div><div class="valor">${formatarMoeda(info.valor/info.quantidade)}</div></div>
      </div>
      <div id="apr-grafico-proc-${idx}" class="mini-grafico" style="min-height:260px;"></div>`);
  });

  // ---------- 5. DIVISOR TÉRREO ----------
  add('apresentacao-divisor', `
    <h1 style="font-family:'Fraunces',serif;font-size:32px;margin:0 0 8px;">SETOR TÉRREO</h1>
    <p class="apresentacao-legenda" style="font-size:14px;">Consultas, exames, cirurgias e atendimentos</p>`);

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
  let turnosUtilizadosTerreo = 0;
  const previstoValorTerreo = metasTerreo.reduce((s,m)=>{
    const turnosMeta = Number(m.turnos_utilizados)||0;
    turnosUtilizadosTerreo += turnosMeta;
    return s + turnosMeta * (Number(m.valor_minimo_turno)||0);
  }, 0);
  add('', `
    <h2>Térreo — Atendimentos: Previsto × Realizado</h2>
    <p class="apresentacao-legenda">Previsto = turnos utilizados (aba Metas) × valor mínimo por profissional, só do Térreo</p>
    <div class="grade-kpi" style="margin-bottom:0;">
      <div class="kpi"><div class="rotulo">Turnos utilizados</div><div class="valor">${turnosUtilizadosTerreo||'—'}</div></div>
      <div class="kpi"><div class="rotulo">Atendimentos realizados</div><div class="valor teal">${registrosTerreo.length}</div></div>
      <div class="kpi"><div class="rotulo">Valor previsto (meta)</div><div class="valor">${previstoValorTerreo?formatarMoeda(previstoValorTerreo):'—'}</div></div>
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

  // ---------- 8b. TÉRREO — Procedimentos realizados ----------
  const porProcedimentoTerreo = {};
  registrosTerreo.forEach(r=>{
    const proc = r.procedimento || '(não informado)';
    if(!porProcedimentoTerreo[proc]) porProcedimentoTerreo[proc] = {quantidade:0, valor:0};
    porProcedimentoTerreo[proc].quantidade++;
    porProcedimentoTerreo[proc].valor += Number(r.valor)||0;
  });
  const procedimentosTerreo = Object.keys(porProcedimentoTerreo).sort((a,b)=>porProcedimentoTerreo[b].valor-porProcedimentoTerreo[a].valor);
  add('', `
    <h2>Térreo — Atendimentos Realizados</h2>
    <p class="apresentacao-legenda">${d.mes} de ${d.ano} • só atendimentos com lançamento no mês</p>
    <div class="tabela-scroll"><table>
      <thead><tr><th>Atendimento</th><th>Qtd.</th><th>Valor</th><th>Ticket médio</th></tr></thead>
      <tbody>${procedimentosTerreo.length?procedimentosTerreo.map(p=>{
        const info = porProcedimentoTerreo[p];
        return `<tr><td>${p}</td><td>${info.quantidade}</td><td class="mono">${formatarMoeda(info.valor)}</td><td class="mono">${formatarMoeda(info.valor/info.quantidade)}</td></tr>`;
      }).join('') : '<tr><td class="vazio">Nenhum lançamento no Térreo nesse mês.</td></tr>'}
      </tbody>
    </table></div>`);

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
    <h2>Coparticipados — Top 10 Profissionais por Faturamento</h2>
    <p class="apresentacao-legenda">${d.mes} de ${d.ano}</p>
    <div id="apr-grafico-copart-top10" class="mini-grafico" style="min-height:300px;"></div>`);

  // ---------- 13. COPARTICIPADOS — Turnos e Metas Financeiras ----------
  const profsCopart = apresentacaoProfissionaisDeUmAndarSo('COPARTICIPADOS');
  const metasCopart = d.metas.filter(m=>profsCopart.includes(m.prof));
  const valorCopart = {};
  registrosCoparticipados.forEach(r=>{ valorCopart[r.prof]=(valorCopart[r.prof]||0)+(Number(r.valor)||0); });
  const linhasTurnoCopart = metasCopart.map(m=>{
    const turnosMeta = Number(m.turnos_utilizados)||0;
    const valorMeta = turnosMeta * (Number(m.valor_minimo_turno)||0);
    const realizado = valorCopart[m.prof]||0;
    const pct = valorMeta ? Math.round(realizado/valorMeta*100) : null;
    return {prof:m.prof, usados:turnosMeta, valorMeta, realizado, pct};
  }).sort((a,b)=>b.usados-a.usados);
  add('', `
    <h2>Coparticipados — Turnos e Metas Financeiras</h2>
    <p class="apresentacao-legenda">${d.mes} de ${d.ano} • profissionais cadastrados só nesse andar</p>
    <div class="tabela-scroll"><table>
      <thead><tr><th>Profissional</th><th>Turnos utilizados</th><th>Valor da meta</th><th>Realizado</th><th>% atingido</th></tr></thead>
      <tbody>${linhasTurnoCopart.length?linhasTurnoCopart.map(l=>`
        <tr><td>${l.prof}</td><td>${l.usados}</td><td class="mono">${l.valorMeta?formatarMoeda(l.valorMeta):'—'}</td><td class="mono">${formatarMoeda(l.realizado)}</td><td>${l.pct!==null?l.pct+'%':'—'}</td></tr>`).join('')
        :'<tr><td class="vazio">Nenhum profissional exclusivo dos Coparticipados com meta cadastrada.</td></tr>'}
      </tbody>
    </table></div>`);

  // ---------- 13b. COPARTICIPADOS — Procedimentos realizados ----------
  // Só entra procedimento que teve pelo menos 1 lançamento nos
  // Coparticipados nesse mês — não lista tudo que existe no cadastro,
  // só o que realmente teve dado.
  const porProcedimentoCopart = {};
  registrosCoparticipados.forEach(r=>{
    const proc = r.procedimento || '(não informado)';
    if(!porProcedimentoCopart[proc]) porProcedimentoCopart[proc] = {quantidade:0, valor:0};
    porProcedimentoCopart[proc].quantidade++;
    porProcedimentoCopart[proc].valor += Number(r.valor)||0;
  });
  const procedimentosCopart = Object.keys(porProcedimentoCopart).sort((a,b)=>porProcedimentoCopart[b].valor-porProcedimentoCopart[a].valor);
  add('', `
    <h2>Coparticipados — Atendimentos Realizados</h2>
    <p class="apresentacao-legenda">${d.mes} de ${d.ano} • só atendimentos com lançamento no mês</p>
    <div class="tabela-scroll"><table>
      <thead><tr><th>Atendimento</th><th>Qtd.</th><th>Valor</th><th>Ticket médio</th></tr></thead>
      <tbody>${procedimentosCopart.length?procedimentosCopart.map(p=>{
        const info = porProcedimentoCopart[p];
        return `<tr><td>${p}</td><td>${info.quantidade}</td><td class="mono">${formatarMoeda(info.valor)}</td><td class="mono">${formatarMoeda(info.valor/info.quantidade)}</td></tr>`;
      }).join('') : '<tr><td class="vazio">Nenhum lançamento nos Coparticipados nesse mês.</td></tr>'}
      </tbody>
    </table></div>`);

  // ---------- 14. COPARTICIPADOS — Ultrassom histórico ----------
  add('', `
    <h2>Coparticipados — Ultrassom (Comparativo Histórico)</h2>
    <p class="apresentacao-legenda">Faturamento mensal de USG — ${d.ano} × ${d.anoAnterior}</p>
    <div id="apr-grafico-copart-usg" class="mini-grafico" style="min-height:280px;"></div>`);

  // ---------- 15. DIVISOR FINANCEIRO ----------
  add('apresentacao-divisor', `
    <h1 style="font-family:'Fraunces',serif;font-size:32px;margin:0 0 8px;">ACOMPANHAMENTO FINANCEIRO</h1>
    <p class="apresentacao-legenda" style="font-size:14px;">DRE e estrutura de custos</p>`);

  // ---------- 16/17/18. FINANCEIRO — Plano de Contas ----------
  if(d.temFinanceiro){
    const dre = financeiroCalcularDre();

    add('', `
      <h2>DRE — Demonstrativo de Resultados</h2>
      <p class="apresentacao-legenda">${d.mes} de ${d.ano} — plano de contas</p>
      <div class="tabela-scroll"><table>
        <tbody>
          <tr class="linha-total"><td>Receita bruta de serviços</td><td class="mono">${formatarMoeda(dre.receitaBruta)}</td></tr>
          <tr><td>(-) Deduções da receita bruta</td><td class="mono">${formatarMoeda(dre.deducoes)}</td></tr>
          <tr class="linha-total"><td>(=) Receita líquida</td><td class="mono">${formatarMoeda(dre.receitaLiquida)}</td></tr>
          <tr><td>(-) Custo do serviço prestado</td><td class="mono">${formatarMoeda(dre.custoServico)}</td></tr>
          <tr class="linha-total"><td>(=) Lucro bruto</td><td class="mono">${formatarMoeda(dre.lucroBruto)}</td></tr>
          <tr><td>(-) Despesas operacionais (pessoal, compras, operacionais, cartões)</td><td class="mono">${formatarMoeda(dre.despesasOperacionais)}</td></tr>
          <tr class="linha-total"><td>(=) Resultado operacional (EBITDA)</td><td class="mono">${formatarMoeda(dre.resultadoOperacional)}</td></tr>
          <tr><td>(+/-) Resultado financeiro</td><td class="mono">${formatarMoeda(dre.resultadoFinanceiro)}</td></tr>
          <tr><td>(-) Prolabore e retiradas</td><td class="mono">${formatarMoeda(dre.prolabore)}</td></tr>
          <tr class="linha-total"><td>(=) Lucro líquido</td><td class="mono" style="color:${dre.lucroLiquido<0?'var(--danger)':'inherit'};">${formatarMoeda(dre.lucroLiquido)}</td></tr>
          <tr><td>Margem líquida</td><td class="mono">${dre.margemLiquidaPct===null?'—':dre.margemLiquidaPct.toFixed(1)+'%'}</td></tr>
        </tbody>
      </table></div>`);

    add('', `
      <h2>Plano de Contas — Principais Contas</h2>
      <p class="apresentacao-legenda">${d.mes} de ${d.ano} — clique na seta pra abrir as subcontas</p>
      <div id="apr-arvore-plano-contas"><p class="vazio">Carregando...</p></div>`);

    add('', `
      <h2>Estrutura de Custos</h2>
      <p class="apresentacao-legenda">${d.mes} de ${d.ano} • % sobre a receita bruta</p>
      <div id="apr-grafico-estrutura-custos" class="mini-grafico" style="min-height:300px;"></div>`);
  } else {
    add('', `
      <h2>DRE — Demonstrativo de Resultados</h2>
      <p class="apresentacao-legenda">${d.mes} de ${d.ano}</p>
      <div class="cartao" style="box-shadow:none;border:1.5px dashed var(--line);">
        <p class="vazio">Nenhum valor lançado no plano de contas para ${d.mes} de ${d.ano} ainda. Cadastre na aba <b>Financeiro</b> para essa tela aparecer preenchida.</p>
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

  // 8. Térreo — exames (em R$, não em quantidade)
  const examesTerreo = registrosTerreo.filter(r=>r.exames);
  const porExameTerreo = {};
  examesTerreo.forEach(r=>{ porExameTerreo[r.exames]=(porExameTerreo[r.exames]||0)+(Number(r.valor)||0); });
  const chavesExame = Object.keys(porExameTerreo).sort((a,b)=>porExameTerreo[b]-porExameTerreo[a]).slice(0,8);
  if(document.getElementById('apr-grafico-terreo-exames')){
    miniGraficoBarras('apr-grafico-terreo-exames', chavesExame, chavesExame.map(e=>Math.round(porExameTerreo[e])), '#146B5D');
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

  // 12. Coparticipados — top 10 (em R$, não em quantidade de atendimento)
  const registrosCopart = apresentacaoFiltrarAndar(d.registrosMes, 'COPARTICIPADOS');
  const porProfCopart = {};
  registrosCopart.forEach(r=>{ porProfCopart[r.prof]=(porProfCopart[r.prof]||0)+(Number(r.valor)||0); });
  const topProf = Object.keys(porProfCopart).sort((a,b)=>porProfCopart[b]-porProfCopart[a]).slice(0,10);
  if(document.getElementById('apr-grafico-copart-top10')){
    miniGraficoBarras('apr-grafico-copart-top10', topProf, topProf.map(p=>Math.round(porProfCopart[p])), '#0E5548');
  }

  // 14. Coparticipados — USG histórico
  const usgAno = copartAno.filter(r=>String(r.procedimento||'').trim().toUpperCase()==='USG');
  const usgAnoAnt = copartAnoAnt.filter(r=>String(r.procedimento||'').trim().toUpperCase()==='USG');
  const porMesUsgAno = apresentacaoAgruparPorMes(usgAno);
  const porMesUsgAnoAnt = apresentacaoAgruparPorMes(usgAnoAnt);
  miniGraficoLinhas('apr-grafico-copart-usg', mesesAte, [
    {nome:String(d.ano), dados: mesesAte.map(m=>Math.round(porMesUsgAno[m].valor)), cor:'#146B5D'},
    {nome:String(d.anoAnterior), dados: mesesAte.map(m=>Math.round(porMesUsgAnoAnt[m].valor)), cor:'#9FD6C8', tracejado:true}
  ]);

  // 4c. Um gráfico por procedimento (comparativo histórico, clínica inteira)
  // — recalcula a MESMA lista/ordem usada em apresentacaoConstruirSlides
  // (por valor do mês, decrescente) pra os índices dos containers baterem.
  const porProcedimentoGeralGraf = {};
  d.registrosMes.forEach(r=>{
    const proc = r.procedimento || '(não informado)';
    if(!porProcedimentoGeralGraf[proc]) porProcedimentoGeralGraf[proc] = 0;
    porProcedimentoGeralGraf[proc] += Number(r.valor)||0;
  });
  const procedimentosGeralGraf = Object.keys(porProcedimentoGeralGraf).sort((a,b)=>porProcedimentoGeralGraf[b]-porProcedimentoGeralGraf[a]);
  procedimentosGeralGraf.forEach((proc, idx)=>{
    const containerId = 'apr-grafico-proc-'+idx;
    if(!document.getElementById(containerId)) return;
    const registrosProcAno = registrosAnoAteData.filter(r=>String(r.procedimento||'(não informado)')===proc);
    const registrosProcAnoAnt = d.registrosAnoAnt.filter(r=>mesesAte.includes(r.mes) && String(r.procedimento||'(não informado)')===proc);
    const porMesProcAno = apresentacaoAgruparPorMes(registrosProcAno);
    const porMesProcAnoAnt = apresentacaoAgruparPorMes(registrosProcAnoAnt);
    miniGraficoLinhas(containerId, mesesAte, [
      {nome:String(d.ano), dados: mesesAte.map(m=>Math.round(porMesProcAno[m].valor)), cor:'#146B5D'},
      {nome:String(d.anoAnterior), dados: mesesAte.map(m=>Math.round(porMesProcAnoAnt[m].valor)), cor:'#9FD6C8', tracejado:true}
    ]);
  });

  // 17. Estrutura de custos — grupos de nível 2 dentro de "5. Despesas",
  // mais Custo do Serviço ("4") — cada barra em % sobre a receita bruta.
  if(d.temFinanceiro && document.getElementById('apr-grafico-estrutura-custos')){
    const receitaBruta = financeiroValorDaConta('3.1', financeiroContasCache, financeiroValoresCache) || 1;
    const grupos = financeiroFilhosDe('5', financeiroContasCache).slice();
    const contaCsp = financeiroContasCache.find(c=>c.codigo==='4');
    if(contaCsp) grupos.unshift(contaCsp);
    const itens = grupos.map(g=>[
      g.nome.length>16 ? g.nome.slice(0,15)+'…' : g.nome,
      Math.abs(financeiroValorDaConta(g.codigo, financeiroContasCache, financeiroValoresCache))
    ]).filter(i=>i[1]>0);
    if(itens.length){
      miniGraficoBarras('apr-grafico-estrutura-custos', itens.map(i=>i[0]), itens.map(i=>Math.round((i[1]/receitaBruta)*1000)/10), '#9C6E22');
    } else {
      graficoVazio('apr-grafico-estrutura-custos');
    }
  }
}
