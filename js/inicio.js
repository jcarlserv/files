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
    const s = inicioSomarPorAndar(respMes.registros||[]);
    document.getElementById('inicio-kpi-atendimentos-mes').textContent = s.total.quantidade;
    document.getElementById('inicio-kpi-valor-mes').textContent = formatarMoeda(s.total.valor);
    document.getElementById('inicio-kpi-terreo-mes').textContent = `${s['TÉRREO'].quantidade} • ${formatarMoeda(s['TÉRREO'].valor)}`;
    document.getElementById('inicio-kpi-copart-mes').textContent = `${s['COPARTICIPADOS'].quantidade} • ${formatarMoeda(s['COPARTICIPADOS'].valor)}`;
  }
}
