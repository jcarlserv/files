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
    html += `<span style="flex:1;font-weight:${filhos.length>0?'700':'400'};color:${filhos.length>0?'var(--plum-900)':'var(--ink-900)'};">${conta.nome}${!ehFolha?'':(conta.natureza==='saida'?' <span class="tag" style="background:var(--danger-100);color:var(--danger);margin-left:6px;">saída</span>':' <span class="tag" style="margin-left:6px;">entrada</span>')}</span>`;
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
  let natureza = 'saida';
  const ehReceita = paiCodigo.split('.')[0]==='3';
  if(ehReceita){
    natureza = confirm('Essa conta SOMA no resultado (ex.: uma receita)? Cancelar = SUBTRAI (ex.: uma dedução/imposto).') ? 'entrada' : 'saida';
  }
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

  financeiroSelectsProntos = true;
}

async function atualizarFinanceiro(){
  financeiroPrepararSelects();
  const mes = document.getElementById('financeiro-mes').value;
  const ano = document.getElementById('financeiro-ano').value;
  document.getElementById('financeiro-arvore').innerHTML = '<p class="vazio">Carregando...</p>';

  await financeiroCarregarContas();
  await financeiroCarregarValores(mes, ano);

  const podeEditar = temPermissao('editar_financeiro');
  montarArvoreContas('financeiro-arvore', {comValores:true, podeEditar});
  document.getElementById('botao-salvar-valores-financeiro').style.display = podeEditar ? 'inline-flex' : 'none';

  financeiroAtualizarResumo();
}

function financeiroAtualizarResumo(){
  let receita=0, deducoes=0, csp=0, despesas=0;
  financeiroContasCache.filter(c=>financeiroEhFolha(c.codigo, financeiroContasCache)).forEach(c=>{
    const v = Number(financeiroValoresCache[c.codigo])||0;
    const raiz = c.codigo.split('.')[0];
    if(raiz==='3') { if(c.natureza==='saida') deducoes += v; else receita += v; }
    else if(raiz==='4') csp += v;
    else if(raiz==='5') despesas += v;
  });
  const receitaLiquida = receita - deducoes;
  const margem = receitaLiquida - csp;
  const resultado = margem - despesas;
  document.getElementById('financeiro-kpi-receita').textContent = formatarMoeda(receita);
  document.getElementById('financeiro-kpi-margem').textContent = formatarMoeda(margem);
  const elResultado = document.getElementById('financeiro-kpi-resultado');
  elResultado.textContent = formatarMoeda(resultado);
  elResultado.style.color = resultado<0 ? 'var(--danger)' : '';
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
  financeiroAtualizarResumo();
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
function financeiroBaixarModeloCsv(){
  const mes = document.getElementById('financeiro-mes').value;
  const ano = document.getElementById('financeiro-ano').value;
  const folhas = financeiroContasCache.filter(c=>financeiroEhFolha(c.codigo, financeiroContasCache));
  const linhas = ['codigo;nome;mes;ano;valor'];
  folhas.forEach(c=>{
    const valorAtual = financeiroValoresCache[c.codigo] || '';
    linhas.push(`${c.codigo};"${c.nome}";${mes};${ano};${valorAtual}`);
  });
  const conteudo = '\uFEFF' + linhas.join('\r\n'); // BOM pra abrir certinho no Excel
  const blob = new Blob([conteudo], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `plano-de-contas-modelo-${mes}-${ano}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
