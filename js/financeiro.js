/* =====================================================================
   ABA FINANCEIRO — plano de contas hierárquico (estilo Fortes Contábil,
   códigos tipo 3.1.1.01.0001) com valor por conta-folha por mês. Reaproveitado
   também dentro de Configurações (mesma árvore, sem os valores) pra cadastro
   de contas-mãe — ver montarArvoreContas(), chamada dos dois lugares.

   Regra de aninhamento (documentada aqui porque não tem "padrão oficial"
   fixo pra profundidade arbitrária — decisão de projeto):
     nível 1 (ex. "3")         → filhos ganham 1 dígito novo   → "3.1"
     nível 2 (ex. "3.1")       → filhos ganham 1 dígito novo   → "3.1.1"
     nível 3 (ex. "3.1.1")     → filhos ganham 2 dígitos       → "3.1.1.01"
     nível 4 (ex. "3.1.1.01")  → filhos ganham 4 dígitos       → "3.1.1.01.0001"
     nível 5 em diante         → filhos ganham 2 dígitos       → ....01, ....02
   Sempre pega o próximo número livre entre os "irmãos" (mesma conta-mãe).

   Só conta SEM FILHOS guarda valor (plano_contas_valores) — quem tem filho
   vira automaticamente "linha de soma", calculada na hora a partir das
   folhas abaixo dela. Resultado do DRE = soma das folhas com natureza
   'entrada' menos soma das folhas com natureza 'saida', sempre — não
   depende de em que nível/ramo a conta está.
--------------------------------------------------------------------- */
let financeiroContasCache = [];      // todas as contas (estado.js não guarda isso — é só usado aqui e em Configurações)
let financeiroValoresCache = {};     // {codigo: valor} do mês/ano selecionado
let financeiroSelectsProntos = false;
let financeiroExpandido = {};        // {codigo: true} — memoriza o que está aberto entre atualizações

function financeiroFilhosDe(codigo, contas){
  return (contas||financeiroContasCache).filter(c=>c.conta_pai_codigo===codigo).sort((a,b)=>(a.ordem-b.ordem)||a.codigo.localeCompare(b.codigo));
}
function financeiroEhFolha(codigo, contas){
  return financeiroFilhosDe(codigo, contas).length===0;
}
function financeiroRaizes(contas){
  return (contas||financeiroContasCache).filter(c=>!c.conta_pai_codigo).sort((a,b)=>(a.ordem-b.ordem)||a.codigo.localeCompare(b.codigo));
}

// Soma o valor de uma conta: se é folha, é o valor lançado; se tem filhos,
// é a soma (respeitando entrada/saída) dos filhos, recursivamente.
function financeiroValorDaConta(codigo, contas, valores){
  const filhos = financeiroFilhosDe(codigo, contas);
  if(filhos.length===0) return Number(valores[codigo])||0;
  return filhos.reduce((soma, filho)=>{
    const v = financeiroValorDaConta(filho.codigo, contas, valores);
    return soma + (filho.natureza==='saida' ? -Math.abs(v) : Math.abs(v));
  }, 0);
  // Nota: a subtração já acontece aqui (por natureza) — quem CHAMA essa
  // função pra conta raiz "3" já recebe o valor líquido da Receita, etc.
  // Pra exibir na tela sem duplo-sinal, usamos Math.abs no valor mostrado
  // e o sinal só entra na hora de compor o Resultado geral (ver DRE).
}

// Gera o próximo código livre para um filho de `paiCodigo`, seguindo a
// regra de dígitos por nível descrita no cabeçalho do arquivo.
function financeiroProximoCodigo(paiCodigo, contas){
  const nivel = paiCodigo.split('.').length; // nível do PAI
  const digitos = nivel<=2 ? 1 : (nivel===3 ? 2 : (nivel===4 ? 4 : 2));
  const irmaos = financeiroFilhosDe(paiCodigo, contas);
  let maior = 0;
  irmaos.forEach(c=>{
    const partes = c.codigo.split('.');
    const ultimo = parseInt(partes[partes.length-1], 10);
    if(!isNaN(ultimo) && ultimo>maior) maior = ultimo;
  });
  const proximo = String(maior+1).padStart(digitos, '0');
  return paiCodigo + '.' + proximo;
}

async function financeiroCarregarContas(){
  const resp = await api('listarPlanoContas', {});
  financeiroContasCache = resp.ok ? resp.contas : [];
  return financeiroContasCache;
}
async function financeiroCarregarValores(mes, ano){
  const resp = await api('listarValoresContas', {mes, ano});
  financeiroValoresCache = {};
  if(resp.ok) resp.valores.forEach(v=>{ financeiroValoresCache[v.conta_codigo] = Number(v.valor)||0; });
  return financeiroValoresCache;
}

/* ---------------------------------------------------------------------
   ÁRVORE — função compartilhada entre a aba Financeiro (com valores/mês) e
   Configurações (só estrutura, sem valores). `opcoes.comValores` liga/desliga
   a coluna de valor + input de edição.
--------------------------------------------------------------------- */
function montarArvoreContas(containerId, opcoes){
  opcoes = opcoes || {};
  const comValores = !!opcoes.comValores;
  const podeEditar = opcoes.podeEditar !== false;
  const container = document.getElementById(containerId);
  if(!container) return;

  function linhaHtml(conta, profundidade){
    const ehFolha = financeiroEhFolha(conta.codigo, financeiroContasCache);
    const aberto = !!financeiroExpandido[conta.codigo];
    const valor = comValores ? financeiroValorDaConta(conta.codigo, financeiroContasCache, financeiroValoresCache) : null;
    const filhos = financeiroFilhosDe(conta.codigo, financeiroContasCache);

    let html = `<div class="financeiro-linha" data-codigo="${conta.codigo}" style="display:flex;align-items:center;gap:8px;padding:9px 6px;padding-left:${14+profundidade*22}px;border-bottom:1px solid var(--line);">`;
    if(filhos.length>0){
      html += `<button type="button" class="financeiro-toggle" data-codigo="${conta.codigo}" style="background:none;border:none;cursor:pointer;color:var(--plum-700);font-size:12px;width:18px;flex-shrink:0;">${aberto?'▾':'▸'}</button>`;
    } else {
      html += `<span style="width:18px;flex-shrink:0;"></span>`;
    }
    html += `<span class="mono" style="font-size:11px;color:var(--ink-400);min-width:110px;flex-shrink:0;">${conta.codigo}</span>`;
    html += `<span style="flex:1;font-weight:${filhos.length>0?'700':'400'};color:${filhos.length>0?'var(--plum-900)':'var(--ink-900)'};">${conta.nome}${!ehFolha||!podeEditar?'':`<button type="button" class="financeiro-toggle-natureza tag" data-codigo="${conta.codigo}" data-natureza="${conta.natureza}" title="Clique pra trocar entrada/saída" style="border:none;cursor:pointer;margin-left:6px;${conta.natureza==='saida'?'background:var(--danger-100);color:var(--danger);':'background:var(--teal-100);color:var(--teal-700);'}">${conta.natureza==='saida'?'saída':'entrada'}</button>`}</span>`;
    if(comValores){
      if(ehFolha && podeEditar){
        html += `<input type="number" step="0.01" class="financeiro-input-valor" data-codigo="${conta.codigo}" value="${financeiroValoresCache[conta.codigo]||''}" placeholder="0,00" style="width:130px;padding:6px 8px;border-radius:6px;border:1.5px solid var(--line);text-align:right;">`;
      } else {
        html += `<span class="mono" style="width:130px;text-align:right;font-weight:${filhos.length>0?'700':'400'};">${formatarMoeda(valor)}</span>`;
      }
    }
    if(podeEditar){
      html += `<button type="button" class="financeiro-add-sub botao sutil pequeno" data-codigo="${conta.codigo}" title="Adicionar subconta" style="padding:4px 9px;">+ subconta</button>`;
      if(ehFolha && !(comValores && (financeiroValoresCache[conta.codigo]||0)!==0)){
        html += `<button type="button" class="financeiro-excluir botao sutil pequeno" data-codigo="${conta.codigo}" title="Excluir conta" style="padding:4px 9px;color:var(--danger);">×</button>`;
      }
    }
    html += `</div>`;
    if(aberto && filhos.length>0){
      html += `<div class="financeiro-filhos" data-pai="${conta.codigo}">${filhos.map(f=>linhaHtml(f, profundidade+1)).join('')}</div>`;
    }
    return html;
  }

  const raizes = financeiroRaizes(financeiroContasCache);
  if(raizes.length===0){
    container.innerHTML = '<p class="vazio">Nenhuma conta cadastrada ainda.</p>';
  } else {
    container.innerHTML = raizes.map(r=>linhaHtml(r, 0)).join('');
  }

  container.querySelectorAll('.financeiro-toggle').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const codigo = btn.dataset.codigo;
      financeiroExpandido[codigo] = !financeiroExpandido[codigo];
      montarArvoreContas(containerId, opcoes);
    });
  });

  container.querySelectorAll('.financeiro-add-sub').forEach(btn=>{
    btn.addEventListener('click', ()=>financeiroAbrirFormularioNovaConta(btn.dataset.codigo, containerId, opcoes));
  });

  container.querySelectorAll('.financeiro-toggle-natureza').forEach(btn=>{
    btn.addEventListener('click', async (ev)=>{
      ev.stopPropagation();
      const codigo = btn.dataset.codigo;
      const novaNatureza = btn.dataset.natureza==='saida' ? 'entrada' : 'saida';
      const resp = await api('atualizarNaturezaConta', {codigo, natureza: novaNatureza});
      if(!resp.ok){ alert(resp.erro||'Não foi possível atualizar.'); return; }
      await financeiroCarregarContas();
      montarArvoreContas(containerId, opcoes);
      if(financeiroSubAbaAtiva==='dre') financeiroRenderizarDre();
    });
  });

  container.querySelectorAll('.financeiro-excluir').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const codigo = btn.dataset.codigo;
      if(!confirm(`Excluir a conta "${codigo}"? Isso apaga também os valores já lançados nela.`)) return;
      const resp = await api('excluirContaPlano', {codigo});
      if(!resp.ok){ alert(resp.erro||'Não foi possível excluir.'); return; }
      await financeiroCarregarContas();
      montarArvoreContas(containerId, opcoes);
    });
  });

  if(comValores){
    container.querySelectorAll('.financeiro-input-valor').forEach(inp=>{
      inp.addEventListener('input', ()=>{
        financeiroValoresCache[inp.dataset.codigo] = Number(inp.value)||0;
        montarArvoreContas(containerId, opcoes); // reflete a soma nos pais em tempo real
        // (reconstrói a árvore inteira; simples e rápido o bastante pro tamanho
        // típico de um plano de contas — algumas dezenas/centenas de linhas)
      });
    });
  }
}

// Pequeno formulário inline (prompt) pra nome + natureza da nova subconta —
// mantém consistência com o resto do sistema, que já usa prompt()/confirm()
// nativos em vários pontos (ex.: remover item de lista em Configurações).
function financeiroAbrirFormularioNovaConta(paiCodigo, containerId, opcoes){
  const nome = prompt('Nome da nova subconta:');
  if(!nome || !nome.trim()) return;
  const natureza = confirm(
    'Essa conta AUMENTA o valor da conta-mãe (ex.: uma receita, um saldo de banco, um item de patrimônio)?\n\n' +
    'Cancelar = essa conta DIMINUI o valor da conta-mãe (ex.: uma dedução, um custo, uma despesa).'
  ) ? 'entrada' : 'saida';
  const codigo = financeiroProximoCodigo(paiCodigo, financeiroContasCache);
  api('criarContaPlano', {codigo, nome: nome.trim(), conta_pai_codigo: paiCodigo, natureza, ordem: 0}).then(async resp=>{
    if(!resp.ok){ alert(resp.erro || 'Não foi possível criar a conta.'); return; }
    financeiroExpandido[paiCodigo] = true;
    await financeiroCarregarContas();
    montarArvoreContas(containerId, opcoes);
  });
}

/* ---------------------------------------------------------------------
   ABA FINANCEIRO — filtros de período, resumo do DRE, salvar valores,
   template CSV e importação CSV.
--------------------------------------------------------------------- */
function financeiroPrepararSelects(){
  if(financeiroSelectsProntos) return;
  const hoje = new Date();
  const anos = [hoje.getFullYear()-1, hoje.getFullYear()];
  const selAno = document.getElementById('financeiro-ano');
  selAno.innerHTML = anos.map(a=>`<option value="${a}" ${a===hoje.getFullYear()?'selected':''}>${a}</option>`).join('');
  const selMes = document.getElementById('financeiro-mes');
  selMes.innerHTML = MESES.map((m,i)=>`<option value="${m}" ${i===hoje.getMonth()?'selected':''}>${m}</option>`).join('');
  selAno.addEventListener('change', atualizarFinanceiro);
  selMes.addEventListener('change', atualizarFinanceiro);

  document.getElementById('botao-salvar-valores-financeiro').addEventListener('click', financeiroSalvarValores);
  document.getElementById('botao-baixar-modelo-financeiro').addEventListener('click', financeiroBaixarModeloCsv);
  document.getElementById('input-importar-financeiro').addEventListener('change', financeiroImportarCsv);
  document.getElementById('botao-adicionar-fluxo').addEventListener('click', financeiroAdicionarLancamentoFluxo);
  document.getElementById('botao-exportar-dre').addEventListener('click', financeiroExportarDreCsv);
  document.getElementById('botao-exportar-plano-contas').addEventListener('click', financeiroExportarPlanoContasCsv);

  financeiroSelectsProntos = true;
}

let financeiroSubAbaAtiva = null; // 'fluxo-caixa' | 'dre' | 'plano-contas'
let financeiroSubNavPronta = false;

function financeiroMontarSubNav(){
  if(financeiroSubNavPronta) return;
  const grupo = ['fluxo-caixa','dre','plano-contas'];
  document.querySelectorAll('#subnav-financeiro .sub-aba').forEach((botao,i)=>{
    if(i===0) botao.classList.add('ativa');
    botao.addEventListener('click', async ()=>{
      financeiroSubAbaAtiva = botao.dataset.subaba;
      document.querySelectorAll('#subnav-financeiro .sub-aba').forEach(b=>b.classList.toggle('ativa', b===botao));
      grupo.forEach(id=>{
        const el = document.getElementById('financeiro-sub-'+id);
        if(el) el.classList.toggle('ativa', id===financeiroSubAbaAtiva);
      });
      await financeiroRenderizarSubAbaAtiva();
    });
  });
  financeiroSubAbaAtiva = grupo[0];
  document.getElementById('financeiro-sub-'+financeiroSubAbaAtiva).classList.add('ativa');
  financeiroSubNavPronta = true;
}

async function atualizarFinanceiro(){
  financeiroPrepararSelects();
  financeiroMontarSubNav();
  const mes = document.getElementById('financeiro-mes').value;
  const ano = document.getElementById('financeiro-ano').value;

  await financeiroCarregarContas();
  await financeiroCarregarValores(mes, ano);

  await financeiroRenderizarSubAbaAtiva();
}

async function financeiroRenderizarSubAbaAtiva(){
  if(financeiroSubAbaAtiva==='plano-contas') financeiroRenderizarPlanoContas();
  if(financeiroSubAbaAtiva==='dre') financeiroRenderizarDre();
  if(financeiroSubAbaAtiva==='fluxo-caixa') await financeiroRenderizarFluxoCaixa();
}

function financeiroRenderizarPlanoContas(){
  document.getElementById('financeiro-arvore').innerHTML = '<p class="vazio">Carregando...</p>';
  const podeEditar = temPermissao('editar_financeiro');
  montarArvoreContas('financeiro-arvore', {comValores:true, podeEditar});
  document.getElementById('botao-salvar-valores-financeiro').style.display = podeEditar ? 'inline-flex' : 'none';
}

// DRE em 9 etapas (ver Documento 5 do usuário) — mesma matemática final de
// antes (conferido: bate com o Resultado real já validado), só que agora
// mostra as etapas intermediárias (Lucro Bruto, EBITDA, Resultado
// Financeiro, Prolabore em separado) em vez de um bloco só de "despesas".
function financeiroCalcularDre(){
  const v = cod => financeiroValorDaConta(cod, financeiroContasCache, financeiroValoresCache);
  const receitaBruta = v('3.1');
  const deducoes = Math.abs(v('3.2'));
  const receitaLiquida = receitaBruta - deducoes;
  const custoServico = Math.abs(v('4'));
  const lucroBruto = receitaLiquida - custoServico;
  // Despesas operacionais = só os grupos 5.1 a 5.4 (pessoal, compras/manutenção,
  // operacionais, cartões) — 5.5 (financeiras) e 5.6 (prolabore) ficam de fora
  // daqui e entram depois, em etapas próprias.
  const despesasOperacionais = ['5.1','5.2','5.3','5.4']
    .reduce((s,cod)=> s + Math.abs(v(cod)), 0);
  const resultadoOperacional = lucroBruto - despesasOperacionais; // EBITDA
  const resultadoFinanceiro = v('5.5'); // já vem com sinal (negativo se só tem despesa financeira)
  const prolabore = Math.abs(v('5.6'));
  const lucroLiquido = resultadoOperacional + resultadoFinanceiro - prolabore;
  const margemLiquidaPct = receitaBruta ? (lucroLiquido/receitaBruta)*100 : null;
  return { receitaBruta, deducoes, receitaLiquida, custoServico, lucroBruto,
    despesasOperacionais, resultadoOperacional, resultadoFinanceiro, prolabore,
    lucroLiquido, margemLiquidaPct };
}

function financeiroRenderizarDre(){
  const dre = financeiroCalcularDre();
  document.getElementById('financeiro-kpi-receita').textContent = formatarMoeda(dre.receitaLiquida);
  document.getElementById('financeiro-kpi-margem').textContent = formatarMoeda(dre.lucroBruto);
  document.getElementById('financeiro-kpi-ebitda').textContent = formatarMoeda(dre.resultadoOperacional);
  const elResultado = document.getElementById('financeiro-kpi-resultado');
  elResultado.textContent = formatarMoeda(dre.lucroLiquido);
  elResultado.style.color = dre.lucroLiquido<0 ? 'var(--danger)' : '';
  document.getElementById('financeiro-kpi-margem-pct').textContent = dre.margemLiquidaPct===null ? '—' : `${dre.margemLiquidaPct.toFixed(1)}%`;

  const linhas = [
    ['Receita bruta de serviços', dre.receitaBruta, true],
    ['(-) Deduções da receita bruta', dre.deducoes, false],
    ['(=) Receita líquida', dre.receitaLiquida, true],
    ['(-) Custo do serviço prestado', dre.custoServico, false],
    ['(=) Lucro bruto', dre.lucroBruto, true],
    ['(-) Despesas operacionais (pessoal, compras, operacionais, cartões)', dre.despesasOperacionais, false],
    ['(=) Resultado operacional (EBITDA)', dre.resultadoOperacional, true],
    ['(+/-) Resultado financeiro', dre.resultadoFinanceiro, false],
    ['(-) Prolabore e retiradas', dre.prolabore, false],
    ['(=) Lucro líquido', dre.lucroLiquido, true]
  ];
  document.getElementById('tabela-dre-financeiro').innerHTML =
    '<tbody>' + linhas.map(([rotulo,valor,total])=>
      `<tr${total?' class="linha-total"':''}><td>${rotulo}</td><td class="mono"${valor<0?' style="color:var(--danger);"':''}>${formatarMoeda(valor)}</td></tr>`
    ).join('') + '</tbody>';
}

async function financeiroSalvarValores(){
  const mes = document.getElementById('financeiro-mes').value;
  const ano = document.getElementById('financeiro-ano').value;
  const confirmacao = document.getElementById('confirmacao-financeiro');
  confirmacao.style.color = 'var(--ink-400)';
  confirmacao.textContent = 'Salvando...';

  const folhas = financeiroContasCache.filter(c=>financeiroEhFolha(c.codigo, financeiroContasCache));
  try{
    for(const conta of folhas){
      const valor = financeiroValoresCache[conta.codigo];
      if(valor===undefined || valor===null) continue;
      const resp = await api('salvarValorConta', {codigo: conta.codigo, mes, ano, valor});
      if(!resp.ok) throw new Error(resp.erro || `Falha ao salvar ${conta.codigo}`);
    }
  }catch(e){
    confirmacao.style.color = 'var(--danger)';
    confirmacao.textContent = e.message;
    return;
  }
  confirmacao.style.color = 'var(--teal-700)';
  confirmacao.textContent = 'Valores salvos ✓';
  financeiroRenderizarDre();
  setTimeout(()=>{ if(confirmacao.textContent==='Valores salvos ✓') confirmacao.textContent=''; }, 2500);
}

/* ---------------------------------------------------------------------
   PLANILHA-MODELO (download) e IMPORTAÇÃO (upload) — formato CSV, colunas
   fixas: codigo, nome, mes, ano, valor. O modelo já vem com uma linha por
   conta-FOLHA (as únicas que aceitam valor), pro mês/ano selecionados, com
   valor em branco pronto pra preencher. A importação só ATUALIZA valor de
   conta que já existe (não cria conta nova a partir do CSV — isso evita
   virar "conta fantasma" por erro de digitação; pra criar conta nova, usa
   o botão "+ subconta" na própria árvore).
--------------------------------------------------------------------- */
// Helper compartilhado — baixa qualquer conteúdo de texto como arquivo,
// usado pelas 3 exportações (modelo em branco, DRE, plano de contas cheio).
function financeiroBaixarCsv(conteudo, nomeArquivo){
  const blob = new Blob(['\uFEFF' + conteudo], {type:'text/csv;charset=utf-8;'}); // BOM pra abrir certinho no Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomeArquivo;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function financeiroBaixarModeloCsv(){
  const mes = document.getElementById('financeiro-mes').value;
  const ano = document.getElementById('financeiro-ano').value;
  const folhas = financeiroContasCache.filter(c=>financeiroEhFolha(c.codigo, financeiroContasCache));
  const linhas = ['codigo;nome;mes;ano;valor'];
  folhas.forEach(c=>{
    const valorAtual = financeiroValoresCache[c.codigo] || '';
    linhas.push(`${c.codigo};"${c.nome}";${mes};${ano};${valorAtual}`);
  });
  financeiroBaixarCsv(linhas.join('\r\n'), `plano-de-contas-modelo-${mes}-${ano}.csv`);
}

// Exporta o DRE do mês selecionado, já calculado (9 etapas) — dados reais,
// não um modelo em branco.
function financeiroExportarDreCsv(){
  const mes = document.getElementById('financeiro-mes').value;
  const ano = document.getElementById('financeiro-ano').value;
  const dre = financeiroCalcularDre();
  const linhas = ['etapa;valor'];
  [
    ['Receita bruta de serviços', dre.receitaBruta],
    ['(-) Deduções da receita bruta', dre.deducoes],
    ['(=) Receita líquida', dre.receitaLiquida],
    ['(-) Custo do serviço prestado', dre.custoServico],
    ['(=) Lucro bruto', dre.lucroBruto],
    ['(-) Despesas operacionais', dre.despesasOperacionais],
    ['(=) Resultado operacional (EBITDA)', dre.resultadoOperacional],
    ['(+/-) Resultado financeiro', dre.resultadoFinanceiro],
    ['(-) Prolabore e retiradas', dre.prolabore],
    ['(=) Lucro líquido', dre.lucroLiquido],
    ['Margem líquida (%)', dre.margemLiquidaPct===null?'':dre.margemLiquidaPct.toFixed(2)]
  ].forEach(([etapa,valor])=> linhas.push(`"${etapa}";${valor}`));
  financeiroBaixarCsv(linhas.join('\r\n'), `dre-${mes}-${ano}.csv`);
}

// Exporta o plano de contas INTEIRO (folhas e contas-somatório), com o
// valor real de cada uma no mês selecionado — diferente do "modelo", que só
// tem folha e vem em branco pra preencher.
function financeiroExportarPlanoContasCsv(){
  const mes = document.getElementById('financeiro-mes').value;
  const ano = document.getElementById('financeiro-ano').value;
  const linhas = ['codigo;nome;nivel;natureza;folha;valor'];
  const ordenar = lista => lista.slice().sort((a,b)=>(a.ordem-b.ordem)||a.codigo.localeCompare(b.codigo));
  function escrever(codigo, profundidade){
    const conta = financeiroContasCache.find(c=>c.codigo===codigo);
    if(!conta) return;
    const ehFolha = financeiroEhFolha(codigo, financeiroContasCache);
    const valor = financeiroValorDaConta(codigo, financeiroContasCache, financeiroValoresCache);
    const nomeComRecuo = '  '.repeat(profundidade) + conta.nome;
    linhas.push(`${conta.codigo};"${nomeComRecuo}";${profundidade+1};${conta.natureza};${ehFolha?'sim':'não'};${valor}`);
    ordenar(financeiroFilhosDe(codigo, financeiroContasCache)).forEach(f=>escrever(f.codigo, profundidade+1));
  }
  ordenar(financeiroRaizes(financeiroContasCache)).forEach(r=>escrever(r.codigo, 0));
  financeiroBaixarCsv(linhas.join('\r\n'), `plano-de-contas-completo-${mes}-${ano}.csv`);
}

function financeiroParsearLinhaCsv(linha, delimitador){
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

function financeiroImportarCsv(ev){
  const arquivo = ev.target.files[0];
  const resumo = document.getElementById('resumo-importacao-financeiro');
  if(!arquivo) return;
  resumo.style.color = 'var(--ink-600)';
  resumo.textContent = 'Lendo arquivo...';

  const leitor = new FileReader();
  leitor.onload = async () => {
    const texto = leitor.result.replace(/^\uFEFF/, '');
    const linhas = texto.split(/\r\n|\r|\n/).filter(l=>l.trim()!=='');
    if(linhas.length<2){ resumo.style.color='var(--danger)'; resumo.textContent='Arquivo vazio.'; return; }
    const delimitador = (linhas[0].match(/;/g)||[]).length >= (linhas[0].match(/,/g)||[]).length ? ';' : ',';
    const cabecalho = financeiroParsearLinhaCsv(linhas[0], delimitador).map(h=>h.trim().toLowerCase());
    const idxCodigo = cabecalho.indexOf('codigo');
    const idxMes = cabecalho.indexOf('mes');
    const idxAno = cabecalho.indexOf('ano');
    const idxValor = cabecalho.indexOf('valor');
    if(idxCodigo===-1 || idxMes===-1 || idxAno===-1 || idxValor===-1){
      resumo.style.color = 'var(--danger)';
      resumo.textContent = 'Cabeçalho precisa ter as colunas: codigo, nome, mes, ano, valor.';
      return;
    }

    const codigosValidos = new Set(financeiroContasCache.map(c=>c.codigo));
    let atualizados = 0, ignorados = 0;
    for(let i=1;i<linhas.length;i++){
      const campos = financeiroParsearLinhaCsv(linhas[i], delimitador);
      const codigo = (campos[idxCodigo]||'').trim();
      const mes = (campos[idxMes]||'').trim();
      const ano = (campos[idxAno]||'').trim();
      const valorTexto = (campos[idxValor]||'').trim().replace(',', '.');
      if(!codigo || !codigosValidos.has(codigo) || !mes || !ano || valorTexto===''){ ignorados++; continue; }
      const valor = Number(valorTexto);
      if(isNaN(valor)){ ignorados++; continue; }
      const resp = await api('salvarValorConta', {codigo, mes, ano, valor});
      if(resp.ok) atualizados++; else ignorados++;
    }

    resumo.style.color = ignorados>0 ? 'var(--gold-600)' : 'var(--teal-700)';
    resumo.textContent = `${atualizados} valor(es) atualizado(s).` + (ignorados>0 ? ` ${ignorados} linha(s) ignorada(s) (conta não encontrada ou valor inválido).` : '');
    document.getElementById('input-importar-financeiro').value = '';
    await atualizarFinanceiro();
  };
  leitor.readAsText(arquivo, 'UTF-8');
}

/* ---------------------------------------------------------------------
   FLUXO DE CAIXA — regime de caixa (data exata), diferente do DRE/Plano de
   Contas (só mês/ano). Cada lançamento pode opcionalmente se vincular a
   uma conta do plano, só pra ajudar a comparar depois — não é obrigatório
   nem afeta o cálculo do DRE.
--------------------------------------------------------------------- */
function financeiroPopularSelectContaPlano(){
  const sel = document.getElementById('fluxo-conta-plano');
  const folhas = financeiroContasCache.filter(c=>financeiroEhFolha(c.codigo, financeiroContasCache));
  const valorAtual = sel.value;
  sel.innerHTML = '<option value="">—</option>' +
    folhas.map(c=>`<option value="${c.codigo}">${c.codigo} — ${c.nome}</option>`).join('');
  sel.value = valorAtual;
}

async function financeiroRenderizarFluxoCaixa(){
  financeiroPopularSelectContaPlano();
  const mes = document.getElementById('financeiro-mes').value;
  const ano = document.getElementById('financeiro-ano').value;
  const { dataInicio, dataFim } = primeiroEUltimoDiaDoMes(mes, ano);
  const tabela = document.getElementById('tabela-fluxo-caixa');
  tabela.innerHTML = '<tbody><tr><td class="vazio">Carregando...</td></tr></tbody>';

  const resp = await api('listarFluxoCaixa', {dataInicio, dataFim});
  const lancamentos = resp.ok ? resp.lancamentos : [];

  const totalEntradas = lancamentos.filter(l=>l.tipo==='entrada').reduce((s,l)=>s+Number(l.valor||0),0);
  const totalSaidas = lancamentos.filter(l=>l.tipo==='saida').reduce((s,l)=>s+Number(l.valor||0),0);
  document.getElementById('fluxo-kpi-entradas').textContent = formatarMoeda(totalEntradas);
  document.getElementById('fluxo-kpi-saidas').textContent = formatarMoeda(totalSaidas);
  const elSaldo = document.getElementById('fluxo-kpi-saldo');
  const saldo = totalEntradas - totalSaidas;
  elSaldo.textContent = formatarMoeda(saldo);
  elSaldo.style.color = saldo<0 ? 'var(--danger)' : '';

  const podeEditar = temPermissao('editar_financeiro');
  if(lancamentos.length===0){
    tabela.innerHTML = '<tbody><tr><td class="vazio">Nenhum lançamento nesse período.</td></tr></tbody>';
    return;
  }
  let acumulado = 0;
  const linhas = lancamentos.map(l=>{
    acumulado += l.tipo==='entrada' ? Number(l.valor||0) : -Number(l.valor||0);
    const conta = l.conta_plano_codigo ? financeiroContasCache.find(c=>c.codigo===l.conta_plano_codigo) : null;
    return `<tr data-id="${l.id}">
      <td>${formatarDataExibicao(l.data)}</td>
      <td>${l.descricao}</td>
      <td>${l.banco||'—'}</td>
      <td>${conta ? conta.nome : '—'}</td>
      <td class="mono" style="color:${l.tipo==='entrada'?'var(--teal-700)':'var(--danger)'};">${l.tipo==='entrada'?'+':'-'} ${formatarMoeda(l.valor)}</td>
      <td class="mono">${formatarMoeda(acumulado)}</td>
      ${podeEditar ? `<td><button type="button" class="botao sutil pequeno financeiro-excluir-fluxo" data-id="${l.id}">×</button></td>` : ''}
    </tr>`;
  }).join('');
  tabela.innerHTML = `
    <thead><tr><th>Data</th><th>Descrição</th><th>Banco</th><th>Conta vinculada</th><th>Valor</th><th>Saldo acumulado</th>${podeEditar?'<th></th>':''}</tr></thead>
    <tbody>${linhas}</tbody>`;

  tabela.querySelectorAll('.financeiro-excluir-fluxo').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      if(!confirm('Excluir esse lançamento?')) return;
      await api('excluirLancamentoFluxoCaixa', {id: btn.dataset.id});
      await financeiroRenderizarFluxoCaixa();
    });
  });
}

async function financeiroAdicionarLancamentoFluxo(){
  const confirmacao = document.getElementById('confirmacao-fluxo');
  const data = document.getElementById('fluxo-data').value;
  const descricao = document.getElementById('fluxo-descricao').value.trim();
  const valor = Number(document.getElementById('fluxo-valor').value);
  const tipo = document.getElementById('fluxo-tipo').value;
  const banco = document.getElementById('fluxo-banco').value;
  const conta_plano_codigo = document.getElementById('fluxo-conta-plano').value;

  if(!data || !descricao || !valor){
    confirmacao.style.color = 'var(--danger)';
    confirmacao.textContent = 'Preencha data, descrição e valor.';
    return;
  }

  confirmacao.style.color = 'var(--ink-400)';
  confirmacao.textContent = 'Salvando...';
  const resp = await api('criarLancamentoFluxoCaixa', {data, descricao, valor, tipo, banco, conta_plano_codigo});
  if(!resp.ok){
    confirmacao.style.color = 'var(--danger)';
    confirmacao.textContent = resp.erro || 'Não foi possível salvar.';
    return;
  }
  confirmacao.style.color = 'var(--teal-700)';
  confirmacao.textContent = 'Lançamento adicionado ✓';
  document.getElementById('fluxo-descricao').value = '';
  document.getElementById('fluxo-valor').value = '';
  setTimeout(()=>{ if(confirmacao.textContent==='Lançamento adicionado ✓') confirmacao.textContent=''; }, 2000);

  // Se a data lançada cair fora do mês/ano selecionado no filtro, avisa —
  // o lançamento foi salvo, só não vai aparecer na lista até trocar o filtro.
  const mesSelecionado = document.getElementById('financeiro-mes').value;
  const anoSelecionado = document.getElementById('financeiro-ano').value;
  const { dataInicio, dataFim } = primeiroEUltimoDiaDoMes(mesSelecionado, anoSelecionado);
  if(data < dataInicio || data > dataFim){
    confirmacao.textContent = `Salvo — mas essa data não é de ${mesSelecionado}/${anoSelecionado}, troque o filtro pra ver na lista.`;
  }

  await financeiroRenderizarFluxoCaixa();
}
