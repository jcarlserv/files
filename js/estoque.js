/* =====================================================================
   ABA ESTOQUE — materiais médico-hospitalares (MMH). 5 sub-abas:
   Materiais (catálogo + fornecedores) | Entrada (NF, cria lote) |
   Solicitar (profissional pede, vinculado a Atendimento/Exame = centro
   de custo) | Dispensar (farmácia/gerente aprova, baixa FEFO — consome
   primeiro o lote que vence antes) | Relatório (posição + vencimentos).

   Solicitação tem 2 estados só: pendente → dispensado/negado. Quem
   dispensa já aprova E baixa o estoque no mesmo clique (não tem um
   "aprovado mas ainda não saiu" solto no meio — decisão tomada com o
   usuário quando desenhamos o módulo).
===================================================================== */

let estoqueCacheMateriais = [];
let estoqueCacheFornecedores = [];
let estoqueSubAbaPronta = {};

async function atualizarEstoque(){
  await Promise.all([carregarMateriaisEstoque(), carregarFornecedoresEstoque()]);
  prepararSubNavEstoque();
  await atualizarSubAbaEstoqueAtiva();
}

function prepararSubNavEstoque(){
  const podeSolicitar = temPermissao('solicitar_estoque');
  const podeDispensar = temPermissao('dispensar_estoque');
  const podeEditar = temPermissao('editar_estoque');
  const visibilidade = {
    'estoque-materiais': podeEditar,
    'estoque-entrada': podeEditar,
    'estoque-solicitar': podeSolicitar,
    'estoque-dispensar': podeDispensar,
    'estoque-dispensados': podeSolicitar || podeDispensar,
    'estoque-relatorio': podeEditar || podeDispensar
  };
  const rotulos = {'estoque-materiais':'Cadastro','estoque-entrada':'Entrada (NF)','estoque-solicitar':'Solicitar','estoque-dispensar':'Dispensar','estoque-dispensados':'Dispensados','estoque-relatorio':'Relatório'};
  const disponiveis = Object.keys(visibilidade).filter(id=>visibilidade[id]);
  const nav = document.getElementById('sub-nav-estoque');
  if(!disponiveis.includes(estado.subAbaEstoque)) estado.subAbaEstoque = disponiveis[0] || null;
  nav.innerHTML = disponiveis.map(id=>`<div class="sub-aba${id===estado.subAbaEstoque?' ativa':''}" data-sub="${id}">${rotulos[id]}</div>`).join('');
  nav.querySelectorAll('.sub-aba').forEach(el=>{
    el.addEventListener('click', ()=> trocarSubAbaEstoque(el.dataset.sub));
  });
  Object.keys(visibilidade).forEach(id=>{
    document.getElementById(id).classList.toggle('ativa', id===estado.subAbaEstoque);
  });
}

function trocarSubAbaEstoque(subId){
  estado.subAbaEstoque = subId;
  document.querySelectorAll('#sub-nav-estoque .sub-aba').forEach(el=>el.classList.toggle('ativa', el.dataset.sub===subId));
  ['estoque-materiais','estoque-entrada','estoque-solicitar','estoque-dispensar','estoque-dispensados','estoque-relatorio'].forEach(id=>{
    document.getElementById(id).classList.toggle('ativa', id===subId);
  });
  atualizarSubAbaEstoqueAtiva();
}

async function atualizarSubAbaEstoqueAtiva(){
  if(estado.subAbaEstoque==='estoque-materiais') renderizarCatalogoMateriais();
  if(estado.subAbaEstoque==='estoque-entrada') prepararEntradaEstoque();
  if(estado.subAbaEstoque==='estoque-solicitar') await prepararSolicitarEstoque();
  if(estado.subAbaEstoque==='estoque-dispensados') await prepararDispensados();
  if(estado.subAbaEstoque==='estoque-dispensar') await carregarSolicitacoesPendentes();
  if(estado.subAbaEstoque==='estoque-relatorio') await carregarRelatorioEstoque();
}


/* ---------------------------------------------------------------------
   MATERIAIS + FORNECEDORES — cadastro por modal (igual Cadastro de
   Pacientes), não mais edição solta na linha da tabela nem prompt().
--------------------------------------------------------------------- */
async function carregarMateriaisEstoque(){
  const resp = await api('listarMateriais', {});
  estoqueCacheMateriais = resp.ok ? (resp.materiais||[]) : [];
}
async function carregarFornecedoresEstoque(){
  const resp = await api('listarFornecedores', {});
  estoqueCacheFornecedores = resp.ok ? (resp.fornecedores||[]) : [];
}

function renderizarCatalogoMateriais(){
  const podeEditar = temPermissao('editar_estoque');
  const tabela = document.getElementById('tabela-materiais');
  tabela.innerHTML = `
    <thead><tr><th>Nome</th><th>Categoria</th><th>Unidade</th><th>Estoque mínimo</th><th>Ativo</th><th></th></tr></thead>
    <tbody>${estoqueCacheMateriais.map(m=>`
      <tr data-id="${m.id}">
        <td>${m.nome}</td>
        <td>${m.categoria||'—'}</td>
        <td>${m.unidade||'unidade'}</td>
        <td class="mono">${m.estoque_minimo||0}</td>
        <td>${m.ativo?'<span style="color:var(--teal-700);">Sim</span>':'<span style="color:var(--ink-400);">Não</span>'}</td>
        <td>${podeEditar?`<button class="botao secundario pequeno botao-editar-material" data-id="${m.id}">Editar</button>`:''}</td>
      </tr>`).join('')}</tbody>`;

  const botaoNovo = document.getElementById('botao-novo-material');
  botaoNovo.style.display = podeEditar ? 'inline-flex' : 'none';
  if(podeEditar){
    tabela.querySelectorAll('.botao-editar-material').forEach(botao=>{
      botao.addEventListener('click', ()=>{
        const material = estoqueCacheMateriais.find(m=>m.id===botao.dataset.id);
        if(material) abrirModalMaterial(material);
      });
    });
  }

  if(!estoqueSubAbaPronta.materiais){
    botaoNovo.addEventListener('click', ()=>abrirModalMaterial(null));
    document.getElementById('botao-novo-fornecedor').addEventListener('click', ()=>abrirModalFornecedor(null));
    estoqueSubAbaPronta.materiais = true;
  }
  renderizarFornecedores();
}

function renderizarFornecedores(){
  const podeEditar = temPermissao('editar_estoque');
  const tabela = document.getElementById('tabela-fornecedores');
  document.getElementById('botao-novo-fornecedor').style.display = podeEditar ? 'inline-flex' : 'none';
  tabela.innerHTML = `
    <thead><tr><th>Nome</th><th>CNPJ</th><th>Contato</th><th></th></tr></thead>
    <tbody>${estoqueCacheFornecedores.map(f=>`
      <tr data-id="${f.id}">
        <td>${f.nome}</td>
        <td class="mono">${f.cnpj||'—'}</td>
        <td>${f.contato||'—'}</td>
        <td>${podeEditar?`<button class="botao secundario pequeno botao-editar-fornecedor" data-id="${f.id}">Editar</button>`:''}</td>
      </tr>`).join('')}</tbody>`;
  if(!podeEditar) return;
  tabela.querySelectorAll('.botao-editar-fornecedor').forEach(botao=>{
    botao.addEventListener('click', ()=>{
      const fornecedor = estoqueCacheFornecedores.find(f=>f.id===botao.dataset.id);
      if(fornecedor) abrirModalFornecedor(fornecedor);
    });
  });
}


/* ---------------------------------------------------------------------
   MODAL FORNECEDOR — criar/editar
--------------------------------------------------------------------- */
let fornecedorEmEdicaoId = null;
let modalFornecedorPronto = false;
function prepararModalFornecedor(){
  if(modalFornecedorPronto) return;
  modalFornecedorPronto = true;
  document.getElementById('botao-cancelar-modal-fornecedor').addEventListener('click', fecharModalFornecedor);
  document.getElementById('sobreposicao-modal-fornecedor').addEventListener('click', (ev)=>{
    if(ev.target.id==='sobreposicao-modal-fornecedor') fecharModalFornecedor();
  });
  document.getElementById('form-modal-fornecedor').addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const nome = document.getElementById('modal-fornecedor-nome').value.trim();
    if(!nome){ alert('Preencha o nome do fornecedor.'); return; }
    const botao = ev.target.querySelector('button[type="submit"]');
    const rotuloOriginal = botao.textContent;
    botao.disabled = true; botao.textContent = 'Salvando...';
    const dadosFornecedor = {
      nome, cnpj: document.getElementById('modal-fornecedor-cnpj').value,
      contato: document.getElementById('modal-fornecedor-contato').value
    };
    const resp = fornecedorEmEdicaoId
      ? await api('atualizarFornecedor', Object.assign({id: fornecedorEmEdicaoId}, dadosFornecedor))
      : await api('criarFornecedor', dadosFornecedor);
    botao.disabled = false; botao.textContent = rotuloOriginal;
    if(!resp.ok){ alert(resp.erro || 'Não foi possível salvar.'); return; }
    fecharModalFornecedor();
    await carregarFornecedoresEstoque();
    renderizarFornecedores();
  });
}
function abrirModalFornecedor(fornecedor){
  prepararModalFornecedor();
  fornecedorEmEdicaoId = fornecedor ? fornecedor.id : null;
  document.getElementById('titulo-modal-fornecedor').textContent = fornecedor ? 'Editar fornecedor' : 'Novo fornecedor';
  document.getElementById('modal-fornecedor-nome').value = fornecedor ? fornecedor.nome : '';
  document.getElementById('modal-fornecedor-cnpj').value = fornecedor ? (fornecedor.cnpj||'') : '';
  document.getElementById('modal-fornecedor-contato').value = fornecedor ? (fornecedor.contato||'') : '';
  document.getElementById('sobreposicao-modal-fornecedor').classList.add('aberta');
}
function fecharModalFornecedor(){
  document.getElementById('sobreposicao-modal-fornecedor').classList.remove('aberta');
  fornecedorEmEdicaoId = null;
}


/* ---------------------------------------------------------------------
   MODAL MATERIAL — criar/editar
--------------------------------------------------------------------- */
let materialEmEdicaoId = null;
let modalMaterialPronto = false;
function prepararModalMaterial(){
  if(modalMaterialPronto) return;
  modalMaterialPronto = true;
  document.getElementById('botao-cancelar-modal-material').addEventListener('click', fecharModalMaterial);
  document.getElementById('sobreposicao-modal-material').addEventListener('click', (ev)=>{
    if(ev.target.id==='sobreposicao-modal-material') fecharModalMaterial();
  });
  document.getElementById('form-modal-material').addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const nome = document.getElementById('modal-material-nome').value.trim();
    if(!nome){ alert('Preencha o nome do material.'); return; }
    const botao = ev.target.querySelector('button[type="submit"]');
    const rotuloOriginal = botao.textContent;
    botao.disabled = true; botao.textContent = 'Salvando...';
    const dadosMaterial = {
      nome, categoria: document.getElementById('modal-material-categoria').value,
      unidade: document.getElementById('modal-material-unidade').value || 'unidade',
      estoque_minimo: document.getElementById('modal-material-estoque-minimo').value,
      ativo: document.getElementById('modal-material-ativo').checked
    };
    const resp = materialEmEdicaoId
      ? await api('atualizarMaterial', Object.assign({id: materialEmEdicaoId}, dadosMaterial))
      : await api('criarMaterial', dadosMaterial);
    botao.disabled = false; botao.textContent = rotuloOriginal;
    if(!resp.ok){ alert(resp.erro || 'Não foi possível salvar.'); return; }
    fecharModalMaterial();
    await carregarMateriaisEstoque();
    renderizarCatalogoMateriais();
  });
}
function abrirModalMaterial(material){
  prepararModalMaterial();
  materialEmEdicaoId = material ? material.id : null;
  document.getElementById('titulo-modal-material').textContent = material ? 'Editar material' : 'Novo material';
  document.getElementById('modal-material-nome').value = material ? material.nome : '';
  document.getElementById('modal-material-categoria').value = material ? (material.categoria||'') : '';
  document.getElementById('modal-material-unidade').value = material ? (material.unidade||'unidade') : 'unidade';
  document.getElementById('modal-material-estoque-minimo').value = material ? (material.estoque_minimo||0) : '';
  document.getElementById('modal-material-ativo').checked = material ? material.ativo!==false : true;
  document.getElementById('sobreposicao-modal-material').classList.add('aberta');
}
function fecharModalMaterial(){
  document.getElementById('sobreposicao-modal-material').classList.remove('aberta');
  materialEmEdicaoId = null;
}


/* ---------------------------------------------------------------------
   ENTRADA POR NF
--------------------------------------------------------------------- */
function prepararEntradaEstoque(){
  document.getElementById('entrada-material').innerHTML = estoqueCacheMateriais.map(m=>`<option value="${m.id}">${m.nome}</option>`).join('');
  document.getElementById('entrada-fornecedor').innerHTML = '<option value="">—</option>' + estoqueCacheFornecedores.map(f=>`<option value="${f.id}">${f.nome}</option>`).join('');
  if(!document.getElementById('entrada-data').value){
    document.getElementById('entrada-data').value = new Date().toISOString().slice(0,10);
  }
  if(estoqueSubAbaPronta.entrada) return;
  estoqueSubAbaPronta.entrada = true;
  prepararImportacaoPdfNf();
  document.getElementById('botao-registrar-entrada').addEventListener('click', async ()=>{
    const confirmacao = document.getElementById('confirmacao-entrada-estoque');
    const quantidade = document.getElementById('entrada-quantidade').value;
    if(!quantidade || Number(quantidade)<=0){
      confirmacao.style.color = 'var(--danger)'; confirmacao.textContent = 'Informe uma quantidade válida.';
      return;
    }
    confirmacao.style.color = 'var(--ink-400)'; confirmacao.textContent = 'Salvando...';
    const resp = await api('criarEntradaEstoque', {
      material_id: document.getElementById('entrada-material').value,
      fornecedor_id: document.getElementById('entrada-fornecedor').value || null,
      nota_fiscal: document.getElementById('entrada-nf').value,
      lote: document.getElementById('entrada-lote').value,
      data_entrada: document.getElementById('entrada-data').value,
      validade: document.getElementById('entrada-validade').value || null,
      quantidade, valor_unitario: document.getElementById('entrada-valor-unitario').value || null
    });
    if(!resp.ok){ confirmacao.style.color='var(--danger)'; confirmacao.textContent = resp.erro || 'Não foi possível salvar.'; return; }
    confirmacao.style.color = 'var(--teal-700)'; confirmacao.textContent = 'Entrada registrada ✓';
    ['entrada-nf','entrada-lote','entrada-validade','entrada-quantidade','entrada-valor-unitario'].forEach(id=>document.getElementById(id).value='');
    setTimeout(()=>{ if(confirmacao.textContent==='Entrada registrada ✓') confirmacao.textContent=''; }, 2500);
  });
}


/* ---------------------------------------------------------------------
   SOLICITAR
--------------------------------------------------------------------- */
async function prepararSolicitarEstoque(){
  document.getElementById('solicitar-material').innerHTML = estoqueCacheMateriais.map(m=>`<option value="${m.id}">${m.nome} (${m.unidade})</option>`).join('');
  document.getElementById('solicitar-profissional').innerHTML = '<option value="">—</option>' + (estado.profissionaisCadastro||[]).map(p=>`<option value="${p.id}">${p.nome}</option>`).join('');
  document.getElementById('solicitar-procedimento').innerHTML = '<option value="">—</option>' + (estado.listas.procedimentos||[]).map(p=>`<option>${p}</option>`).join('');
  document.getElementById('solicitar-exame').innerHTML = '<option value="">—</option>' + (estado.listas.exames||[]).map(e=>`<option>${e}</option>`).join('');

  if(estado.papel==='profissional'){
    const sel = document.getElementById('solicitar-profissional');
    const meu = (estado.profissionaisCadastro||[]).find(p=>p.nome.trim().toLowerCase()===String(estado.nomeProfissional||'').trim().toLowerCase());
    if(meu){ sel.value = meu.id; sel.disabled = true; }
  }

  await carregarMinhasSolicitacoes();

  if(estoqueSubAbaPronta.solicitar) return;
  estoqueSubAbaPronta.solicitar = true;
  document.getElementById('botao-criar-solicitacao').addEventListener('click', async ()=>{
    const confirmacao = document.getElementById('confirmacao-solicitacao-estoque');
    const quantidade = document.getElementById('solicitar-quantidade').value;
    if(!quantidade || Number(quantidade)<=0){
      confirmacao.style.color = 'var(--danger)'; confirmacao.textContent = 'Informe uma quantidade válida.';
      return;
    }
    confirmacao.style.color = 'var(--ink-400)'; confirmacao.textContent = 'Enviando...';
    const resp = await api('criarSolicitacaoMaterial', {
      material_id: document.getElementById('solicitar-material').value,
      profissional_id: document.getElementById('solicitar-profissional').value || null,
      procedimento: document.getElementById('solicitar-procedimento').value || null,
      exame: document.getElementById('solicitar-exame').value || null,
      quantidade, observacao: document.getElementById('solicitar-observacao').value,
      solicitado_por: estado.usuario
    });
    if(!resp.ok){ confirmacao.style.color='var(--danger)'; confirmacao.textContent = resp.erro || 'Não foi possível enviar.'; return; }
    confirmacao.style.color = 'var(--teal-700)'; confirmacao.textContent = 'Solicitação enviada ✓';
    ['solicitar-quantidade','solicitar-observacao'].forEach(id=>document.getElementById(id).value='');
    setTimeout(()=>{ if(confirmacao.textContent==='Solicitação enviada ✓') confirmacao.textContent=''; }, 2500);
    await carregarMinhasSolicitacoes();
  });
}

async function carregarMinhasSolicitacoes(){
  const resp = await api('listarSolicitacoesMaterial', {status:'pendente'});
  const tabela = document.getElementById('tabela-minhas-solicitacoes');
  const lista = resp.ok ? (resp.solicitacoes||[]) : [];
  tabela.innerHTML = lista.length===0 ? '<tr><td class="vazio">Nenhuma solicitação pendente.</td></tr>' : `
    <thead><tr><th>Material</th><th>Qtd.</th><th>Atendimento</th><th>Exame</th><th>Solicitado em</th></tr></thead>
    <tbody>${lista.map(s=>`<tr><td>${(s.materiais||{}).nome||'—'}</td><td>${s.quantidade}</td><td>${s.procedimento||'—'}</td><td>${s.exame||'—'}</td><td>${new Date(s.solicitado_em).toLocaleDateString('pt-BR')}</td></tr>`).join('')}</tbody>`;
}


/* ---------------------------------------------------------------------
   DISPENSAR (aprovação + baixa FEFO)
--------------------------------------------------------------------- */
async function carregarSolicitacoesPendentes(){
  const resp = await api('listarSolicitacoesMaterial', {status:'pendente'});
  const tabela = document.getElementById('tabela-solicitacoes-pendentes');
  const lista = resp.ok ? (resp.solicitacoes||[]) : [];
  tabela.innerHTML = lista.length===0 ? '<tr><td class="vazio">Nenhuma solicitação pendente.</td></tr>' : `
    <thead><tr><th>Material</th><th>Qtd.</th><th>Profissional</th><th>Atendimento</th><th>Exame</th><th>Solicitado por</th><th>Quando</th><th></th></tr></thead>
    <tbody>${lista.map(s=>`
      <tr data-id="${s.id}">
        <td>${(s.materiais||{}).nome||'—'}</td>
        <td>${s.quantidade} ${(s.materiais||{}).unidade||''}</td>
        <td>${(s.profissionais||{}).nome||'—'}</td>
        <td>${s.procedimento||'—'}</td>
        <td>${s.exame||'—'}</td>
        <td>${s.solicitado_por||'—'}</td>
        <td>${new Date(s.solicitado_em).toLocaleDateString('pt-BR')}</td>
        <td style="display:flex;gap:6px;">
          <button class="botao secundario pequeno botao-dispensar-solicitacao">Dispensar</button>
          <button class="botao sutil pequeno botao-negar-solicitacao">Negar</button>
        </td>
      </tr>`).join('')}</tbody>`;

  tabela.querySelectorAll('.botao-dispensar-solicitacao').forEach(botao=>{
    botao.addEventListener('click', async (ev)=>{
      const id = ev.target.closest('tr').dataset.id;
      ev.target.disabled = true; ev.target.textContent = 'Processando...';
      const resp = await api('dispensarSolicitacao', {id, dispensado_por: estado.usuario});
      if(!resp.ok){ alert(resp.erro || 'Não foi possível dispensar.'); ev.target.disabled=false; ev.target.textContent='Dispensar'; return; }
      await carregarSolicitacoesPendentes();
    });
  });
  tabela.querySelectorAll('.botao-negar-solicitacao').forEach(botao=>{
    botao.addEventListener('click', async (ev)=>{
      const id = ev.target.closest('tr').dataset.id;
      const motivo = prompt('Motivo da negativa (opcional):') || '';
      await api('negarSolicitacaoMaterial', {id, motivo});
      await carregarSolicitacoesPendentes();
    });
  });
}


/* ---------------------------------------------------------------------
   RELATÓRIO — posição de estoque + vencimentos + alerta de mínimo
--------------------------------------------------------------------- */
async function carregarRelatorioEstoque(){
  const resp = await api('obterPosicaoEstoque', {});
  if(!resp.ok){
    document.getElementById('resumo-estoque').innerHTML = `<p class="vazio">${resp.erro||'Não foi possível carregar.'}</p>`;
    return;
  }
  const materiais = resp.materiais||[];
  const lotes = resp.lotes||[];

  const posicaoPorMaterial = {};
  materiais.forEach(m=>{ posicaoPorMaterial[m.id] = {material:m, total:0}; });
  lotes.forEach(l=>{
    if(posicaoPorMaterial[l.material_id]) posicaoPorMaterial[l.material_id].total += Number(l.quantidade_atual);
  });

  const abaixoDoMinimo = Object.values(posicaoPorMaterial).filter(p=>p.total <= Number(p.material.estoque_minimo) && Number(p.material.estoque_minimo)>0);
  const hoje = new Date();
  const em60Dias = new Date(hoje.getTime() + 60*24*60*60*1000);
  const vencendo = lotes.filter(l=>l.validade && new Date(l.validade) <= em60Dias).sort((a,b)=>new Date(a.validade)-new Date(b.validade));

  document.getElementById('resumo-estoque').innerHTML = `
    <div class="kpi"><div class="rotulo">Materiais cadastrados</div><div class="valor">${materiais.length}</div></div>
    <div class="kpi"><div class="rotulo">Lotes ativos</div><div class="valor">${lotes.length}</div></div>
    <div class="kpi"><div class="rotulo">Abaixo do mínimo</div><div class="valor" style="color:${abaixoDoMinimo.length?'var(--danger)':'inherit'};">${abaixoDoMinimo.length}</div></div>
    <div class="kpi"><div class="rotulo">Vencendo em 60 dias</div><div class="valor" style="color:${vencendo.length?'var(--gold-600)':'inherit'};">${vencendo.length}</div></div>
  `;

  const tabelaPosicao = document.getElementById('tabela-posicao-estoque');
  const linhasPosicao = Object.values(posicaoPorMaterial).sort((a,b)=>a.material.nome.localeCompare(b.material.nome));
  tabelaPosicao.innerHTML = `
    <thead><tr><th>Material</th><th>Estoque atual</th><th>Estoque mínimo</th><th>Situação</th></tr></thead>
    <tbody>${linhasPosicao.map(p=>{
      const abaixo = p.total <= Number(p.material.estoque_minimo) && Number(p.material.estoque_minimo)>0;
      return `<tr><td>${p.material.nome}</td><td class="mono">${p.total} ${p.material.unidade}</td><td class="mono">${p.material.estoque_minimo||'—'}</td>
        <td>${abaixo?'<span class="tag tag-alerta">⚠️ Abaixo do mínimo</span>':'<span style="color:var(--teal-700);">OK</span>'}</td></tr>`;
    }).join('')}</tbody>`;

  const tabelaVencimentos = document.getElementById('tabela-vencimentos-estoque');
  tabelaVencimentos.innerHTML = vencendo.length===0 ? '<tr><td class="vazio">Nada vencendo nos próximos 60 dias.</td></tr>' : `
    <thead><tr><th>Material</th><th>Lote</th><th>Validade</th><th>Quantidade</th></tr></thead>
    <tbody>${vencendo.map(l=>{
      const material = materiais.find(m=>m.id===l.material_id);
      const diasRestantes = Math.ceil((new Date(l.validade)-hoje)/(24*60*60*1000));
      const vencido = diasRestantes < 0;
      return `<tr><td>${material?material.nome:'—'}</td><td class="mono">${l.lote||'—'}</td>
        <td style="color:${vencido?'var(--danger)':'var(--gold-600)'};">${new Date(l.validade).toLocaleDateString('pt-BR')} ${vencido?'(vencido)':`(${diasRestantes}d)`}</td>
        <td class="mono">${l.quantidade_atual}</td></tr>`;
    }).join('')}</tbody>`;
}


/* ---------------------------------------------------------------------
   DISPENSADOS — gestão + confirmação de recebimento (só aqui a baixa de
   estoque acontece de fato, depois que o solicitante confirma).
--------------------------------------------------------------------- */
let dispensadosPronto = false;
async function prepararDispensados(){
  const selSolicitante = document.getElementById('dispensados-filtro-solicitante');
  if(selSolicitante.options.length <= 1){
    selSolicitante.innerHTML = '<option value="">Todos os solicitantes</option>' +
      [...new Set((await api('listarSolicitacoesMaterial', {status:['dispensado','confirmado']})).solicitacoes.map(s=>s.solicitado_por).filter(Boolean))]
        .map(u=>`<option value="${u}">${u}</option>`).join('');
  }
  await carregarDispensados();
  if(dispensadosPronto) return;
  dispensadosPronto = true;

  selSolicitante.addEventListener('change', carregarDispensados);
  document.getElementById('dispensados-filtro-status').addEventListener('change', carregarDispensados);

  document.getElementById('botao-confirmar-recebimento').addEventListener('click', async ()=>{
    const marcados = Array.from(document.querySelectorAll('.chk-dispensado-recebido:checked')).map(el=>el.dataset.id);
    if(marcados.length===0) return;
    const confirmacao = document.getElementById('confirmacao-dispensados');
    const observacao = document.getElementById('dispensados-observacao').value;
    confirmacao.style.color = 'var(--ink-400)'; confirmacao.textContent = 'Confirmando...';
    let erro = null;
    for(const id of marcados){
      const resp = await api('confirmarRecebimentoSolicitacao', {id, confirmado_por: estado.usuario, observacao});
      if(!resp.ok) erro = resp.erro;
    }
    if(erro){ confirmacao.style.color='var(--danger)'; confirmacao.textContent = erro; return; }
    confirmacao.style.color = 'var(--teal-700)'; confirmacao.textContent = 'Recebimento confirmado ✓ — estoque baixado.';
    document.getElementById('dispensados-observacao').value = '';
    await carregarDispensados();
    setTimeout(()=>{ if(confirmacao.textContent.startsWith('Recebimento')) confirmacao.textContent=''; }, 3000);
  });
}

async function carregarDispensados(){
  const filtroStatus = document.getElementById('dispensados-filtro-status').value;
  const filtroSolicitante = document.getElementById('dispensados-filtro-solicitante').value;
  const statusBusca = filtroStatus==='todos' ? ['dispensado','confirmado'] : filtroStatus==='confirmado' ? ['confirmado'] : ['dispensado'];
  const resp = await api('listarSolicitacoesMaterial', {status: statusBusca, solicitado_por: filtroSolicitante || undefined});
  const tabela = document.getElementById('tabela-dispensados');
  const lista = resp.ok ? (resp.solicitacoes||[]) : [];

  // Só pode marcar/confirmar quem solicitou aquele item, ou quem tem
  // permissão de dispensar (farmácia/gerente pode confirmar em nome de
  // alguém, se precisar).
  const podeConfirmarGeral = temPermissao('dispensar_estoque');

  tabela.innerHTML = lista.length===0 ? '<tr><td class="vazio">Nada aqui.</td></tr>' : `
    <thead><tr><th></th><th>Material</th><th>Qtd.</th><th>Solicitante</th><th>Dispensado em</th><th>Status</th><th>Recebido por / Observação</th></tr></thead>
    <tbody>${lista.map(s=>{
      const podeConfirmarEsta = s.status==='dispensado' && (podeConfirmarGeral || s.solicitado_por===estado.usuario);
      return `<tr data-id="${s.id}">
        <td>${podeConfirmarEsta?`<input type="checkbox" class="chk-dispensado-recebido" data-id="${s.id}">`:''}</td>
        <td>${(s.materiais||{}).nome||'—'}</td>
        <td>${s.quantidade} ${(s.materiais||{}).unidade||''}</td>
        <td>${s.solicitado_por||'—'}</td>
        <td>${new Date(s.solicitado_em).toLocaleDateString('pt-BR')}</td>
        <td>${s.status==='confirmado'?'<span style="color:var(--teal-700);">Confirmado</span>':'<span style="color:var(--gold-600);">Aguardando confirmação</span>'}</td>
        <td>${s.status==='confirmado'?`${s.confirmado_por||'—'}${s.observacao_recebimento?' — '+s.observacao_recebimento:''}`:'—'}</td>
      </tr>`;
    }).join('')}</tbody>`;

  const temCheckboxVisivel = tabela.querySelectorAll('.chk-dispensado-recebido').length > 0;
  document.getElementById('dispensados-acoes-confirmacao').style.display = temCheckboxVisivel ? 'block' : 'none';
}


/* ---------------------------------------------------------------------
   IMPORTAÇÃO DE NF EM PDF — extrai o texto (pdf.js), tenta achar CNPJ do
   fornecedor / Nº da NF / Data por regex, e pré-preenche o formulário.
   NÃO tenta extrair Material/Quantidade/Lote/Validade automaticamente —
   cada fornecedor descreve item de um jeito diferente, arriscar isso
   sozinho geraria erro silencioso de estoque. Texto extraído fica
   visível pra copiar manualmente o que precisar.
--------------------------------------------------------------------- */
function prepararImportacaoPdfNf(){
  if(typeof pdfjsLib !== 'undefined'){
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  document.getElementById('entrada-pdf-arquivo').addEventListener('change', async (ev)=>{
    const arquivo = ev.target.files[0];
    const status = document.getElementById('entrada-pdf-status');
    if(!arquivo) return;
    if(typeof pdfjsLib === 'undefined'){
      status.style.color = 'var(--danger)';
      status.textContent = 'Não consegui carregar o leitor de PDF (sem internet?). Preencha manualmente.';
      return;
    }
    status.style.color = 'var(--ink-400)';
    status.textContent = 'Lendo PDF...';
    try{
      const bytes = await arquivo.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({data: bytes}).promise;
      let textoCompleto = '';
      for(let i=1; i<=pdf.numPages; i++){
        const pagina = await pdf.getPage(i);
        const conteudo = await pagina.getTextContent();
        textoCompleto += conteudo.items.map(it=>it.str).join(' ') + '\n';
      }

      document.getElementById('entrada-pdf-texto').value = textoCompleto;
      document.getElementById('entrada-pdf-texto-detalhes').style.display = 'block';

      const achados = [];

      // CNPJ do fornecedor — tenta casar contra o cadastro já existente
      const matchCnpj = textoCompleto.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
      if(matchCnpj){
        const cnpjLimpo = matchCnpj[0].replace(/\D/g,'');
        const fornecedorAchado = estoqueCacheFornecedores.find(f=>String(f.cnpj||'').replace(/\D/g,'')===cnpjLimpo);
        if(fornecedorAchado){
          document.getElementById('entrada-fornecedor').value = fornecedorAchado.id;
          achados.push(`Fornecedor: ${fornecedorAchado.nome} (por CNPJ)`);
        } else {
          achados.push(`CNPJ ${matchCnpj[0]} encontrado, mas nenhum fornecedor cadastrado bate com ele — cadastre ele em Cadastro → Fornecedores primeiro, se for novo.`);
        }
      }

      // Número da NF — procura perto de palavras-chave comuns
      const matchNf = textoCompleto.match(/(?:N[ºO°]?\s*(?:DA\s*)?(?:NOTA|NF-?E?)?\s*[:\-]?\s*)(\d{3,9})/i);
      if(matchNf){
        document.getElementById('entrada-nf').value = matchNf[1];
        achados.push(`Nº da NF: ${matchNf[1]}`);
      }

      // Data de emissão — primeira data no formato dd/mm/aaaa do documento
      const matchData = textoCompleto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if(matchData){
        document.getElementById('entrada-data').value = `${matchData[3]}-${matchData[2]}-${matchData[1]}`;
        achados.push(`Data: ${matchData[0]}`);
      }

      status.style.color = achados.length ? 'var(--teal-700)' : 'var(--gold-600)';
      status.textContent = achados.length
        ? `Encontrado: ${achados.join(' · ')}. Confira antes de salvar — Material/Lote/Validade/Quantidade continuam manuais.`
        : 'Não consegui identificar nada automaticamente neste PDF — preencha manualmente (o texto extraído está disponível abaixo, se ajudar a copiar).';
    }catch(e){
      status.style.color = 'var(--danger)';
      status.textContent = 'Não consegui ler esse PDF (pode ser PDF escaneado/imagem, sem texto — nesse caso preencha manualmente).';
    }
  });
}
