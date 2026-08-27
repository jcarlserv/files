/* =====================================================================
   ProdClin — modal.js
   Modal de edição/criação de lançamento, compartilhado pelas abas Verificar e Crítica.
   Este arquivo é carregado via <script src> em index.html, na mesma ordem
   em que aparecia originalmente dentro do <script> único — variáveis e
   funções continuam compartilhando o escopo global, exatamente como antes.
===================================================================== */



/* ---------------------------------------------------------------------
   MODAL DE EDIÇÃO / CRIAÇÃO
--------------------------------------------------------------------- */
function abrirModal(registro, camposPendentes, contexto){
  estado.editandoId = registro ? registro.id : null;
  estado.editandoMes = registro ? registro.mes : null;
  estado.editandoAno = registro ? registro.ano : null;
  estado.editandoContexto = contexto || 'verificar';
  document.getElementById('titulo-modal').textContent = registro ? 'Editar registro' : 'Novo registro';
  const pendentes = camposPendentes||[];
  const destacarPagamento = pendentes.includes('valor') || pendentes.includes('forma_pagamento');
  document.getElementById('grade-modal').innerHTML = definicaoCampos()
    .map(c=>renderizarCampo(
      c.chave==='paciente' && registro ? Object.assign({}, c, {idAtual: registro.paciente_id}) : c,
      registro? registro[c.chave] : '', 'modal_', pendentes.includes(c.chave)))
    .join('') + htmlSecaoFormaPagamento('modal_', destacarPagamento);
  ligarAutocompletePaciente('modal_');
  ligarBotaoNovoPacienteRapido('modal_');


  // Pré-preenche a seção de pagamento: se o registro tem formas_pagamento
  // (pagamento dividido), usa o detalhamento; senão monta uma linha única a
  // partir de forma_pagamento + valor (formato antigo, ou pagamento simples).
  const formasIniciais = registro
    ? ((registro.formas_pagamento && registro.formas_pagamento.length)
        ? registro.formas_pagamento
        : (registro.forma_pagamento ? [{forma:registro.forma_pagamento, valor:registro.valor}] : null))
    : null;
  montarSecaoPagamento('modal_', formasIniciais);
  document.getElementById('modal_botao-add-pagamento').addEventListener('click', ()=>adicionarLinhaPagamento('modal_'));


  // Mesma trava de Andar/Procedimento/Exame por Profissional da tela de
  // Lançamento — aqui também vale, por decisão explícita do usuário (a
  // trava de Atendente/Data, por comparação, só vale no Lançamento; esta
  // é diferente e vale nos dois lugares).
  aplicarTravasCondicionadasDoFormulario('modal_');
  const selProfModal = document.getElementById('modal_prof');
  if(selProfModal){
    selProfModal.addEventListener('change', ()=>aplicarTravasCondicionadasDoFormulario('modal_'));
  }


  // Excluir depende da permissão do contexto de onde o modal foi aberto:
  // excluir_verificar (aba Verificar) ou excluir_critica (aba Crítica).
  const chaveExcluir = estado.editandoContexto === 'critica' ? 'excluir_critica' : 'excluir_verificar';
  document.getElementById('botao-excluir-modal').style.display = (registro && temPermissao(chaveExcluir)) ? 'inline-flex' : 'none';
  document.getElementById('sobreposicao-modal').classList.add('aberta');
}
function fecharModal(){
  document.getElementById('sobreposicao-modal').classList.remove('aberta');
}
document.getElementById('botao-cancelar-modal').addEventListener('click', fecharModal);
document.getElementById('sobreposicao-modal').addEventListener('click', (ev)=>{ if(ev.target.id==='sobreposicao-modal') fecharModal(); });


document.getElementById('form-modal').addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  const faltando = camposObrigatoriosFaltando('modal_');
  if(faltando.length){
    alert('Preencha os campos obrigatórios antes de salvar: ' + faltando.join(', ') + '.');
    return;
  }
  const registro = lerValoresCampos('modal_');
  await resolverVinculosPacienteProfissional(registro);
  const botaoSalvar = ev.target.querySelector('button[type="submit"]');
  const rotuloOriginal = botaoSalvar.textContent;
  botaoSalvar.disabled = true;
  botaoSalvar.textContent = 'Salvando...';


  let resp;
  if(estado.editandoId){
    // mesOriginal/anoOriginal dizem em qual aba mensal (Producao_AAAA_MM) o
    // registro está guardado hoje — se a data mudar de mês, o backend move
    // a linha para a aba certa sozinho.
    resp = await api('atualizarProducao', {id:estado.editandoId, registro, mesOriginal:estado.editandoMes, anoOriginal:estado.editandoAno});
  } else {
    resp = await api('adicionarProducao', registro);
  }


  botaoSalvar.disabled = false;
  botaoSalvar.textContent = rotuloOriginal;


  if(!resp || !resp.ok){
    alert('Não foi possível salvar: ' + ((resp && resp.erro) || 'erro desconhecido. Tente novamente.'));
    return; // mantém o modal aberto, com os dados digitados, para tentar de novo
  }


  fecharModal();
  await atualizarPainelAtivo();
});


document.getElementById('botao-excluir-modal').addEventListener('click', async ()=>{
  if(!estado.editandoId) return;
  const chaveExcluir = estado.editandoContexto === 'critica' ? 'excluir_critica' : 'excluir_verificar';
  if(!temPermissao(chaveExcluir)){ alert('Você não tem permissão para excluir registros aqui.'); return; }
  if(!confirm('Excluir este registro definitivamente?')) return;
  const resp = await api('excluirProducao', {id: estado.editandoId, mes: estado.editandoMes, ano: estado.editandoAno});
  if(!resp || !resp.ok){
    alert('Não foi possível excluir: ' + ((resp && resp.erro) || 'erro desconhecido. Tente novamente.'));
    return;
  }
  fecharModal();
  await atualizarPainelAtivo();
});


