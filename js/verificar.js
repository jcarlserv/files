/* =====================================================================
   ProdClin — verificar.js
   Aba Verificar: cálculo e salvamento do Repasse de coparticipados, multi-seletor de
   convênio e a montagem da tabela/filtros de 'Lançamentos do período'.
   Este arquivo é carregado via <script src> em index.html, na mesma ordem
   em que aparecia originalmente dentro do <script> único — variáveis e
   funções continuam compartilhando o escopo global, exatamente como antes.
===================================================================== */

/* ---------------------------------------------------------------------
   REPASSE DE COPARTICIPADOS — cálculo (18% de taxa, depois rateio 40/60)
   sobre TODOS os lançamentos filtrados na aba Verificar (todos os filtros
   já aplicados: período, profissional, andar, convênio, forma de
   pagamento). A configuração (%) é a mesma para todo mundo e é salva por
   mês na tabela `coparticipados` — o "mês de referência" é derivado da
   data de início do filtro, já que essa aba não tem um seletor de mês/ano
   próprio.
--------------------------------------------------------------------- */
function mesAnoReferenciaVerificar(){
  const dataInicioStr = document.getElementById('filtro-data-inicio').value;
  const base = dataInicioStr ? new Date(dataInicioStr+'T00:00:00') : new Date();
  return { mes: MESES[base.getMonth()], ano: base.getFullYear() };
}


async function obterConfigRepasseCoparticipados(mes, ano){
  const chaveCache = mes+'-'+ano;
  if(repasseCoparticipadosCache[chaveCache]) return repasseCoparticipadosCache[chaveCache];
  const resp = await api('obterConfigCoparticipados', {mes, ano});
  const config = (resp.ok && resp.config) ? resp.config : Object.assign({}, REPASSE_COPARTICIPADOS_PADRAO);
  repasseCoparticipadosCache[chaveCache] = config;
  return config;
}


function calcularRepasseCoparticipados(registros, config){
  const valorBruto = registros.reduce((s,r)=>s+(Number(r.valor)||0), 0);
  const desconto = valorBruto * (Number(config.taxa)||0)/100;
  const valorLiquido = valorBruto - desconto;
  const repasseClinica = valorLiquido * (Number(config.rateio_clinica)||0)/100;
  const repasseCoparticipado = valorLiquido * (Number(config.rateio_coparticipado)||0)/100;
  return { valorBruto, desconto, valorLiquido, repasseClinica, repasseCoparticipado };
}


async function atualizarBlocoRepasseCoparticipados(registrosFiltrados){
  const cartao = document.getElementById('cartao-repasse-coparticipados');
  if(!cartao) return;
  const podeVer = temPermissao('ver_financeiro_verificar');
  cartao.style.display = podeVer ? '' : 'none';
  if(!podeVer) return;


  const { mes, ano } = mesAnoReferenciaVerificar();
  document.getElementById('repasse-mes-referencia').textContent = `${mes} de ${ano}`;
  const config = await obterConfigRepasseCoparticipados(mes, ano);


  document.getElementById('repasse-input-taxa').value = config.taxa;
  document.getElementById('repasse-input-rateio-clinica').value = config.rateio_clinica;
  document.getElementById('repasse-input-rateio-coparticipado').value = config.rateio_coparticipado;


  const podeEditar = temPermissao('editar_verificar');
  ['repasse-input-taxa','repasse-input-rateio-clinica','repasse-input-rateio-coparticipado'].forEach(id=>{
    document.getElementById(id).disabled = !podeEditar;
  });
  document.getElementById('botao-salvar-repasse').style.display = podeEditar ? 'inline-flex' : 'none';


  const resultado = calcularRepasseCoparticipados(registrosFiltrados, config);
  document.getElementById('repasse-valor-bruto').textContent = formatarMoeda(resultado.valorBruto);
  document.getElementById('repasse-valor-desconto').textContent = formatarMoeda(resultado.desconto);
  document.getElementById('repasse-valor-liquido').textContent = formatarMoeda(resultado.valorLiquido);
  document.getElementById('repasse-valor-clinica').textContent = formatarMoeda(resultado.repasseClinica);
  document.getElementById('repasse-valor-coparticipado').textContent = formatarMoeda(resultado.repasseCoparticipado);
}


async function salvarConfigRepasseCoparticipados(){
  if(!temPermissao('editar_verificar')){ alert('Você não tem permissão para editar essa configuração.'); return; }
  const { mes, ano } = mesAnoReferenciaVerificar();
  const taxa = Number(document.getElementById('repasse-input-taxa').value) || 0;
  const rateioClinica = Number(document.getElementById('repasse-input-rateio-clinica').value) || 0;
  const rateioCoparticipado = Number(document.getElementById('repasse-input-rateio-coparticipado').value) || 0;
  const confirmacao = document.getElementById('confirmacao-repasse');


  confirmacao.style.color = 'var(--ink-400)';
  confirmacao.textContent = 'Salvando...';
  const resp = await api('salvarConfigCoparticipados', {
    mes, ano, taxa, rateio_clinica: rateioClinica, rateio_coparticipado: rateioCoparticipado
  });
  if(!resp.ok){
    confirmacao.style.color = 'var(--danger)';
    confirmacao.textContent = resp.erro || 'Não foi possível salvar essa configuração.';
    return;
  }


  repasseCoparticipadosCache[mes+'-'+ano] = { taxa, rateio_clinica: rateioClinica, rateio_coparticipado: rateioCoparticipado };
  confirmacao.style.color = 'var(--teal-700)';
  confirmacao.textContent = 'Configuração salva ✓';
  await atualizarEditar(); // recalcula os KPIs de repasse já com a config nova
  setTimeout(()=>{ if(confirmacao.textContent==='Configuração salva ✓') confirmacao.textContent=''; }, 2500);
}


/* ---------------------------------------------------------------------
   PAINEL: EDITAR (lançamentos do período)
--------------------------------------------------------------------- */
/* ---------------------------------------------------------------------
   MULTI-SELETOR DE CONVÊNIO — clicar em vários convênios ao mesmo tempo
--------------------------------------------------------------------- */
function montarMultiselectConvenio(){
  const botao = document.getElementById('botao-filtro-convenio');
  const painel = document.getElementById('painel-filtro-convenio');
  const convenios = estado.listas.convenios||[];


  painel.innerHTML = `
    <div class="acoes-multiselect">
      <button type="button" id="ms-convenio-marcar-todos">Marcar todos</button>
      <button type="button" id="ms-convenio-limpar">Limpar</button>
    </div>
    ${convenios.map((c,i)=>`
      <label class="item-multiselect">
        <input type="checkbox" value="${c}" id="ms-convenio-${i}"> ${c}
      </label>`).join('')}
  `;


  function atualizarRotuloBotao(){
    const n = estado.conveniosSelecionados.length;
    botao.textContent = n===0 ? 'Todos' : (n===1 ? estado.conveniosSelecionados[0] : `${n} selecionados`);
  }
  atualizarRotuloBotao();


  painel.querySelectorAll('input[type="checkbox"]').forEach(chk=>{
    chk.checked = estado.conveniosSelecionados.includes(chk.value);
    chk.addEventListener('change', ()=>{
      if(chk.checked) estado.conveniosSelecionados.push(chk.value);
      else estado.conveniosSelecionados = estado.conveniosSelecionados.filter(v=>v!==chk.value);
      atualizarRotuloBotao();
      atualizarEditar();
    });
  });


  document.getElementById('ms-convenio-marcar-todos').addEventListener('click', ()=>{
    estado.conveniosSelecionados = convenios.slice();
    painel.querySelectorAll('input[type="checkbox"]').forEach(chk=>chk.checked=true);
    atualizarRotuloBotao();
    atualizarEditar();
  });
  document.getElementById('ms-convenio-limpar').addEventListener('click', ()=>{
    estado.conveniosSelecionados = [];
    painel.querySelectorAll('input[type="checkbox"]').forEach(chk=>chk.checked=false);
    atualizarRotuloBotao();
    atualizarEditar();
  });


  botao.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    painel.classList.toggle('aberto');
    botao.classList.toggle('ativo', painel.classList.contains('aberto'));
  });
  document.addEventListener('click', (ev)=>{
    if(!painel.contains(ev.target) && ev.target!==botao){
      painel.classList.remove('aberto');
      botao.classList.remove('ativo');
    }
  });
}


/* ---------------------------------------------------------------------
   PAINEL: EDITAR (lançamentos do período)
--------------------------------------------------------------------- */
async function atualizarEditar(){
  const prof = document.getElementById('filtro-prof-gerencial').value;
  const andar = document.getElementById('filtro-andar-gerencial').value;
  const formaPagamento = document.getElementById('filtro-forma-pagamento-gerencial').value;
  const exame = document.getElementById('filtro-exame-gerencial').value;
  const procedimento = document.getElementById('filtro-procedimento-gerencial').value;
  const paciente = document.getElementById('filtro-paciente-gerencial').value.trim().toUpperCase();
  const dataInicio = document.getElementById('filtro-data-inicio').value;
  const dataFim = document.getElementById('filtro-data-fim').value;


  document.getElementById('tabela-gerencial').innerHTML = '<tr><td class="vazio">Carregando lançamentos...</td></tr>';
  document.getElementById('resumo-financeiro-editar').innerHTML = '';


  const resp = await buscarProducaoCompleta({prof, dataInicio, dataFim});
  let registros = resp.registros||[];
  if(andar){
    registros = registros.filter(r => String(r.andar||'').trim().toUpperCase() === andar.trim().toUpperCase());
  }
  if(estado.conveniosSelecionados.length){
    const selecionadosUpper = estado.conveniosSelecionados.map(c=>c.trim().toUpperCase());
    registros = registros.filter(r => selecionadosUpper.includes(String(r.convenio||'').trim().toUpperCase()));
  }
  if(exame){
    registros = registros.filter(r => String(r.exames||'').trim().toUpperCase() === exame.trim().toUpperCase());
  }
  if(procedimento){
    registros = registros.filter(r => String(r.procedimento||'').trim().toUpperCase() === procedimento.trim().toUpperCase());
  }
  if(paciente){
    registros = registros.filter(r => String(r.paciente||'').trim().toUpperCase().includes(paciente));
  }
  // Se o registro tem pagamento dividido (formas_pagamento preenchido),
  // considera cada parte separadamente; senão trata como uma única "parte"
  // usando forma_pagamento + valor (comportamento de sempre).
  if(formaPagamento){
    const alvo = formaPagamento.trim().toUpperCase();
    registros = registros.filter(r => partesPagamentoDe(r).some(p => String(p.forma||'').trim().toUpperCase() === alvo));
  }


  const porFormaPagamento = { 'CONVÊNIO':0, 'PIX':0, 'ESPÉCIE':0, 'CARTÃO':0 };
  let totalGeral = 0;
  registros.forEach(r=>{
    partesPagamentoDe(r).forEach(p=>{
      const forma = String(p.forma||'').trim().toUpperCase();
      const valor = Number(p.valor)||0;
      if(porFormaPagamento.hasOwnProperty(forma)) porFormaPagamento[forma] += valor;
      totalGeral += valor;
    });
  });
  const podeVerFinanceiro = temPermissao('ver_financeiro_verificar');
  const cartaoResumoFinanceiro = document.getElementById('cartao-resumo-financeiro-editar');
  const cartaoPorConvenio = document.getElementById('cartao-resumo-por-convenio');
  // Quantidade de pacientes — DISTINTOS (um paciente pode ter mais de um
  // lançamento no período), respeitando todos os filtros já aplicados.
  // Único cartão da fileira em cinza claro, pra se diferenciar dos
  // valores financeiros (que ficam em teal/verde).
  const pacientesDistintos = new Set(
    registros.map(r => String(r.paciente||'').trim().toUpperCase()).filter(Boolean)
  ).size;
  const cardPacientes = `<div class="kpi"><div class="rotulo">Quantidade de pacientes</div><div class="valor" id="resumo-fp-pacientes" style="color:var(--ink-400);">${pacientesDistintos}</div></div>`;
  if(!podeVerFinanceiro){
    if(cartaoResumoFinanceiro) cartaoResumoFinanceiro.style.display = '';
    if(cartaoPorConvenio) cartaoPorConvenio.style.display = 'none';
    document.getElementById('resumo-financeiro-editar').innerHTML = cardPacientes;
  } else {
    if(cartaoResumoFinanceiro) cartaoResumoFinanceiro.style.display = '';
    if(cartaoPorConvenio) cartaoPorConvenio.style.display = '';
    const rotuloConvenios = estado.conveniosSelecionados.length===1 ? ` (${estado.conveniosSelecionados[0]})`
      : estado.conveniosSelecionados.length>1 ? ` (${estado.conveniosSelecionados.length} convênios)` : '';
    document.getElementById('resumo-financeiro-editar').innerHTML = cardPacientes + `
      <div class="kpi"><div class="rotulo">Convênio${rotuloConvenios}</div><div class="valor" id="resumo-fp-convenio">${formatarMoeda(porFormaPagamento['CONVÊNIO'])}</div></div>
      <div class="kpi"><div class="rotulo">Pix</div><div class="valor" id="resumo-fp-pix">${formatarMoeda(porFormaPagamento['PIX'])}</div></div>
      <div class="kpi"><div class="rotulo">Espécie</div><div class="valor" id="resumo-fp-especie">${formatarMoeda(porFormaPagamento['ESPÉCIE'])}</div></div>
      <div class="kpi"><div class="rotulo">Cartão</div><div class="valor" id="resumo-fp-cartao">${formatarMoeda(porFormaPagamento['CARTÃO'])}</div></div>
      <div class="kpi"><div class="rotulo">Total${estado.conveniosSelecionados.length?' filtrado':''}</div><div class="valor teal" id="resumo-fp-total">${formatarMoeda(totalGeral)}</div></div>
    `;

    // Por convênio — um card por convênio (PARTICULAR, UNIMED, etc.), com
    // valor em R$ na linha de cima e quantidade de atendimentos embaixo,
    // dentro do MESMO card. Só entra convênio que apareceu no período
    // filtrado (não lista todo o cadastro, só o que tem dado de verdade).
    const porConvenioReal = {};
    registros.forEach(r=>{
      const conv = r.convenio || 'PARTICULAR';
      if(!porConvenioReal[conv]) porConvenioReal[conv] = {valor:0, quantidade:0};
      porConvenioReal[conv].valor += Number(r.valor)||0;
      porConvenioReal[conv].quantidade += 1;
    });
    const chavesConvenio = Object.keys(porConvenioReal).sort((a,b)=>porConvenioReal[b].valor-porConvenioReal[a].valor);
    document.getElementById('resumo-por-convenio-editar').innerHTML = chavesConvenio.length ? chavesConvenio.map(c=>`
      <div class="kpi">
        <div class="rotulo">${c}</div>
        <div class="valor">${formatarMoeda(porConvenioReal[c].valor)}</div>
        <div class="valor-secundario">${porConvenioReal[c].quantidade} atendimento${porConvenioReal[c].quantidade===1?'':'s'}</div>
      </div>`).join('') : '<p class="vazio">Nenhum lançamento no período.</p>';
  }


  await atualizarBlocoRepasseCoparticipados(registros);


  const podeEditar = temPermissao('editar_verificar');
  const tabela = document.getElementById('tabela-gerencial');
  if(registros.length===0){
    tabela.innerHTML = '<tr><td class="vazio">Nenhum lançamento neste período.</td></tr>';
  } else {
    tabela.innerHTML = `
      <thead><tr><th>Data</th><th>Profissional</th><th>Andar</th><th>Paciente</th><th>Atendimento</th><th>Exame</th><th>Convênio</th><th>Carteirinha</th><th>Forma pgto.</th><th>Valor</th><th>Atendente</th>${podeEditar?'<th></th>':''}</tr></thead>
      <tbody>${registros.map((r,i)=>`
        <tr>
          <td>${formatarDataExibicao(r.data)}</td>
          <td>${r.prof||''}</td>
          <td>${r.andar? `<span class="tag">${r.andar}</span>` : '—'}</td>
          <td>${r.paciente||''}</td>
          <td>${r.procedimento||''}</td>
          <td>${r.exames||'—'}</td>
          <td>${r.convenio||'—'}</td>
          <td class="mono">${r.carteirinha||'—'}</td>
          <td>${r.forma_pagamento||'—'}</td>
          <td class="mono">${formatarMoeda(r.valor)}</td>
          <td>${r.atendente||''}</td>
          ${podeEditar?`<td class="celula-acoes"><button class="botao sutil pequeno" data-indice="${i}">Editar</button></td>`:''}
        </tr>`).join('')}</tbody>`;
    // Usa a posição na lista (não o id) para achar o registro certo — assim
    // funciona mesmo se algum registro antigo tiver o id vazio ou repetido.
    // Sem a permissão editar_verificar: nem o botão nem os listeners existem.
    if(podeEditar){
      tabela.querySelectorAll('button[data-indice]').forEach(b=>{
        b.addEventListener('click', ()=>{
          const registro = registros[Number(b.dataset.indice)];
          if(!registro.id){
            alert('Este registro não tem um identificador único (provavelmente um dado bem antigo, de antes da migração para o Supabase). Abra a tabela "producao" no Table Editor do Supabase e defina um id para essa linha (ex.: gen_random_uuid()) antes de editá-la por aqui.');
            return;
          }
          abrirModal(registro, [], 'verificar');
        });
      });
    }
  }
}


