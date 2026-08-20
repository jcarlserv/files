/* =====================================================================
   ProdClin — graficos.js
   Formatação de moeda/números e a mini-biblioteca de gráficos SVG própria (sem dependência
   externa) usada em todas as abas com gráfico.
   Este arquivo é carregado via <script src> em index.html, na mesma ordem
   em que aparecia originalmente dentro do <script> único — variáveis e
   funções continuam compartilhando o escopo global, exatamente como antes.
===================================================================== */

const formatarMoeda = v => (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const arredondar1 = v => Math.round((Number(v)||0)*10)/10;


/* =====================================================================
   MINI-BIBLIOTECA DE GRÁFICOS PRÓPRIA (SVG puro, sem dependência externa)
   Substitui o Chart.js — assim os gráficos nunca dependem de internet.
===================================================================== */
let PALETA_GRAFICOS = ['#5C2350','#146B5D','#B9862E','#8A3D79','#0E5548','#C495B8','#9C6E22','#4A1D45'];

// Gera N cores distinguíveis a partir de uma cor base — gira o matiz (hue)
// em passos largos (ângulo áureo, técnica padrão pra paleta categórica),
// mantendo saturação/luminosidade parecidas com a base. Usa os
// conversores hex/HSL que já existem em configuracoes.js (mesmo padrão
// usado pra derivar a paleta de cores do app a partir da logo).
function gerarPaletaGraficos(hexBase, n=8){
  if(!hexBase || typeof hexParaRgb!=='function') return PALETA_GRAFICOS;
  const {r,g,b} = hexParaRgb(hexBase);
  const {h, s, l} = rgbParaHsl(r,g,b);
  const satUsada = Math.max(0.30, Math.min(s, 0.65));
  const lumUsada = Math.max(0.28, Math.min(l, 0.55));
  const cores = [];
  for(let i=0;i<n;i++){
    const matiz = (h*360 + i*137.5) % 360; // 137.5° ≈ ângulo áureo
    const {r:rr,g:gg,b:bb} = hslParaRgb(matiz/360, satUsada, lumUsada);
    cores.push(rgbParaHex(rr,gg,bb));
  }
  return cores;
}

// Aplica o tema de gráficos (cor base + tamanho do texto) globalmente —
// muda a paleta usada pelas roscas/multi-série daqui pra frente, e o
// tamanho do texto via variável CSS (pega em todo gráfico da página,
// incluindo os que já estão desenhados).
function aplicarTemaGraficos(corBase, tamanho){
  if(corBase) PALETA_GRAFICOS = gerarPaletaGraficos(corBase);
  const tamanhos = { pequeno: [9, 8.5], medio: [10.5, 10], grande: [13, 12] };
  const [tamEixo, tamValor] = tamanhos[tamanho] || tamanhos.medio;
  document.documentElement.style.setProperty('--grafico-tam-eixo', tamEixo+'px');
  document.documentElement.style.setProperty('--grafico-tam-valor', tamValor+'px');
}


function graficoVazio(idContainer, mensagem){
  const el = document.getElementById(idContainer);
  if(el) el.innerHTML = `<p class="vazio" style="padding:20px 0;">${mensagem || 'Sem dados para exibir.'}</p>`;
}


function truncarRotulo(texto, max=12){
  texto = String(texto);
  return texto.length>max ? texto.slice(0,max-1)+'…' : texto;
}


// ---------- Gráfico de barras (um único valor por rótulo) ----------
function miniGraficoBarras(idContainer, labels, valores, cor='#5C2350'){
  const container = document.getElementById(idContainer);
  if(!container) return;
  if(!labels.length){ graficoVazio(idContainer); return; }


  const W = 640, H = 260, margemEsq = 44, margemDir = 12, margemTopo = 14, margemBaixo = 46;
  const areaW = W - margemEsq - margemDir, areaH = H - margemTopo - margemBaixo;
  const maxValor = Math.max(1, ...valores);
  const larguraBarra = Math.min(48, areaW/labels.length*0.6);
  const passo = areaW/labels.length;


  let barras = '', rotulosX = '';
  labels.forEach((lab,i)=>{
    const v = valores[i]||0;
    const alturaBarra = (v/maxValor)*areaH;
    const x = margemEsq + i*passo + (passo-larguraBarra)/2;
    const y = margemTopo + areaH - alturaBarra;
    barras += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${larguraBarra.toFixed(1)}" height="${Math.max(1,alturaBarra).toFixed(1)}" rx="4" fill="${cor}"><title>${lab}: ${v}</title></rect>`;
    barras += `<text class="rotulo-valor" x="${(x+larguraBarra/2).toFixed(1)}" y="${(y-5).toFixed(1)}" text-anchor="middle">${v}</text>`;
    rotulosX += `<text class="rotulo-eixo" x="${(x+larguraBarra/2).toFixed(1)}" y="${H-margemBaixo+16}" text-anchor="middle" transform="rotate(-35 ${(x+larguraBarra/2).toFixed(1)} ${H-margemBaixo+16})">${truncarRotulo(lab)}</text>`;
  });


  const linhasGuia = [0,0.5,1].map(f=>{
    const y = margemTopo + areaH*(1-f);
    return `<line x1="${margemEsq}" y1="${y.toFixed(1)}" x2="${W-margemDir}" y2="${y.toFixed(1)}" stroke="#E7DDE4" stroke-width="1"/>`;
  }).join('');


  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${linhasGuia}${barras}${rotulosX}</svg>`;
}


// ---------- Gráfico de barras empilhadas (2 séries por rótulo) ----------
function miniGraficoBarrasEmpilhadas(idContainer, labels, series){
  // series = [{nome, dados:[...], cor}, {nome, dados:[...], cor}]
  const container = document.getElementById(idContainer);
  if(!container) return;
  if(!labels.length){ graficoVazio(idContainer); return; }


  const W = 640, H = 280, margemEsq = 44, margemDir = 12, margemTopo = 14, margemBaixo = 60;
  const areaW = W - margemEsq - margemDir, areaH = H - margemTopo - margemBaixo;
  const totais = labels.map((_,i)=> series.reduce((s,serie)=>s+(serie.dados[i]||0),0));
  const maxValor = Math.max(1, ...totais);
  const larguraBarra = Math.min(48, areaW/labels.length*0.6);
  const passo = areaW/labels.length;


  let barras = '', rotulosX = '', rotulosTotal = '';
  labels.forEach((lab,i)=>{
    const x = margemEsq + i*passo + (passo-larguraBarra)/2;
    let yAtual = margemTopo + areaH;
    series.forEach(serie=>{
      const v = serie.dados[i]||0;
      const altura = (v/maxValor)*areaH;
      yAtual -= altura;
      barras += `<rect x="${x.toFixed(1)}" y="${yAtual.toFixed(1)}" width="${larguraBarra.toFixed(1)}" height="${Math.max(0,altura).toFixed(1)}" fill="${serie.cor}"><title>${serie.nome} — ${lab}: ${v}</title></rect>`;
    });
    // Total da barra (soma de todas as séries daquele rótulo), em cima dela.
    rotulosTotal += `<text class="rotulo-valor" x="${(x+larguraBarra/2).toFixed(1)}" y="${(yAtual-6).toFixed(1)}" text-anchor="middle">${totais[i]}</text>`;
    rotulosX += `<text class="rotulo-eixo" x="${(x+larguraBarra/2).toFixed(1)}" y="${H-margemBaixo+16}" text-anchor="middle" transform="rotate(-35 ${(x+larguraBarra/2).toFixed(1)} ${H-margemBaixo+16})">${truncarRotulo(lab)}</text>`;
  });


  const linhasGuia = [0,0.5,1].map(f=>{
    const y = margemTopo + areaH*(1-f);
    return `<line x1="${margemEsq}" y1="${y.toFixed(1)}" x2="${W-margemDir}" y2="${y.toFixed(1)}" stroke="#E7DDE4" stroke-width="1"/>`;
  }).join('');


  const legenda = series.map(s=>`<div class="mini-legenda-item"><span class="mini-legenda-ponto" style="background:${s.cor};"></span>${s.nome}</div>`).join('');
  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${linhasGuia}${barras}${rotulosTotal}${rotulosX}</svg><div class="mini-legenda">${legenda}</div>`;
}


// ---------- Gráfico de rosca (doughnut) ----------
function miniGraficoRosca(idContainer, labels, valores, cores=PALETA_GRAFICOS){
  const container = document.getElementById(idContainer);
  if(!container) return;
  if(!labels.length){ graficoVazio(idContainer); return; }


  const total = valores.reduce((a,b)=>a+b,0) || 1;
  const cx=110, cy=110, rExterno=100, rInterno=58;
  let anguloAtual = -90;
  let fatias = '';
  labels.forEach((lab,i)=>{
    const valor = valores[i]||0;
    const angulo = (valor/total)*360;
    const anguloFim = anguloAtual + angulo;
    const grandeArco = angulo>180 ? 1 : 0;
    const rad = a => (a*Math.PI)/180;
    const x1e = cx + rExterno*Math.cos(rad(anguloAtual)), y1e = cy + rExterno*Math.sin(rad(anguloAtual));
    const x2e = cx + rExterno*Math.cos(rad(anguloFim)), y2e = cy + rExterno*Math.sin(rad(anguloFim));
    const x1i = cx + rInterno*Math.cos(rad(anguloFim)), y1i = cy + rInterno*Math.sin(rad(anguloFim));
    const x2i = cx + rInterno*Math.cos(rad(anguloAtual)), y2i = cy + rInterno*Math.sin(rad(anguloAtual));
    const cor = cores[i%cores.length];
    fatias += `<path d="M ${x1e.toFixed(2)} ${y1e.toFixed(2)} A ${rExterno} ${rExterno} 0 ${grandeArco} 1 ${x2e.toFixed(2)} ${y2e.toFixed(2)} L ${x1i.toFixed(2)} ${y1i.toFixed(2)} A ${rInterno} ${rInterno} 0 ${grandeArco} 0 ${x2i.toFixed(2)} ${y2i.toFixed(2)} Z" fill="${cor}"><title>${lab}: ${valor} (${Math.round(valor/total*100)}%)</title></path>`;
    anguloAtual = anguloFim;
  });


  const legenda = labels.map((lab,i)=>`<div class="mini-legenda-item"><span class="mini-legenda-ponto" style="background:${cores[i%cores.length]};"></span>${truncarRotulo(lab,18)} — ${valores[i]||0} (${Math.round((valores[i]||0)/total*100)}%)</div>`).join('');
  container.innerHTML = `<svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" style="max-width:240px;margin:0 auto;display:block;">${fatias}</svg><div class="mini-legenda">${legenda}</div>`;
}


// ---------- Gráfico de linhas (até 2 séries, comparação) ----------
function miniGraficoLinhas(idContainer, labels, series){
  // series = [{nome, dados:[...], cor, tracejado:bool}]
  const container = document.getElementById(idContainer);
  if(!container) return;
  if(!labels.length){ graficoVazio(idContainer); return; }


  const W = 640, H = 260, margemEsq = 52, margemDir = 16, margemTopo = 14, margemBaixo = 40;
  const areaW = W - margemEsq - margemDir, areaH = H - margemTopo - margemBaixo;
  const todosValores = series.flatMap(s=>s.dados);
  const maxValor = Math.max(1, ...todosValores);
  const passo = labels.length>1 ? areaW/(labels.length-1) : 0;


  const linhasGuia = [0,0.5,1].map(f=>{
    const y = margemTopo + areaH*(1-f);
    return `<line x1="${margemEsq}" y1="${y.toFixed(1)}" x2="${W-margemDir}" y2="${y.toFixed(1)}" stroke="#E7DDE4" stroke-width="1"/>`;
  }).join('');


  const rotulosX = labels.map((lab,i)=>{
    const x = margemEsq + i*passo;
    return `<text class="rotulo-eixo" x="${x.toFixed(1)}" y="${H-margemBaixo+18}" text-anchor="middle">${truncarRotulo(lab,6)}</text>`;
  }).join('');


  let linhas = '';
  series.forEach((serie, idxSerie)=>{
    const pontos = serie.dados.map((v,i)=>{
      const x = margemEsq + i*passo;
      const y = margemTopo + areaH - (v/maxValor)*areaH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    // Rótulo do valor em cima de cada ponto — quando tem 2 séries, a segunda
    // fica com o texto um pouco mais abaixo do ponto, pra não colidir com a
    // primeira quando as linhas ficam próximas.
    const rotulosPonto = serie.dados.map((v,i)=>{
      const x = margemEsq + i*passo;
      const y = margemTopo + areaH - (v/maxValor)*areaH;
      const yTexto = idxSerie===0 ? y-9 : y+16;
      return `<text class="rotulo-valor" x="${x.toFixed(1)}" y="${yTexto.toFixed(1)}" text-anchor="middle" fill="${serie.cor}">${v}</text>`;
    }).join('');
    const circulos = serie.dados.map((v,i)=>{
      const x = margemEsq + i*passo;
      const y = margemTopo + areaH - (v/maxValor)*areaH;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${serie.cor}"><title>${serie.nome} — ${labels[i]}: ${v}</title></circle>`;
    }).join('');
    linhas += `<polyline points="${pontos}" fill="none" stroke="${serie.cor}" stroke-width="2.5" ${serie.tracejado?'stroke-dasharray="6,5"':''}/>${circulos}${rotulosPonto}`;
  });


  const legenda = series.map(s=>`<div class="mini-legenda-item"><span class="mini-legenda-ponto" style="background:${s.cor};"></span>${s.nome}</div>`).join('');
  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${linhasGuia}${linhas}${rotulosX}</svg><div class="mini-legenda">${legenda}</div>`;
}


/* ---------------------------------------------------------------------
   SESSÃO — mantém o usuário logado ao atualizar/recarregar a página.
   Guarda só a identidade (usuário/papel/nome), nunca a senha. Isso não
   piora a segurança do sistema em relação ao que já existia: hoje o
   controle de acesso real depende só da tela de login mesmo (ver
   observação sobre RLS/Supabase Auth no prompt de arquitetura).
--------------------------------------------------------------------- */
