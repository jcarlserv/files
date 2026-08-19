/* =====================================================================
   ProdClin — lancamento.js
   Aba Lançamento: travas condicionadas do formulário (Atendente/Profissional/Andar/
   Procedimento/Exame), montagem e envio do formulário, e a tabela 'Meus últimos lançamentos'.
   Este arquivo é carregado via <script src> em index.html, na mesma ordem
   em que aparecia originalmente dentro do <script> único — variáveis e
   funções continuam compartilhando o escopo global, exatamente como antes.
===================================================================== */

/* ---------------------------------------------------------------------
   PAINEL: LANÇAMENTO
--------------------------------------------------------------------- */
/* ---------------------------------------------------------------------
   TRAVAS CONDICIONADAS DO FORMULÁRIO — reaproveitada entre a tela de
   Lançamento (prefixo 'campo_') e o modal de edição (prefixo 'modal_').
   Encadeia duas travas:

   1) Atendente × Profissional (bidirecional, muda de direção conforme o
      contexto):
      - Se o Atendente já está TRAVADO no próprio nome (só acontece no
        Lançamento, quando quem está logado é um atendente — ver
        montarFormularioLancamento), o campo Profissional passa a mostrar
        só quem está vinculado àquele atendente
        (estado.atendentesProfissionais).
      - Caso contrário (gerente no Lançamento, ou QUALQUER edição pelo
        Modal — o Atendente nunca é travado lá), é o Profissional
        escolhido que filtra o Atendente (estado.profissionaisAtendentes).

   2) Profissional → Andar/Procedimento/Exame (já existia): restringe as
      opções de "Andar", "Procedimento" e "Exame" às cadastradas pro
      profissional já definido no passo 1. Diferente de Andar e
      Procedimento (obrigatórios), Exame não é obrigatório — então essa
      trava só restringe as opções, nunca bloqueia o salvamento se o
      profissional não tiver exame cadastrado.

   Em ambos os casos, se não sobrar nenhuma opção pro profissional/
   atendente/andar/procedimento correspondente, o select fica só com
   "Selecionar..." — suficiente pra bloquear o salvamento, já que esses
   campos são obrigatórios (camposObrigatoriosFaltando pega isso sozinha).

   Um valor já salvo (editando um lançamento antigo) que não bata mais com
   o cadastro atual é mantido como opção extra, marcada "(fora do
   cadastro)" — pra não sumir dado histórico sem querer.
--------------------------------------------------------------------- */
function aplicarTravasCondicionadasDoFormulario(prefixo){
  const restringirSelect = (idCampo, permitidos, todasAsOpcoes, restringir)=>{
    const sel = document.getElementById(idCampo);
    if(!sel) return;
    const valorAtual = sel.value;
    let opcoes = restringir ? permitidos.slice() : todasAsOpcoes.slice();
    const foraDoCadastro = !!restringir && !!valorAtual && !opcoes.includes(valorAtual);
    if(foraDoCadastro) opcoes = [valorAtual, ...opcoes];
    sel.innerHTML = '<option value="">Selecionar...</option>' + opcoes.map(o=>{
      const rotulo = (foraDoCadastro && o===valorAtual) ? `${o} (fora do cadastro)` : o;
      return `<option value="${o}" ${o===valorAtual?'selected':''}>${rotulo}</option>`;
    }).join('');
  };

  const elProf = document.getElementById(prefixo+'prof');

  // 1a) Atendente travado no próprio nome (só no Lançamento, só pra quem
  // está logado como atendente) → filtra o Profissional por ele.
  const atendenteTravado = (prefixo==='campo_' && estado.papel==='atendente');
  if(atendenteTravado && elProf){
    const profissionaisPermitidos = estado.atendentesProfissionais[estado.nomeProfissional] || [];
    restringirSelect(prefixo+'prof', profissionaisPermitidos, estado.listas.profissionais||[], true);
  }

  // 2) Profissional (já filtrado pelo passo 1a, se for o caso) → Andar,
  // Procedimento e Exame.
  const prof = elProf ? elProf.value : '';
  restringirSelect(prefixo+'andar', prof ? (estado.profissionaisAndares[prof]||[]) : [], estado.listas.andares||[], !!prof);
  restringirSelect(prefixo+'procedimento', prof ? (estado.profissionaisProcedimentos[prof]||[]) : [], estado.listas.procedimentos||[], !!prof);
  restringirSelect(prefixo+'exames', prof ? (estado.profissionaisExames[prof]||[]) : [], estado.listas.exames||[], !!prof);

  // 1b) Atendente livre (gerente no Lançamento, ou qualquer edição pelo
  // Modal) → o Profissional escolhido filtra o Atendente.
  if(!atendenteTravado){
    const atendentesPermitidos = prof ? (estado.profissionaisAtendentes[prof]||[]) : [];
    restringirSelect(prefixo+'atendente', atendentesPermitidos, estado.listas.atendentes||[], !!prof);
  }
}


function montarFormularioLancamento(){
  const grade = document.getElementById('grade-lancamento');
  grade.innerHTML = definicaoCampos().map(c=>renderizarCampo(c, '', 'campo_')).join('') + htmlSecaoFormaPagamento('campo_');
  if(estado.papel==='profissional'){
    const selProf = document.getElementById('campo_prof');
    selProf.innerHTML = `<option value="${estado.nomeProfissional}" selected>${estado.nomeProfissional}</option>`;
  }
  // Atendente: trava com o nome do próprio usuário logado, só nesta tela
  // (Lançamento) — no modal de edição (Verificar/Crítica) continua livre
  // pra escolher qualquer atendente, como já era antes.
  if(estado.papel==='atendente'){
    const selAtendente = document.getElementById('campo_atendente');
    if(selAtendente){
      selAtendente.innerHTML = `<option value="${estado.nomeProfissional}" selected>${estado.nomeProfissional}</option>`;
      selAtendente.disabled = true;
    }
  }
  const hoje = new Date().toISOString().slice(0,10);
  const campoData = document.getElementById('campo_data');
  if(campoData) campoData.value = hoje;
  // Atendente: não pode escolher outra data na tela de Lançamento — o campo
  // fica travado no dia de hoje (o valor continua acessível via JS mesmo
  // desabilitado, então não atrapalha o salvamento).
  if(estado.papel==='atendente' && campoData){
    campoData.disabled = true;
  }


  montarSecaoPagamento('campo_', null);
  document.getElementById('campo_botao-add-pagamento').addEventListener('click', ()=>adicionarLinhaPagamento('campo_'));


  // Trava de Andar/Procedimento/Exame conforme o Profissional escolhido
  // (ver aplicarTravasCondicionadasDoFormulario). Aplica já na montagem
  // (cobre o caso de papel==='profissional', que já vem com o Profissional
  // fixo) e de novo toda vez que o Profissional mudar.
  aplicarTravasCondicionadasDoFormulario('campo_');
  const selProfLancamento = document.getElementById('campo_prof');
  if(selProfLancamento){
    selProfLancamento.addEventListener('change', ()=>aplicarTravasCondicionadasDoFormulario('campo_'));
  }
}


document.getElementById('form-lancamento').addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  const confirmacao = document.getElementById('confirmacao-lancamento');
  const faltando = camposObrigatoriosFaltando('campo_');
  if(faltando.length){
    confirmacao.style.color = 'var(--danger)';
    confirmacao.textContent = 'Preencha os campos obrigatórios: ' + faltando.join(', ') + '.';
    return;
  }
  const registro = lerValoresCampos('campo_');
  const resp = await api('adicionarProducao', registro);
  if(resp.ok){
    confirmacao.style.color = 'var(--teal-700)';
    confirmacao.textContent = 'Atendimento salvo com sucesso.';
    document.getElementById('form-lancamento').reset();
    montarFormularioLancamento();
    await atualizarMeusLancamentos();
    setTimeout(()=>confirmacao.textContent='', 3500);
  } else {
    confirmacao.style.color = 'var(--danger)';
    confirmacao.textContent = resp.erro || 'Não foi possível salvar.';
  }
});


async function atualizarMeusLancamentos(){
  const filtro = estado.papel==='profissional' ? {prof: estado.nomeProfissional} : {};
  const resp = await api('listarProducao', Object.assign({}, filtro, {limite:15}));
  // resp.registros já vem ordenado do mais recente para o mais antigo (ver supabaseApi/mockApi) —
  // então pegamos os 15 primeiros direto, sem precisar de slice(-15)/reverse().
  const registros = (resp.registros||[]).slice(0, 15);
  const tabela = document.getElementById('tabela-meus-lancamentos');
  if(registros.length===0){ tabela.innerHTML = '<tr><td class="vazio">Nenhum lançamento ainda.</td></tr>'; return; }
  tabela.innerHTML = `
    <thead><tr><th>Data</th><th>Paciente</th><th>Procedimento</th><th>Exame</th><th>Convênio</th><th>Valor</th></tr></thead>
    <tbody>${registros.map(r=>`
      <tr>
        <td>${formatarDataExibicao(r.data)}</td>
        <td>${r.paciente||''}</td>
        <td>${r.procedimento||''}</td>
        <td>${r.exames||'—'}</td>
        <td>${r.convenio? `<span class="tag">${r.convenio}</span>` : '—'}</td>
        <td class="mono">${formatarMoeda(r.valor)}</td>
      </tr>`).join('')}</tbody>`;
}


function formatarDataExibicao(iso){
  if(!iso) return '—';
  const [ano,mes,dia] = String(iso).slice(0,10).split('-');
  return dia && mes ? `${dia}/${mes}` : iso;
}


/* Quebra um registro de produção em "partes" de pagamento: se tiver
   formas_pagamento (pagamento dividido em mais de uma forma), devolve o
   array salvo; senão devolve uma única parte com forma_pagamento + valor
   (formato antigo / pagamento simples). Usado em qualquer lugar que precise
   somar/filtrar valores por forma de pagamento com precisão. */
function partesPagamentoDe(registro){
  if(registro && registro.formas_pagamento && registro.formas_pagamento.length){
    return registro.formas_pagamento;
  }
  return [{ forma: registro ? registro.forma_pagamento : '', valor: registro ? registro.valor : 0 }];
}


