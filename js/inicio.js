/* =====================================================================
   ABA INÍCIO — sem filtro nenhum, de propósito: sempre mostra hoje e o mês
   corrente, calculados na hora que a aba abre (new Date()). Pensada pra
   ser a primeira coisa que a pessoa vê depois do login — uma foto rápida
   de "como está indo agora", sem precisar escolher nada.
===================================================================== */
function inicioDataDeHojeISO(){
  const hoje = new Date();
  const pad = n => String(n).padStart(2,'0');
  return `${hoje.getFullYear()}-${pad(hoje.getMonth()+1)}-${pad(hoje.getDate())}`;
}

function inicioPrimeiroDiaDoMesISO(){
  const hoje = new Date();
  const pad = n => String(n).padStart(2,'0');
  return `${hoje.getFullYear()}-${pad(hoje.getMonth()+1)}-01`;
}

function inicioSomarPorAndar(registros){
  const resultado = { total: {quantidade:0, valor:0}, 'TÉRREO': {quantidade:0, valor:0}, 'COPARTICIPADOS': {quantidade:0, valor:0} };
  registros.forEach(r=>{
    resultado.total.quantidade++;
    resultado.total.valor += Number(r.valor)||0;
    const andar = String(r.andar||'').trim().toUpperCase();
    if(resultado[andar]){
      resultado[andar].quantidade++;
      resultado[andar].valor += Number(r.valor)||0;
    }
  });
  return resultado;
}

async function atualizarInicio(){
  const hojeISO = inicioDataDeHojeISO();
  const inicioMesISO = inicioPrimeiroDiaDoMesISO();

  ['atendimentos-hoje','valor-hoje','terreo-hoje','copart-hoje',
   'atendimentos-mes','valor-mes','terreo-mes','copart-mes'].forEach(id=>{
    document.getElementById('inicio-kpi-'+id).textContent = '…';
  });

  const [respHoje, respMes] = await Promise.all([
    buscarProducaoCompleta({dataInicio: hojeISO, dataFim: hojeISO}),
    buscarProducaoCompleta({dataInicio: inicioMesISO, dataFim: hojeISO})
  ]);

  if(respHoje.ok){
    const s = inicioSomarPorAndar(respHoje.registros||[]);
    document.getElementById('inicio-kpi-atendimentos-hoje').textContent = s.total.quantidade;
    document.getElementById('inicio-kpi-valor-hoje').textContent = formatarMoeda(s.total.valor);
    document.getElementById('inicio-kpi-terreo-hoje').textContent = `${s['TÉRREO'].quantidade} • ${formatarMoeda(s['TÉRREO'].valor)}`;
    document.getElementById('inicio-kpi-copart-hoje').textContent = `${s['COPARTICIPADOS'].quantidade} • ${formatarMoeda(s['COPARTICIPADOS'].valor)}`;
  }

  if(respMes.ok){
    const registrosMes = respMes.registros||[];
    const s = inicioSomarPorAndar(registrosMes);
    document.getElementById('inicio-kpi-atendimentos-mes').textContent = s.total.quantidade;
    document.getElementById('inicio-kpi-valor-mes').textContent = formatarMoeda(s.total.valor);
    document.getElementById('inicio-kpi-terreo-mes').textContent = `${s['TÉRREO'].quantidade} • ${formatarMoeda(s['TÉRREO'].valor)}`;
    document.getElementById('inicio-kpi-copart-mes').textContent = `${s['COPARTICIPADOS'].quantidade} • ${formatarMoeda(s['COPARTICIPADOS'].valor)}`;
    inicioDesenharGraficos(registrosMes);
  }
}

/* ---------------------------------------------------------------------
   GRÁFICOS — reaproveita a mini-biblioteca SVG de graficos.js. Todos os 3
   olham só pro mês atual até hoje (o mesmo lote de dados já buscado acima,
   sem chamada nova ao banco).
--------------------------------------------------------------------- */
function inicioDesenharGraficos(registrosMes){
  // Pizza — comparativo por andar
  const porAndar = inicioSomarPorAndar(registrosMes);
  const andares = ['TÉRREO','COPARTICIPADOS'].filter(a=>porAndar[a].quantidade>0);
  if(andares.length){
    miniGraficoRosca('inicio-grafico-andar', andares.map(a=>a==='TÉRREO'?'Térreo':'Coparticipados'), andares.map(a=>porAndar[a].valor));
  } else {
    graficoVazio('inicio-grafico-andar');
  }

  // Pizza — Particular × Convênios
  let particular = 0, convenios = 0;
  registrosMes.forEach(r=>{
    const c = r.convenio;
    if(!c || String(c).trim().toUpperCase()==='PARTICULAR') particular += Number(r.valor)||0;
    else convenios += Number(r.valor)||0;
  });
  if(particular>0 || convenios>0){
    miniGraficoRosca('inicio-grafico-convenio', ['Particular','Convênios'], [particular, convenios]);
  } else {
    graficoVazio('inicio-grafico-convenio');
  }

  // Barras — financeiro diário (dia 1 até hoje)
  const porDia = {};
  registrosMes.forEach(r=>{
    const dia = String(r.data||'').slice(8,10);
    if(!dia) return;
    porDia[dia] = (porDia[dia]||0) + (Number(r.valor)||0);
  });
  const diasOrdenados = Object.keys(porDia).sort((a,b)=>Number(a)-Number(b));
  if(diasOrdenados.length){
    miniGraficoBarras('inicio-grafico-diario', diasOrdenados, diasOrdenados.map(d=>Math.round(porDia[d])), '#146B5D');
  } else {
    graficoVazio('inicio-grafico-diario');
  }
}
