/* =====================================================================
   ABA METAS — Valor da Meta = Turnos Utilizados × Vr Mínimo esperado por
   turno daquele profissional. Os DOIS agora são digitáveis — "Turnos
   Utilizados" vem PRÉ-PREENCHIDO com a contagem real da produção do mês
   (dias+turno distintos com lançamento), como sugestão, mas o usuário
   pode ajustar e salvar seu próprio número (por exemplo pra planejar um
   mês que ainda não tem lançamento, ou corrigir uma contagem que não
   bateu). O que fica salvo em `metas.turnos_utilizados` é o que vale daí
   em diante — RMR, Análises e Apresentação usam esse valor salvo, não
   recalculam da produção de novo.

   Isso substitui o antigo par "Turnos disponibilizados" + "Meta de
   quantidade" — que não é mais usado em lugar nenhum do sistema. A
   verificação de meta passa a ser 100% por valor, nunca mais por
   quantidade.

   Extraído de configuracoes.js (era junto porque as duas eram telas
   pequenas — deixou de fazer sentido depois que Metas passou a puxar o
   cartão de Financeiro/Plano de Contas em Configurações).
===================================================================== */

async function atualizarMetas(){
  const mes = document.getElementById('filtro-mes-metas').value;
  const ano = document.getElementById('filtro-ano-metas').value;
  document.getElementById('tabela-metas').innerHTML = '<tr><td class="vazio">Carregando metas...</td></tr>';
  await atualizarTabelaMetas(mes, ano);
  await carregarNota(mes, ano);
  const podeEditarMetas = temPermissao('editar_metas');
  document.getElementById('botao-salvar-nota').style.display = podeEditarMetas ? 'inline-flex' : 'none';
  document.getElementById('texto-nota').disabled = !podeEditarMetas;
}

// Turnos realmente usados no mês, por profissional — conta combinações
// distintas de (data, turno) com lançamento. Só usado como SUGESTÃO
// inicial pro campo (quando ainda não tem nada salvo pra esse prof/mês).
function metasTurnosUtilizadosPorProf(registrosMes){
  const porProf = {};
  registrosMes.forEach(r=>{
    if(!porProf[r.prof]) porProf[r.prof] = new Set();
    porProf[r.prof].add(r.data+'_'+r.turno);
  });
  const resultado = {};
  Object.keys(porProf).forEach(prof=>{ resultado[prof] = porProf[prof].size; });
  return resultado;
}

async function atualizarTabelaMetas(mes, ano){
  const { dataInicio, dataFim } = primeiroEUltimoDiaDoMes(mes, ano);
  const [respMetas, respProducao] = await Promise.all([
    api('listarMetas', {mes, ano}),
    buscarProducaoCompleta({dataInicio, dataFim})
  ]);
  const metas = respMetas.ok !== false ? (respMetas.metas||[]) : [];
  const turnosCalculados = respProducao.ok ? metasTurnosUtilizadosPorProf(respProducao.registros||[]) : {};
  const profissionais = estado.listas.profissionais||[];
  const podeEditarMetas = temPermissao('editar_metas');
  const desabilitado = podeEditarMetas ? '' : 'disabled';
  const tabela = document.getElementById('tabela-metas');
  tabela.innerHTML = `
    <thead><tr><th>Profissional</th><th>Turnos utilizados</th><th>Vr mínimo p/ prof (R$)</th><th>Valor da meta (R$)</th><th></th></tr></thead>
    <tbody>${profissionais.map(prof=>{
      const m = metas.find(x=>x.prof===prof) || {};
      // Já tem algo salvo pra esse prof/mês? Usa o salvo. Senão, sugere o
      // calculado da produção real (só como ponto de partida).
      const turnosIniciais = (m.turnos_utilizados !== undefined && m.turnos_utilizados !== null && m.turnos_utilizados !== '')
        ? m.turnos_utilizados : (turnosCalculados[prof] || '');
      const vrMinimo = m.valor_minimo_turno || '';
      const valorMeta = (Number(turnosIniciais)||0) * (Number(vrMinimo)||0);
      return `<tr data-prof="${prof}">
        <td>${prof}</td>
        <td><input type="number" class="input-turnos-utilizados" value="${turnosIniciais}" ${desabilitado} style="width:100px;padding:6px;border-radius:6px;border:1.5px solid var(--line);"></td>
        <td><input type="number" class="input-vr-minimo" value="${vrMinimo}" step="0.01" ${desabilitado} style="width:120px;padding:6px;border-radius:6px;border:1.5px solid var(--line);"></td>
        <td class="mono valor-meta-calculado">${formatarMoeda(valorMeta)}</td>
        <td>${podeEditarMetas?'<button class="botao secundario pequeno botao-salvar-meta">Salvar</button>':''}</td>
      </tr>`;
    }).join('')}</tbody>`;


  if(!podeEditarMetas) return;


  // Recalcula "Valor da meta" na tela em tempo real conforme digita
  // qualquer um dos dois campos — sem precisar salvar pra ver o resultado.
  function religarRecalculo(linha){
    const inputTurnos = linha.querySelector('.input-turnos-utilizados');
    const inputVr = linha.querySelector('.input-vr-minimo');
    const recalcular = () => {
      const valorMeta = (Number(inputTurnos.value)||0) * (Number(inputVr.value)||0);
      linha.querySelector('.valor-meta-calculado').textContent = formatarMoeda(valorMeta);
    };
    inputTurnos.addEventListener('input', recalcular);
    inputVr.addEventListener('input', recalcular);
  }
  tabela.querySelectorAll('tbody tr').forEach(religarRecalculo);

  tabela.querySelectorAll('.botao-salvar-meta').forEach(botao=>{
    botao.addEventListener('click', async (ev)=>{
      const linha = ev.target.closest('tr');
      await api('salvarMeta', {
        prof: linha.dataset.prof, mes, ano,
        turnos_utilizados: linha.querySelector('.input-turnos-utilizados').value,
        valor_minimo_turno: linha.querySelector('.input-vr-minimo').value
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
