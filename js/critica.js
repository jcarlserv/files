/* =====================================================================
   ProdClin — critica.js
   Aba Crítica: ranking de pendências por atendente e a tabela de lançamentos com campos
   obrigatórios em branco.
   Este arquivo é carregado via <script src> em index.html, na mesma ordem
   em que aparecia originalmente dentro do <script> único — variáveis e
   funções continuam compartilhando o escopo global, exatamente como antes.
===================================================================== */

/* ---------------------------------------------------------------------
   PAINEL: CRÍTICA (lançamentos com campos obrigatórios em branco)
--------------------------------------------------------------------- */
/* Conta pacientes DISTINTOS com pendência por atendente — não o total de registros
   (o mesmo paciente com dois lançamentos pendentes pela mesma atendente conta como 1,
   não 2). Se o próprio nome do paciente estiver em branco (também pode ser uma
   pendência), cada registro assim é tratado como um paciente distinto, para não
   subestimar o total por falta de nome pra agrupar. */
function renderizarRankingAtendentesCritica(incompletos){
  const porAtendente = {};
  incompletos.forEach(r=>{
    const atendente = String(r.atendente||'').trim() || 'Não informado';
    if(!porAtendente[atendente]) porAtendente[atendente] = new Set();
    const nomePaciente = String(r.paciente||'').trim().toUpperCase();
    const chavePaciente = nomePaciente || ('__sem_nome__'+(r.id || Math.random()));
    porAtendente[atendente].add(chavePaciente);
  });


  const ranking = Object.keys(porAtendente)
    .map(atendente => ({atendente, qtd: porAtendente[atendente].size}))
    .sort((a,b) => b.qtd - a.qtd);


  const tabela = document.getElementById('tabela-ranking-atendentes-critica');
  const grafico = document.getElementById('grafico-ranking-atendentes-critica');
  if(ranking.length===0){
    tabela.innerHTML = '<tr><td class="vazio">Nenhuma pendência no período. 🎉</td></tr>';
    grafico.innerHTML = '';
    return;
  }
  miniGraficoBarras('grafico-ranking-atendentes-critica', ranking.map(r=>r.atendente), ranking.map(r=>r.qtd), '#9C6E22');
  tabela.innerHTML = `
    <thead><tr><th>#</th><th>Atendente</th><th>Pacientes com pendência</th></tr></thead>
    <tbody>${ranking.map((r,i)=>`
      <tr>
        <td>${i+1}</td>
        <td>${r.atendente}</td>
        <td class="mono">${r.qtd}</td>
      </tr>`).join('')}</tbody>`;
}


async function atualizarCritica(){
  const mes = document.getElementById('filtro-mes-critica').value;
  const ano = document.getElementById('filtro-ano-critica').value;
  const prof = estado.papel==='profissional' ? estado.nomeProfissional : document.getElementById('filtro-prof-critica').value;


  document.getElementById('tabela-critica').innerHTML = '<tr><td class="vazio">Carregando lançamentos...</td></tr>';
  ['kpi-critica-total','kpi-critica-incompletos','kpi-critica-pct'].forEach(id=>document.getElementById(id).textContent='…');


  const { dataInicio, dataFim } = primeiroEUltimoDiaDoMes(mes, ano);
  const resp = await buscarProducaoCompleta({dataInicio, dataFim, prof});
  const registros = resp.registros || [];
  const incompletos = registros.filter(r => CAMPOS_CRITICOS.some(c => campoCriticoVazio(r, c.chave)));


  document.getElementById('kpi-critica-total').textContent = registros.length;
  document.getElementById('kpi-critica-incompletos').textContent = incompletos.length;
  document.getElementById('kpi-critica-pct').textContent = registros.length ? Math.round((incompletos.length/registros.length)*100)+'%' : '—';


  renderizarRankingAtendentesCritica(incompletos);


  const podeEditarCritica = temPermissao('editar_critica');
  const tabela = document.getElementById('tabela-critica');
  if(incompletos.length===0){
    tabela.innerHTML = '<tr><td class="vazio">Nenhum lançamento com campo pendente neste período. 🎉</td></tr>';
    return;
  }
  tabela.innerHTML = `
    <thead><tr><th>Data</th><th>Profissional</th><th>Paciente</th><th>Campos pendentes</th>${podeEditarCritica?'<th></th>':''}</tr></thead>
    <tbody>${incompletos.map((r,i)=>{
      const faltando = CAMPOS_CRITICOS.filter(c=>campoCriticoVazio(r,c.chave));
      return `<tr>
        <td>${formatarDataExibicao(r.data)}</td>
        <td>${r.prof||'—'}</td>
        <td>${r.paciente||'—'}</td>
        <td>${faltando.map(c=>`<span class="tag tag-alerta">${c.rotulo}</span>`).join('')}</td>
        ${podeEditarCritica?`<td class="celula-acoes"><button class="botao secundario pequeno" data-indice="${i}">Completar</button></td>`:''}
      </tr>`;
    }).join('')}</tbody>`;


  if(!podeEditarCritica) return;


  // Usa a posição na lista (não o id) para achar o registro certo — assim
  // funciona mesmo se algum registro antigo tiver o id vazio ou repetido.
  tabela.querySelectorAll('button[data-indice]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const registro = incompletos[Number(b.dataset.indice)];
      if(!registro.id){
        alert('Este registro não tem um identificador único (provavelmente um dado bem antigo, de antes da migração para o Supabase). Abra a tabela "producao" no Table Editor do Supabase e defina um id para essa linha (ex.: gen_random_uuid()) antes de completá-la por aqui.');
        return;
      }
      const faltando = CAMPOS_CRITICOS.filter(c=>campoCriticoVazio(registro,c.chave)).map(c=>c.chave);
      abrirModal(registro, faltando, 'critica');
    });
  });
}


