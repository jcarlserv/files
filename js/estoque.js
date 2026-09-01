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
  const rotulos = {'estoque-materiais':'Fornecedor','estoque-entrada':'Material','estoque-solicitar':'Solicitar','estoque-dispensar':'Dispensar','estoque-dispensados':'Dispensados','estoque-relatorio':'Relatório'};
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
  if(estado.subAbaEstoque==='estoque-materiais') await prepararAbaFornecedor();
  if(estado.subAbaEstoque==='estoque-entrada') await prepararAbaMaterial();
  if(estado.subAbaEstoque==='estoque-solicitar') await prepararSolicitarEstoque();
  if(estado.subAbaEstoque==='estoque-dispensados') await prepararDispensados();
  if(estado.subAbaEstoque==='estoque-dispensar') await carregarSolicitacoesPendentes();
  if(estado.subAbaEstoque==='estoque-relatorio') await carregarRelatorioEstoque();
}


// Toggle genérico "Cadastro Manual / Cadastro Automático" — reaproveitado
// em Fornecedor e Material. navId = id do sub-nav interno; paineis = mapa
// {manual: idDoDiv, automatico: idDoDiv}.
function prepararToggleManualAutomatico(navId, paineis){
  const nav = document.getElementById(navId);
  nav.querySelectorAll('.sub-aba').forEach(el=>{
    el.addEventListener('click', ()=> trocarModoInterno(navId, paineis, el.dataset.modo));
  });
}

// Troca de modo programaticamente (não só por clique) — usado pelo botão
// "Editar" da Listagem, que precisa levar a pessoa pra "Cadastro Manual"
// automaticamente (senão o formulário fica preenchido escondido atrás da
// Listagem, sem a pessoa ver nada acontecer ao clicar em Editar).
function trocarModoInterno(navId, paineis, modo){
  const nav = document.getElementById(navId);
  nav.querySelectorAll('.sub-aba').forEach(el=>el.classList.toggle('ativa', el.dataset.modo===modo));
  Object.keys(paineis).forEach(chave=>{
    document.getElementById(paineis[chave]).style.display = (chave===modo) ? 'block' : 'none';
  });
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

async function prepararAbaFornecedor(){
  renderizarFornecedores();
  if(!estoqueSubAbaPronta.fornecedor){
    prepararToggleManualAutomatico('sub-nav-fornecedor', {lista:'fornecedor-modo-lista', manual:'fornecedor-modo-manual', automatico:'fornecedor-modo-automatico'});
    prepararFormFornecedor();
    prepararImportacaoFornecedorPdf();
    estoqueSubAbaPronta.fornecedor = true;
  }
}

async function prepararAbaMaterial(){
  await renderizarCatalogoMateriais();
  await prepararEntradaEstoque();
  if(!estoqueSubAbaPronta.material){
    prepararToggleManualAutomatico('sub-nav-material', {lista:'material-modo-lista', manual:'material-modo-manual', automatico:'material-modo-automatico'});
    prepararFormMaterial();
    prepararImportacaoMaterialPdf();
    estoqueSubAbaPronta.material = true;
  }
}

async function renderizarCatalogoMateriais(){
  const podeEditar = temPermissao('editar_estoque');
  const podeExcluir = temPermissao('excluir_material_estoque');
  const tabela = document.getElementById('tabela-materiais');

  // Quantidade em estoque = soma de todos os lotes (Entradas) daquele
  // material — vem da NF, não é um campo do cadastro do material em si.
  const respPosicao = await api('obterPosicaoEstoque', {});
  const lotes = respPosicao.ok ? (respPosicao.lotes||[]) : [];
  const quantidadePorMaterial = {};
  lotes.forEach(l=>{ quantidadePorMaterial[l.material_id] = (quantidadePorMaterial[l.material_id]||0) + Number(l.quantidade_atual||0); });

  tabela.innerHTML = `
    <thead><tr><th>Nome</th><th>Categoria</th><th>Unidade</th><th>Qtd. em estoque</th><th>Estoque mínimo</th><th>Valor</th><th>Ativo</th><th></th></tr></thead>
    <tbody>${estoqueCacheMateriais.map(m=>{
      const qtd = quantidadePorMaterial[m.id] || 0;
      const abaixoDoMinimo = qtd < Number(m.estoque_minimo||0);
      return `
      <tr data-id="${m.id}">
        <td>${m.nome}</td>
        <td>${m.categoria||'—'}</td>
        <td>${m.unidade||'unidade'}</td>
        <td class="mono" style="${abaixoDoMinimo?'color:var(--danger);font-weight:600;':''}">${qtd}${abaixoDoMinimo?' ⚠':''}</td>
        <td class="mono">${m.estoque_minimo||0}</td>
        <td class="mono">${m.valor_referencia!=null ? 'R$ '+Number(m.valor_referencia).toFixed(2).replace('.',',') : '—'}</td>
        <td>${m.ativo?'<span style="color:var(--teal-700);">Sim</span>':'<span style="color:var(--ink-400);">Não</span>'}</td>
        <td>${podeEditar?`<button class="botao secundario pequeno botao-editar-material" data-id="${m.id}">Editar</button>`:''}${podeExcluir?`<button class="botao sutil pequeno botao-excluir-material" data-id="${m.id}" data-nome="${m.nome.replace(/"/g,'&quot;')}">Excluir</button>`:''}</td>
      </tr>`;
    }).join('')}</tbody>`;

  if(podeEditar){
    tabela.querySelectorAll('.botao-editar-material').forEach(botao=>{
      botao.addEventListener('click', ()=>{
        const material = estoqueCacheMateriais.find(m=>m.id===botao.dataset.id);
        if(material) preencherFormMaterial(material);
      });
    });
  }
  if(podeExcluir){
    tabela.querySelectorAll('.botao-excluir-material').forEach(botao=>{
      botao.addEventListener('click', ()=>excluirMaterialEstoque(botao.dataset.id, botao.dataset.nome));
    });
  }
}

function renderizarFornecedores(){
  const podeEditar = temPermissao('editar_estoque');
  const podeExcluir = temPermissao('excluir_fornecedor_estoque');
  const tabela = document.getElementById('tabela-fornecedores');
  tabela.innerHTML = `
    <thead><tr><th>Nome</th><th>CNPJ</th><th>Cidade/UF</th><th>Contato</th><th></th></tr></thead>
    <tbody>${estoqueCacheFornecedores.map(f=>`
      <tr data-id="${f.id}">
        <td>${f.nome}</td>
        <td class="mono">${f.cnpj||'—'}</td>
        <td>${[f.cidade, f.uf].filter(Boolean).join('/')||'—'}</td>
        <td>${f.contato||'—'}</td>
        <td>${podeEditar?`<button class="botao secundario pequeno botao-editar-fornecedor" data-id="${f.id}">Editar</button>`:''}${podeExcluir?`<button class="botao sutil pequeno botao-excluir-fornecedor" data-id="${f.id}" data-nome="${f.nome.replace(/"/g,'&quot;')}">Excluir</button>`:''}</td>
      </tr>`).join('')}</tbody>`;
  if(podeEditar){
    tabela.querySelectorAll('.botao-editar-fornecedor').forEach(botao=>{
      botao.addEventListener('click', ()=>{
        const fornecedor = estoqueCacheFornecedores.find(f=>f.id===botao.dataset.id);
        if(fornecedor) preencherFormFornecedor(fornecedor);
      });
    });
  }
  if(podeExcluir){
    tabela.querySelectorAll('.botao-excluir-fornecedor').forEach(botao=>{
      botao.addEventListener('click', ()=>excluirFornecedorEstoque(botao.dataset.id, botao.dataset.nome));
    });
  }
}

async function excluirFornecedorEstoque(id, nome){
  if(!temPermissao('excluir_fornecedor_estoque')) return;
  if(!confirm(`Excluir fornecedor "${nome}" do banco?`)) return;
  const resp = await api('excluirFornecedor', {id});
  if(!resp.ok){ alert(resp.erro || 'Não foi possível excluir.'); return; }
  await carregarFornecedoresEstoque();
  renderizarFornecedores();
}

async function excluirMaterialEstoque(id, nome){
  if(!temPermissao('excluir_material_estoque')) return;
  if(!confirm(`Excluir material "${nome}" do banco?`)) return;
  const resp = await api('excluirMaterial', {id});
  if(!resp.ok){ alert(resp.erro || 'Não foi possível excluir.'); return; }
  await carregarMateriaisEstoque();
  await renderizarCatalogoMateriais();
}


/* ---------------------------------------------------------------------
   FORNECEDOR — form inline (Cadastro Manual), criar/editar no mesmo
   lugar (sem modal). Toggle Manual/Automático fica pronto na primeira
   visita à aba.
--------------------------------------------------------------------- */
let fornecedorEmEdicaoId = null;
function preencherFormFornecedor(fornecedor){
  fornecedorEmEdicaoId = fornecedor ? fornecedor.id : null;
  document.getElementById('titulo-form-fornecedor').textContent = fornecedor ? 'Editar fornecedor' : 'Novo fornecedor';
  document.getElementById('form-fornecedor-nome').value = fornecedor ? fornecedor.nome : '';
  document.getElementById('form-fornecedor-cnpj').value = fornecedor ? (fornecedor.cnpj||'') : '';
  document.getElementById('form-fornecedor-contato').value = fornecedor ? (fornecedor.contato||'') : '';
  document.getElementById('form-fornecedor-ie').value = fornecedor ? (fornecedor.inscricao_estadual||'') : '';
  document.getElementById('form-fornecedor-endereco').value = fornecedor ? (fornecedor.endereco||'') : '';
  document.getElementById('form-fornecedor-cidade').value = fornecedor ? (fornecedor.cidade||'') : '';
  document.getElementById('form-fornecedor-uf').value = fornecedor ? (fornecedor.uf||'') : '';
  document.getElementById('form-fornecedor-cep').value = fornecedor ? (fornecedor.cep||'') : '';
  document.getElementById('botao-cancelar-edicao-fornecedor').style.display = fornecedor ? 'inline-flex' : 'none';
  if(fornecedor){
    trocarModoInterno('sub-nav-fornecedor', {lista:'fornecedor-modo-lista', manual:'fornecedor-modo-manual', automatico:'fornecedor-modo-automatico'}, 'manual');
  }
  document.getElementById('form-fornecedor-nome').scrollIntoView({behavior:'smooth', block:'center'});
}

function prepararFormFornecedor(){
  document.getElementById('botao-cancelar-edicao-fornecedor').addEventListener('click', ()=>preencherFormFornecedor(null));
  document.getElementById('botao-salvar-fornecedor-manual').addEventListener('click', async ()=>{
    const nome = document.getElementById('form-fornecedor-nome').value.trim();
    const confirmacao = document.getElementById('confirmacao-fornecedor-manual');
    if(!nome){ confirmacao.style.color='var(--danger)'; confirmacao.textContent='Preencha o nome.'; return; }
    const dados = {
      nome, cnpj: document.getElementById('form-fornecedor-cnpj').value,
      contato: document.getElementById('form-fornecedor-contato').value,
      inscricao_estadual: document.getElementById('form-fornecedor-ie').value,
      endereco: document.getElementById('form-fornecedor-endereco').value,
      cidade: document.getElementById('form-fornecedor-cidade').value,
      uf: document.getElementById('form-fornecedor-uf').value,
      cep: document.getElementById('form-fornecedor-cep').value
    };
    confirmacao.style.color = 'var(--ink-400)'; confirmacao.textContent = 'Salvando...';
    const resp = fornecedorEmEdicaoId
      ? await api('atualizarFornecedor', Object.assign({id: fornecedorEmEdicaoId}, dados))
      : await api('criarFornecedor', dados);
    if(!resp.ok){ confirmacao.style.color='var(--danger)'; confirmacao.textContent = resp.erro || 'Não foi possível salvar.'; return; }
    confirmacao.style.color = 'var(--teal-700)'; confirmacao.textContent = 'Salvo ✓';
    preencherFormFornecedor(null);
    await carregarFornecedoresEstoque();
    renderizarFornecedores();
    setTimeout(()=>{ if(confirmacao.textContent==='Salvo ✓') confirmacao.textContent=''; }, 2500);
  });
}


/* ---------------------------------------------------------------------
   MATERIAL — form inline (Cadastro Manual), mesma lógica do Fornecedor.
--------------------------------------------------------------------- */
let materialEmEdicaoId = null;
function preencherFormMaterial(material){
  materialEmEdicaoId = material ? material.id : null;
  document.getElementById('titulo-form-material').textContent = material ? 'Editar material' : 'Novo material';
  document.getElementById('form-material-nome').value = material ? material.nome : '';
  document.getElementById('form-material-categoria').value = material ? (material.categoria||'') : '';
  document.getElementById('form-material-unidade').value = material ? (material.unidade||'unidade') : 'unidade';
  document.getElementById('form-material-estoque-minimo').value = material ? (material.estoque_minimo||0) : '';
  document.getElementById('form-material-codigo-fornecedor').value = material ? (material.codigo_fornecedor||'') : '';
  document.getElementById('form-material-valor-referencia').value = material ? (material.valor_referencia!=null ? material.valor_referencia : '') : '';
  document.getElementById('form-material-codigo-barras').value = material ? (material.codigo_barras||'') : '';
  document.getElementById('form-material-ativo').checked = material ? material.ativo!==false : true;
  document.getElementById('botao-cancelar-edicao-material').style.display = material ? 'inline-flex' : 'none';
  if(material){
    trocarModoInterno('sub-nav-material', {lista:'material-modo-lista', manual:'material-modo-manual', automatico:'material-modo-automatico'}, 'manual');
  }
  document.getElementById('form-material-nome').scrollIntoView({behavior:'smooth', block:'center'});
}

function prepararFormMaterial(){
  document.getElementById('form-material-categoria').innerHTML = '<option value="">—</option>' +
    (estado.listas.categorias_material||[]).map(v=>`<option>${v}</option>`).join('');
  document.getElementById('form-material-unidade').innerHTML =
    (estado.listas.unidades_material||[]).map(v=>`<option>${v}</option>`).join('');
  document.getElementById('botao-cancelar-edicao-material').addEventListener('click', ()=>preencherFormMaterial(null));
  document.getElementById('botao-salvar-material-manual').addEventListener('click', async ()=>{
    const nome = document.getElementById('form-material-nome').value.trim();
    const confirmacao = document.getElementById('confirmacao-material-manual');
    if(!nome){ confirmacao.style.color='var(--danger)'; confirmacao.textContent='Preencha o nome.'; return; }
    const dados = {
      nome, categoria: document.getElementById('form-material-categoria').value,
      unidade: document.getElementById('form-material-unidade').value || 'unidade',
      estoque_minimo: document.getElementById('form-material-estoque-minimo').value,
      codigo_fornecedor: document.getElementById('form-material-codigo-fornecedor').value,
      valor_referencia: document.getElementById('form-material-valor-referencia').value,
      codigo_barras: document.getElementById('form-material-codigo-barras').value,
      ativo: document.getElementById('form-material-ativo').checked
    };
    confirmacao.style.color = 'var(--ink-400)'; confirmacao.textContent = 'Salvando...';
    const resp = materialEmEdicaoId
      ? await api('atualizarMaterial', Object.assign({id: materialEmEdicaoId}, dados))
      : await api('criarMaterial', dados);
    if(!resp.ok){ confirmacao.style.color='var(--danger)'; confirmacao.textContent = resp.erro || 'Não foi possível salvar.'; return; }
    confirmacao.style.color = 'var(--teal-700)'; confirmacao.textContent = 'Salvo ✓';
    preencherFormMaterial(null);
    await carregarMateriaisEstoque();
    await renderizarCatalogoMateriais();
    setTimeout(()=>{ if(confirmacao.textContent==='Salvo ✓') confirmacao.textContent=''; }, 2500);
  });
}

/* ---------------------------------------------------------------------
   ENTRADA POR NF
--------------------------------------------------------------------- */
async function prepararEntradaEstoque(){
  document.getElementById('entrada-material').innerHTML = estoqueCacheMateriais.map(m=>`<option value="${m.id}">${m.nome}</option>`).join('');
  document.getElementById('entrada-fornecedor').innerHTML = '<option value="">—</option>' + estoqueCacheFornecedores.map(f=>`<option value="${f.id}">${f.nome}</option>`).join('');
  if(!document.getElementById('entrada-data').value){
    document.getElementById('entrada-data').value = new Date().toISOString().slice(0,10);
  }
  await carregarTabelaEntradas();
  if(estoqueSubAbaPronta.entrada) return;
  estoqueSubAbaPronta.entrada = true;
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
      quantidade, valor_unitario: document.getElementById('entrada-valor-unitario').value || null,
      permitir_nf_repetida: temPermissao('importar_nf_repetida')
    });
    if(!resp.ok){ confirmacao.style.color='var(--danger)'; confirmacao.textContent = resp.erro || 'Não foi possível salvar.'; return; }
    confirmacao.style.color = 'var(--teal-700)'; confirmacao.textContent = 'Entrada registrada ✓';
    ['entrada-nf','entrada-lote','entrada-validade','entrada-quantidade','entrada-valor-unitario'].forEach(id=>document.getElementById(id).value='');
    carregarTabelaEntradas();
    setTimeout(()=>{ if(confirmacao.textContent==='Entrada registrada ✓') confirmacao.textContent=''; }, 2500);
  });
}

async function carregarTabelaEntradas(){
  const resp = await api('obterPosicaoEstoque', {});
  const lotes = resp.ok ? (resp.lotes||[]) : [];
  const podeExcluir = estado.papel === 'gerente';
  const tabela = document.getElementById('tabela-entradas');
  if(!tabela) return;
  tabela.innerHTML = lotes.length===0 ? '<tr><td class="vazio">Nenhuma entrada registrada.</td></tr>' : `
    <thead><tr><th>Material</th><th>NF</th><th>Lote</th><th>Validade</th><th>Qtd.</th><th>Valor</th><th></th></tr></thead>
    <tbody>${lotes.map(l=>{
      const mat = estoqueCacheMateriais.find(m=>m.id===l.material_id) || {};
      const valorTotal = l.valor_unitario ? (Number(l.valor_unitario) * Number(l.quantidade_entrada||l.quantidade_atual)) : null;
      return `<tr data-id="${l.id}">
        <td>${mat.nome||'—'}</td>
        <td class="mono">${l.nota_fiscal||'—'}</td>
        <td class="mono">${l.lote||'—'}</td>
        <td>${l.validade||'—'}</td>
        <td class="mono">${l.quantidade_atual}</td>
        <td class="mono">${valorTotal!=null ? 'R$ '+valorTotal.toFixed(2).replace('.',',') : '—'}</td>
        <td>${podeExcluir?`<button class="botao sutil pequeno botao-excluir-entrada" data-id="${l.id}">Excluir</button>`:''}</td>
      </tr>`;
    }).join('')}</tbody>`;
  if(podeExcluir){
    tabela.querySelectorAll('.botao-excluir-entrada').forEach(botao=>{
      botao.addEventListener('click', ()=>excluirEntradaEstoque(botao.dataset.id));
    });
  }
}

async function excluirEntradaEstoque(id){
  if(estado.papel !== 'gerente') return;
  if(!confirm('Excluir essa entrada? Se algum pedido já usou esse lote, ele volta pra "pendente" (não perde o pedido) e o vínculo é desfeito. Essa ação não pode ser desfeita.')) return;
  const resp = await api('excluirEntradaEstoque', {id});
  if(!resp.ok){ alert(resp.erro || 'Não foi possível excluir.'); return; }
  if(resp.solicitacoesRevertidas > 0){
    alert(`Entrada excluída. ${resp.solicitacoesRevertidas} solicitação(ões) que usavam esse lote voltaram pra "pendente".`);
  }
  await carregarTabelaEntradas();
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
  const podeRetroceder = temPermissao('retroceder_estoque');
  tabela.innerHTML = lista.length===0 ? '<tr><td class="vazio">Nenhuma solicitação pendente.</td></tr>' : `
    <thead><tr><th>Material</th><th>Qtd.</th><th>Atendimento</th><th>Exame</th><th>Solicitado em</th><th></th></tr></thead>
    <tbody>${lista.map(s=>`<tr data-id="${s.id}"><td>${(s.materiais||{}).nome||'—'}</td><td>${s.quantidade}</td><td>${s.procedimento||'—'}</td><td>${s.exame||'—'}</td><td>${new Date(s.solicitado_em).toLocaleDateString('pt-BR')}</td><td>${podeRetroceder?`<button class="botao sutil pequeno botao-cancelar-solicitacao" data-id="${s.id}">Cancelar</button>`:''}</td></tr>`).join('')}</tbody>`;

  tabela.querySelectorAll('.botao-cancelar-solicitacao').forEach(botao=>{
    botao.addEventListener('click', async ()=>{
      if(!confirm('Cancelar essa solicitação?')) return;
      const resp2 = await api('excluirSolicitacaoMaterial', {id: botao.dataset.id});
      if(!resp2.ok){ alert(resp2.erro || 'Não foi possível cancelar.'); return; }
      await carregarMinhasSolicitacoes();
    });
  });
}


/* ---------------------------------------------------------------------
   DISPENSAR (aprovação + baixa FEFO)
--------------------------------------------------------------------- */
async function carregarSolicitacoesPendentes(){
  const resp = await api('listarSolicitacoesMaterial', {status:'pendente'});
  const tabela = document.getElementById('tabela-solicitacoes-pendentes');
  const lista = resp.ok ? (resp.solicitacoes||[]) : [];
  const podeRetroceder = temPermissao('retroceder_estoque');
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
          ${podeRetroceder?'<button class="botao sutil pequeno botao-excluir-solicitacao">Excluir</button>':''}
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
  tabela.querySelectorAll('.botao-excluir-solicitacao').forEach(botao=>{
    botao.addEventListener('click', async (ev)=>{
      if(!confirm('Excluir essa solicitação? Essa ação não pode ser desfeita.')) return;
      const id = ev.target.closest('tr').dataset.id;
      const resp = await api('excluirSolicitacaoMaterial', {id});
      if(!resp.ok){ alert(resp.erro || 'Não foi possível excluir.'); return; }
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

  // Confirmar recebimento: quem solicitou, ou quem tem permissão de
  // dispensar (farmácia/gerente pode confirmar em nome de alguém).
  // Desfazer/Excluir: permissão própria (retroceder_estoque) — mexer numa
  // baixa de estoque já feita é mais sensível que só confirmar.
  const podeConfirmarGeral = temPermissao('dispensar_estoque');
  const podeRetroceder = temPermissao('retroceder_estoque');

  tabela.innerHTML = lista.length===0 ? '<tr><td class="vazio">Nada aqui.</td></tr>' : `
    <thead><tr><th></th><th>Material</th><th>Qtd.</th><th>Solicitante</th><th>Dispensado em</th><th>Status</th><th>Recebido por / Observação</th><th></th></tr></thead>
    <tbody>${lista.map(s=>{
      const podeConfirmarEsta = s.status==='dispensado' && (podeConfirmarGeral || s.solicitado_por===estado.usuario);
      const botaoDesfazer = s.status==='dispensado'
        ? `<button class="botao sutil pequeno botao-desfazer-dispensados" data-id="${s.id}" data-acao="dispensacao">Desfazer</button>`
        : `<button class="botao sutil pequeno botao-desfazer-dispensados" data-id="${s.id}" data-acao="confirmacao">Desfazer</button>`;
      return `<tr data-id="${s.id}">
        <td>${podeConfirmarEsta?`<input type="checkbox" class="chk-dispensado-recebido" data-id="${s.id}">`:''}</td>
        <td>${(s.materiais||{}).nome||'—'}</td>
        <td>${s.quantidade} ${(s.materiais||{}).unidade||''}</td>
        <td>${s.solicitado_por||'—'}</td>
        <td>${new Date(s.solicitado_em).toLocaleDateString('pt-BR')}</td>
        <td>${s.status==='confirmado'?'<span style="color:var(--teal-700);">Confirmado</span>':'<span style="color:var(--gold-600);">Aguardando confirmação</span>'}</td>
        <td>${s.status==='confirmado'?`${s.confirmado_por||'—'}${s.observacao_recebimento?' — '+s.observacao_recebimento:''}`:'—'}</td>
        <td style="display:flex;gap:6px;">
          ${podeRetroceder?botaoDesfazer:''}
          ${podeRetroceder?`<button class="botao sutil pequeno botao-excluir-dispensados" data-id="${s.id}">Excluir</button>`:''}
        </td>
      </tr>`;
    }).join('')}</tbody>`;

  const temCheckboxVisivel = tabela.querySelectorAll('.chk-dispensado-recebido').length > 0;
  document.getElementById('dispensados-acoes-confirmacao').style.display = temCheckboxVisivel ? 'block' : 'none';

  tabela.querySelectorAll('.botao-desfazer-dispensados').forEach(botao=>{
    botao.addEventListener('click', async ()=>{
      const acao = botao.dataset.acao;
      const aviso = acao==='confirmacao'
        ? 'Desfazer a confirmação devolve a quantidade pro estoque e volta pra "aguardando confirmação". Confirma?'
        : 'Desfazer a dispensação libera a reserva e volta a solicitação pra "pendente". Confirma?';
      if(!confirm(aviso)) return;
      const rota = acao==='confirmacao' ? 'desfazerConfirmacaoSolicitacao' : 'desfazerDispensacaoSolicitacao';
      const resp = await api(rota, {id: botao.dataset.id});
      if(!resp.ok){ alert(resp.erro || 'Não foi possível desfazer.'); return; }
      await carregarDispensados();
    });
  });
  tabela.querySelectorAll('.botao-excluir-dispensados').forEach(botao=>{
    botao.addEventListener('click', async ()=>{
      if(!confirm('Excluir esse registro? Se já tinha baixado do estoque, a quantidade volta pro lote. Essa ação não pode ser desfeita.')) return;
      const resp = await api('excluirSolicitacaoMaterial', {id: botao.dataset.id});
      if(!resp.ok){ alert(resp.erro || 'Não foi possível excluir.'); return; }
      await carregarDispensados();
    });
  });
}





/* =====================================================================
   IMPORTAÇÃO DE FORNECEDOR + MATERIAIS VIA PDF (aba Cadastro) — extrai
   fornecedor (CNPJ, nome, endereço) e a lista de itens da tabela de
   produtos. Se o fornecedor já existir (por CNPJ), reaproveita — só
   cadastra materiais novos (por código do fornecedor). Mostra lista pra
   revisão/edição antes de qualquer coisa ser salva — nada é gravado sem
   clicar em "Salvar catálogo".
===================================================================== */

// Função pura de extração — separada da UI de propósito, pra dar pra
// testar isoladamente (regex validado contra NF real antes de integrar).
// Extrai o texto de um PDF já carregado pelo pdf.js, reconstruindo quebra
// de linha de verdade — o pdf.js devolve os trechos de texto soltos, sem
// indicar quebra de linha nenhuma; a única forma de saber se dois trechos
// estão na MESMA linha ou em linhas diferentes é comparando a posição
// vertical (transform[5]) de cada um. Sem isso, o texto vira uma sopa sem
// quebra nenhuma e os regex de extração (que dependem de linha) não
// reconhecem nada — foi exatamente o bug que o usuário relatou.
async function extrairTextoPdfComLinhas(pdf){
  let textoCompleto = '';
  for(let i=1; i<=pdf.numPages; i++){
    const pagina = await pdf.getPage(i);
    const conteudo = await pagina.getTextContent();

    // Agrupa os trechos por posição vertical (y) em vez de assumir que o
    // pdf.js devolve tudo na ordem de leitura — em DANFE com colunas isso
    // não é verdade. Tolerância de 2.5pt cobre variação de baseline dentro
    // da mesma linha sem fundir linhas vizinhas.
    const linhas = [];
    conteudo.items.forEach(item=>{
      if(!item.str || !item.str.trim()) return;
      const y = item.transform[5];
      const x = item.transform[4];
      let linha = linhas.find(l => Math.abs(l.y - y) <= 2.5);
      if(!linha){ linha = {y, itens: []}; linhas.push(linha); }
      linha.itens.push({x, str: item.str});
    });

    linhas.sort((a,b)=> b.y - a.y);                       // topo → base
    linhas.forEach(linha=>{
      linha.itens.sort((a,b)=> a.x - b.x);                // esquerda → direita
      textoCompleto += linha.itens.map(i=>i.str).join(' ').replace(/\s+/g,' ').trim() + '\n';
    });
  }
  return textoCompleto;
}


/* Parser de DANFE independente de layout ----------------------------------
   Emissores diferentes montam a tabela de produtos em ordens diferentes e
   nem sempre imprimem os mesmos rótulos ("IDENTIFICAÇÃO DO EMITENTE",
   "DADOS DOS PRODUTOS / SERVIÇOS"...). Por isso a extração aqui não procura
   textos fixos: procura ESTRUTURA — NCM (8 dígitos), CFOP (4 dígitos),
   unidade (sigla) e valores decimais na mesma linha. Isso vale para
   qualquer DANFE de texto (não serve para PDF escaneado/imagem).
------------------------------------------------------------------------- */

const NF_UNIDADES = ['UN','UND','UNID','PC','PÇ','CX','CXA','FR','FRC','AMP','KG','G','MG','ML','L','MT','M','M2','M3','PT','PAR','RL','TB','KIT','SC','GAL','DZ','LT','CT','BL','FD','JG','RS','SER','PCT','F/A','FA'];

function nfEhNumeroDecimal(token){
  return /^\d{1,3}(\.\d{3})*(,\d+)?$/.test(token) || /^\d+([.,]\d+)?$/.test(token);
}
function nfParaNumero(token){
  // "1.234,50" → 1234.50 · "1234.50" → 1234.50
  if(token.includes(',')) return parseFloat(token.replace(/\./g,'').replace(',','.'));
  return parseFloat(token);
}

function extrairDadosNfPdf(texto){
  const resultado = {fornecedor: null, numeroNf: null, itens: []};
  const linhas = texto.split('\n').map(l=>l.replace(/\s+/g,' ').trim()).filter(Boolean);

  /* ---------- Fornecedor (emitente) ---------- */
  // O CNPJ do emitente é sempre o primeiro do documento; o do destinatário
  // vem depois. Vale com ou sem o rótulo "CNPJ / CPF".
  const todosCnpj = [...texto.matchAll(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g)].map(m=>m[0]);
  const cnpjEmitente = todosCnpj[0] || null;

  // Nome: "RECEBEMOS DE {nome} OS PRODUTOS" é uma frase fixa, sempre no
  // topo, FORA da área de colunas (emitente/DANFE lado a lado) que
  // costuma embaralhar a reconstrução de linha — âncora bem mais
  // confiável que tentar ler o bloco "IDENTIFICAÇÃO DO EMITENTE" direto
  // (esse já causou nome errado 2x: "DANFE", depois "Fiscal Eletrônica",
  // por causa do layout em 2 colunas). Bloco antigo vira só fonte de
  // endereço/fallback.
  let nome = null, endereco = null;
  const ruido = /^DANFE$|DOCUMENTO AUXILIAR|NOTA FISCAL|FISCAL ELETR[ÔO]NICA|ENTRADA|SA[ÍI]DA|CHAVE DE ACESSO|CONSULTA DE AUTENTICIDADE|IDENTIFICA|RECEBEMOS DE|S[ÉE]RIE|FOLHA/i;

  const mRecebemos = texto.match(/RECEBEMOS DE\s+([\s\S]+?)\s+OS PRODUTOS/i);
  if(mRecebemos && mRecebemos[1]){
    // Junta quebra de linha eventual dentro do próprio nome (só espaço,
    // não deixa o \n aparecer no valor salvo).
    mRecebemos[1] = mRecebemos[1].replace(/\s+/g, ' ').trim();
  }
  if(mRecebemos && mRecebemos[1] && !ruido.test(mRecebemos[1]) && mRecebemos[1].length <= 80 && !/\d{2}\.\d{3}\.\d{3}/.test(mRecebemos[1])){
    nome = mRecebemos[1].trim();
  }

  const blocoEmitente = texto.match(/IDENTIFICA[ÇC][ÃA]O DO EMITENTE\s*([\s\S]+?)(?:DANFE|DOCUMENTO AUXILIAR)/i);
  if(blocoEmitente){
    const ls = blocoEmitente[1].split('\n').map(l=>l.trim()).filter(Boolean);
    // Layout em 2 colunas (comum em DANFE): "IDENTIFICAÇÃO DO EMITENTE" e
    // a caixa "DANFE" ficam lado a lado — na reconstrução de linha por
    // posição Y, às vezes grudam e a primeira linha capturada vira só
    // ruído ("DANFE", "Fiscal Eletrônica", etc.), não o nome de verdade.
    const candidata = ls.find(l => l.length >= 4 && !ruido.test(l));
    if(!nome && candidata) nome = candidata;
    if(candidata){
      const idx = ls.indexOf(candidata);
      // Se a linha achada é a mesma do nome (caso normal), endereço começa
      // DEPOIS dela. Se for diferente (nome veio de "RECEBEMOS DE" e essa
      // linha já é outra coisa, tipo início do endereço), inclui ela.
      const linhasEndereco = (candidata === nome) ? ls.slice(idx+1) : ls.slice(idx);
      endereco = linhasEndereco.filter(l=>!ruido.test(l)).join(', ') || null;
    }
  }
  if(!nome){
    const idxCnpj = linhas.findIndex(l => cnpjEmitente && l.includes(cnpjEmitente));
    const janela = linhas.slice(0, idxCnpj > 0 ? idxCnpj : 12);
    const candidatas = janela.filter(l => l.length >= 6 && /[A-Za-zÀ-ú]{4,}/.test(l) && !ruido.test(l) && !/^\d/.test(l));
    nome = candidatas.find(l => /(LTDA|S\.?A\b|ME\b|EIRELI|EPP|COM[EÉ]RCIO|DISTRIBUID|FARMA|IND[UÚ]STRIA)/i.test(l)) || candidatas[0] || null;
    const idxNome = linhas.indexOf(nome);
    if(idxNome >= 0){
      endereco = linhas.slice(idxNome+1, idxNome+4)
        .filter(l => /(RUA|AV|AVENIDA|ROD|ESTRADA|TRAV|PRA[ÇC]A|CEP|N[ºO°]|BAIRRO|\d{5}-?\d{3})/i.test(l))
        .join(', ') || null;
    }
  }

  const matchIE = texto.match(/INSCRI[ÇC][ÃA]O ESTADUAL\s*:?\s*([\d.\-\/]{6,20})/i)
               || texto.match(/\bI\.?\s?E\.?\s*:?\s*([\d.\-\/]{6,20})/i);

  if(nome || cnpjEmitente){
    resultado.fornecedor = {
      nome: nome || null,
      endereco: endereco || null,
      cnpj: cnpjEmitente,
      inscricao_estadual: matchIE ? matchIE[1].replace(/[^\d]/g,'') : null
    };
  }

  /* ---------- Número da NF ---------- */
  const mNf = texto.match(/N[ºO°]\.?\s*:?\s*(\d{1,3}\.\d{3}\.\d{3})/)        // 000.123.456
           || texto.match(/N[ºO°]\.?\s*:?\s*(\d{4,9})\b/)                    // 123456
           || texto.match(/N[UÚ]MERO\s*:?\s*(\d{4,9})\b/i);
  if(mNf) resultado.numeroNf = mNf[1];

  /* ---------- Data de emissão ---------- */
  const mData = texto.match(/DATA\s+D[AE]\s+EMISS[ÃA]O\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})/i)
             || texto.match(/EMISS[ÃA]O\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})/i)
             || texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);                    // qualquer data, último recurso
  if(mData) resultado.dataEmissao = `${mData[3]}-${mData[2]}-${mData[1]}`;

  /* ---------- Itens ---------- */
  // Restringe à área da tabela quando o rótulo existe; senão varre tudo e
  // deixa o filtro estrutural fazer o trabalho.
  let areaLinhas = linhas;
  const iniItens = linhas.findIndex(l => /DADOS DOS PRODUTOS|DESCRI[ÇC][ÃA]O DO PRODUTO|C[ÓO]D(IGO)?\s*(DO)?\s*PROD/i.test(l));
  if(iniItens >= 0){
    const restante = linhas.slice(iniItens+1);
    const fim = restante.findIndex(l => /DADOS ADICIONAIS|INFORMA[ÇC][ÕO]ES COMPLEMENTARES|C[ÁA]LCULO DO ISSQN|RESERVADO AO FISCO|Impresso em/i.test(l));
    areaLinhas = fim >= 0 ? restante.slice(0, fim) : restante;
  }

  const linhaRuim = /BASE DE C[ÁA]LCULO|VALOR TOTAL DA NOTA|VALOR DO FRETE|TOTAL DOS PRODUTOS|TRANSPORTADOR|DUPLICATA|VENCIMENTO|ICMS SUBSTITU|C[ÁA]LCULO DO IMPOSTO|CHAVE DE ACESSO|PROTOCOLO/i;

  areaLinhas.forEach(linha=>{
    if(linhaRuim.test(linha)) return;
    const tokens = linha.split(' ').filter(Boolean);

    // Âncora: NCM = token de exatamente 8 dígitos (ou 0000.00.00).
    let iNcm = tokens.findIndex(t => /^\d{8}$/.test(t) || /^\d{4}\.\d{2}\.\d{2}$/.test(t));
    if(iNcm <= 0) return;                       // sem NCM, ou NCM no início (não é item)

    // Unidade: primeira sigla conhecida depois do NCM.
    let iUnid = -1;
    for(let i = iNcm+1; i < tokens.length; i++){
      const t = tokens[i].toUpperCase().replace(/[^A-ZÇ0-9]/g,'');
      if(NF_UNIDADES.includes(t)){ iUnid = i; break; }
    }
    if(iUnid === -1) return;                    // sem unidade não dá pra confiar na linha

    // Valores: os três primeiros decimais depois da unidade = qtd, unit, total.
    const numeros = [];
    for(let i = iUnid+1; i < tokens.length && numeros.length < 3; i++){
      if(nfEhNumeroDecimal(tokens[i])) numeros.push(tokens[i]);
    }
    if(numeros.length < 3) return;

    // Código: primeiro token da linha se for código plausível.
    const codigo = /^[A-Z0-9.\-\/]{2,15}$/i.test(tokens[0]) && /\d/.test(tokens[0]) ? tokens[0] : null;
    if(!codigo) return;

    // Descrição: tudo entre o código e o NCM, limpo de resíduos comuns.
    const descricao = tokens.slice(1, iNcm).join(' ')
      .replace(/Lista\s*\([^)]*\)/gi,'')
      .replace(/PF:\s*[\d.,]+/gi,'')
      .replace(/\s+/g,' ').trim();
    if(!descricao) return;

    // Sanidade: qtd × unit ≈ total (tolerância 2%). Descarta linha em que
    // as colunas foram lidas fora de ordem.
    const [q, vu, vt] = numeros.map(nfParaNumero);
    if(q > 0 && vu > 0 && vt > 0 && Math.abs(q*vu - vt) / vt > 0.02) return;

    resultado.itens.push({
      codigo,
      descricao,
      unidade: tokens[iUnid].toUpperCase(),
      quantidade: numeros[0],
      valorUnit: numeros[1],
      valorTotal: numeros[2]
    });
  });

  // Remove duplicatas por código (DANFE de várias páginas repete cabeçalho).
  const vistos = new Set();
  resultado.itens = resultado.itens.filter(it => vistos.has(it.codigo) ? false : (vistos.add(it.codigo), true));

  return resultado;
}


/* =====================================================================
   IMPORTAR FORNECEDOR (PDF) — só extrai/cria o fornecedor. Não mexe em
   materiais aqui — isso é responsabilidade da aba Material.
===================================================================== */
let importacaoFornecedorPronta = false;
let importacaoFornecedorResultado = null;

function prepararImportacaoFornecedorPdf(){
  if(importacaoFornecedorPronta) return;
  importacaoFornecedorPronta = true;
  if(typeof pdfjsLib !== 'undefined'){
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  document.getElementById('fornecedor-pdf-arquivo').addEventListener('change', async (ev)=>{
    const status = document.getElementById('fornecedor-pdf-status');
    try{
      const arquivo = ev.target.files[0];
      if(!arquivo) return;
      status.style.color = 'var(--ink-400)'; status.textContent = 'Lendo PDF...';
      document.getElementById('fornecedor-pdf-revisao').style.display = 'none';
      if(typeof pdfjsLib === 'undefined'){
        status.style.color = 'var(--danger)';
        status.textContent = 'O leitor de PDF não carregou (rede/firewall?). Recarregue com internet e tente de novo.';
        return;
      }
      const bytes = await arquivo.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({data: bytes}).promise;
      const textoCompleto = await extrairTextoPdfComLinhas(pdf);
      document.getElementById('fornecedor-pdf-texto').value = textoCompleto;
      document.getElementById('fornecedor-pdf-texto-detalhes').style.display = 'block';

      const extraido = extrairDadosNfPdf(textoCompleto);
      if(!extraido.fornecedor){
        status.style.color = 'var(--danger)';
        status.textContent = textoCompleto.replace(/\s/g,'').length < 200
          ? 'Esse PDF não tem texto — é escaneado/imagem.'
          : 'Não identifiquei o fornecedor (emitente) nesse PDF — veja o texto extraído abaixo.';
        return;
      }

      const respForn = extraido.fornecedor.cnpj ? await api('buscarFornecedorPorCnpj', {cnpj: extraido.fornecedor.cnpj}) : {ok:true, fornecedor:null};
      importacaoFornecedorResultado = {fornecedor: extraido.fornecedor, fornecedorExistente: respForn.ok ? respForn.fornecedor : null};
      renderizarRevisaoFornecedorPdf();
      status.style.color = 'var(--teal-700)';
      status.textContent = 'Lido — revise abaixo antes de salvar.';
    }catch(e){
      console.error('[Importar Fornecedor] erro:', e);
      status.style.color = 'var(--danger)';
      status.textContent = 'Erro ao ler o PDF: ' + (e && e.message ? e.message : String(e));
    }
  });
}

function renderizarRevisaoFornecedorPdf(){
  const {fornecedor, fornecedorExistente} = importacaoFornecedorResultado;
  const div = document.getElementById('fornecedor-pdf-revisao');
  const esc = v => String(v==null?'':v).replace(/"/g,'&quot;');
  div.style.display = 'block';

  if(fornecedorExistente){
    div.innerHTML = `
      <p style="color:var(--teal-700);font-size:13px;font-weight:600;margin-top:16px;">Fornecedor já cadastrado: ${fornecedorExistente.nome} — não será duplicado.</p>
      <p style="font-size:12.5px;color:var(--ink-600);">CNPJ ${esc(fornecedorExistente.cnpj)} · IE ${esc(fornecedorExistente.inscricao_estadual)||'—'}</p>`;
    return;
  }
  div.innerHTML = `
    <h4 style="margin:16px 0 8px;">Fornecedor novo — confira antes de salvar</h4>
    <div class="grade-form">
      <div class="campo"><label>Nome / razão social</label><input type="text" id="revisao-forn-nome" value="${esc(fornecedor.nome)}"></div>
      <div class="campo"><label>CNPJ</label><input type="text" id="revisao-forn-cnpj" value="${esc(fornecedor.cnpj)}"></div>
      <div class="campo"><label>Inscrição estadual</label><input type="text" id="revisao-forn-ie" value="${esc(fornecedor.inscricao_estadual)}"></div>
      <div class="campo" style="grid-column:1/-1;"><label>Endereço</label><input type="text" id="revisao-forn-endereco" value="${esc(fornecedor.endereco)}"></div>
    </div>
    <div style="margin-top:16px;display:flex;align-items:center;gap:10px;">
      <button class="botao" id="botao-salvar-fornecedor-automatico">Salvar fornecedor</button>
      <span id="confirmacao-fornecedor-automatico" style="font-size:13px;color:var(--teal-700);font-weight:600;"></span>
    </div>`;

  document.getElementById('botao-salvar-fornecedor-automatico').addEventListener('click', async ()=>{
    const confirmacao = document.getElementById('confirmacao-fornecedor-automatico');
    const campo = id => (document.getElementById(id)?.value || '').trim() || null;
    confirmacao.style.color='var(--ink-400)'; confirmacao.textContent='Salvando...';
    const resp = await api('criarFornecedor', {
      nome: campo('revisao-forn-nome'), cnpj: campo('revisao-forn-cnpj'),
      inscricao_estadual: campo('revisao-forn-ie'), endereco: campo('revisao-forn-endereco')
    });
    if(!resp.ok){ confirmacao.style.color='var(--danger)'; confirmacao.textContent = resp.erro; return; }
    confirmacao.style.color = 'var(--teal-700)'; confirmacao.textContent = 'Salvo ✓';
    await carregarFornecedoresEstoque();
    renderizarFornecedores();
    importacaoFornecedorResultado = null;
    document.getElementById('fornecedor-pdf-arquivo').value = '';
    setTimeout(()=>{ document.getElementById('fornecedor-pdf-revisao').style.display = 'none'; }, 1500);
  });
}


/* =====================================================================
   IMPORTAR MATERIAIS + ENTRADA (PDF) — extrai os itens da NF, cadastra
   os materiais que ainda não existem (por código do fornecedor), e já
   registra a entrada de cada um (lote), com a quantidade da nota. NÃO
   cria fornecedor aqui — se o CNPJ não bater com nenhum já cadastrado,
   a entrada fica sem fornecedor vinculado (cadastra ele em Fornecedor
   primeiro, se quiser o vínculo).
===================================================================== */
let importacaoMaterialPronta = false;
let importacaoMaterialResultado = null;

function prepararImportacaoMaterialPdf(){
  if(importacaoMaterialPronta) return;
  importacaoMaterialPronta = true;
  if(typeof pdfjsLib !== 'undefined'){
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  document.getElementById('material-pdf-arquivo').addEventListener('change', async (ev)=>{
    const status = document.getElementById('material-pdf-status');
    try{
      const arquivo = ev.target.files[0];
      if(!arquivo) return;
      status.style.color = 'var(--ink-400)'; status.textContent = 'Lendo PDF...';
      document.getElementById('material-pdf-revisao').style.display = 'none';
      if(typeof pdfjsLib === 'undefined'){
        status.style.color = 'var(--danger)';
        status.textContent = 'O leitor de PDF não carregou (rede/firewall?). Recarregue com internet e tente de novo.';
        return;
      }
      const bytes = await arquivo.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({data: bytes}).promise;
      const textoCompleto = await extrairTextoPdfComLinhas(pdf);
      document.getElementById('material-pdf-texto').value = textoCompleto;
      document.getElementById('material-pdf-texto-detalhes').style.display = 'block';

      const extraido = extrairDadosNfPdf(textoCompleto);
      if(extraido.itens.length === 0){
        status.style.color = 'var(--danger)';
        status.textContent = textoCompleto.replace(/\s/g,'').length < 200
          ? 'Esse PDF não tem texto — é escaneado/imagem.'
          : 'Li o texto, mas não reconheci a tabela de produtos — veja o texto extraído abaixo.';
        return;
      }

      for(const item of extraido.itens){
        const respMat = await api('buscarMaterialPorCodigoFornecedor', {codigo_fornecedor: item.codigo});
        item.jaExiste = respMat.ok && !!respMat.material;
        item.materialId = item.jaExiste ? respMat.material.id : null;
      }

      // Fornecedor: se já existe (por CNPJ), só informa. Se NÃO existe,
      // pede autorização — só quem tem a permissão nova pode cadastrar
      // ele ali mesmo, na hora; sem a permissão, só avisa que precisa
      // pedir liberação ou cadastrar manualmente em Fornecedor.
      let avisoFornecedor = null;
      if(extraido.fornecedor && extraido.fornecedor.cnpj){
        const respForn = await api('buscarFornecedorPorCnpj', {cnpj: extraido.fornecedor.cnpj});
        const fornecedorExistente = respForn.ok ? respForn.fornecedor : null;
        if(fornecedorExistente){
          avisoFornecedor = {tipo:'existente', nome: fornecedorExistente.nome};
        } else if(temPermissao('autorizar_fornecedor_na_importacao')){
          const nomeFornecedor = extraido.fornecedor.nome || extraido.fornecedor.cnpj;
          if(confirm(`Fornecedor "${nomeFornecedor}" (CNPJ ${extraido.fornecedor.cnpj}) não está cadastrado. Cadastrar agora com os dados lidos da NF?`)){
            const respCriar = await api('criarFornecedor', {
              nome: extraido.fornecedor.nome, cnpj: extraido.fornecedor.cnpj,
              endereco: extraido.fornecedor.endereco, inscricao_estadual: extraido.fornecedor.inscricao_estadual
            });
            if(respCriar.ok){
              avisoFornecedor = {tipo:'criado', nome: respCriar.fornecedor.nome};
              await carregarFornecedoresEstoque();
            } else {
              avisoFornecedor = {tipo:'erro_criar', erro: respCriar.erro};
            }
          } else {
            avisoFornecedor = {tipo:'nao_cadastrado_recusado', nome: nomeFornecedor};
          }
        } else {
          avisoFornecedor = {tipo:'nao_cadastrado_sem_permissao', nome: extraido.fornecedor.nome || extraido.fornecedor.cnpj};
        }
      }

      importacaoMaterialResultado = {extraido, avisoFornecedor};
      renderizarRevisaoMaterialPdf();
      status.style.color = 'var(--teal-700)';
      status.textContent = `Lido — ${extraido.itens.length} itens encontrados. Revise abaixo antes de salvar.`;
    }catch(e){
      console.error('[Importar Material] erro:', e);
      status.style.color = 'var(--danger)';
      status.textContent = 'Erro ao ler o PDF: ' + (e && e.message ? e.message : String(e));
    }
  });
}

function renderizarRevisaoMaterialPdf(){
  const {extraido, avisoFornecedor} = importacaoMaterialResultado;
  const div = document.getElementById('material-pdf-revisao');
  div.style.display = 'block';

  const mensagensFornecedor = {
    existente: a => `<p style="font-size:12.5px;color:var(--teal-700);">Fornecedor já cadastrado: ${a.nome}.</p>`,
    criado: a => `<p style="font-size:12.5px;color:var(--teal-700);">Fornecedor "${a.nome}" cadastrado agora, com os dados da NF.</p>`,
    erro_criar: a => `<p style="font-size:12.5px;color:var(--danger);">Não consegui cadastrar o fornecedor: ${a.erro}</p>`,
    nao_cadastrado_recusado: a => `<p style="font-size:12.5px;color:var(--gold-600);">Fornecedor "${a.nome}" não foi cadastrado (você optou por não cadastrar agora).</p>`,
    nao_cadastrado_sem_permissao: a => `<p style="font-size:12.5px;color:var(--gold-600);">Fornecedor "${a.nome}" não está cadastrado, e você não tem permissão pra cadastrá-lo aqui — peça pra um gerente liberar "Autorizar cadastro de Fornecedor durante importação de Material" em Direitos e Privilégios, ou cadastre manualmente na aba Fornecedor.</p>`
  };
  const blocoFornecedor = avisoFornecedor ? mensagensFornecedor[avisoFornecedor.tipo](avisoFornecedor) : '';

  div.innerHTML = `
    ${blocoFornecedor}
    <h4 style="margin:16px 0 8px;">Itens encontrados (${extraido.itens.length}) — NF nº ${extraido.numeroNf||'?'}</h4>
    <p style="font-size:12.5px;color:var(--ink-400);">Só cadastra no catálogo — pra dar entrada no estoque, use "Registrar entrada por Nota Fiscal" (Cadastro Manual).</p>
    <div class="tabela-scroll"><table id="tabela-revisao-material">
      <thead><tr><th></th><th>Código</th><th>Nome</th><th>Unidade</th><th>Situação</th></tr></thead>
      <tbody>${extraido.itens.map(item=>`
        <tr data-codigo="${item.codigo}" data-ja-existe="${item.jaExiste?'1':'0'}" data-material-id="${item.materialId||''}">
          <td><input type="checkbox" class="chk-incluir-material" ${item.jaExiste?'':'checked'}></td>
          <td class="mono">${item.codigo}</td>
          <td><input type="text" class="input-revisao-material-nome" value="${item.descricao.replace(/"/g,'&quot;')}" ${item.jaExiste?'disabled':''} style="width:260px;padding:6px 9px;border:1.5px solid var(--line);border-radius:7px;"></td>
          <td><input type="text" class="input-revisao-material-unidade" value="${item.unidade}" ${item.jaExiste?'disabled':''} style="width:70px;padding:6px 9px;border:1.5px solid var(--line);border-radius:7px;"></td>
          <td>${item.jaExiste?'<span style="color:var(--ink-400);">Já no catálogo</span>':'<span style="color:var(--gold-600);">Material novo</span>'}</td>
        </tr>`).join('')}</tbody>
    </table></div>
    <div style="margin-top:16px;display:flex;align-items:center;gap:10px;">
      <button class="botao" id="botao-salvar-material-automatico">Salvar materiais</button>
      <span id="confirmacao-material-automatico" style="font-size:13px;color:var(--teal-700);font-weight:600;"></span>
    </div>`;

  document.getElementById('botao-salvar-material-automatico').addEventListener('click', async ()=>{
    const {extraido} = importacaoMaterialResultado;
    const confirmacao = document.getElementById('confirmacao-material-automatico');
    confirmacao.style.color = 'var(--ink-400)'; confirmacao.textContent = 'Salvando...';

    let materiaisCriados = 0, pulados = 0;
    const linhas = document.querySelectorAll('#tabela-revisao-material tbody tr');
    for(const linha of linhas){
      if(!linha.querySelector('.chk-incluir-material').checked){ pulados++; continue; }
      const jaExiste = linha.dataset.jaExiste === '1';
      if(jaExiste){ pulados++; continue; }
      const codigo = linha.dataset.codigo;
      const nome = linha.querySelector('.input-revisao-material-nome').value;
      const unidade = linha.querySelector('.input-revisao-material-unidade').value;
      const respMat = await api('criarMaterial', {nome, unidade, codigo_fornecedor: codigo, nf_origem: extraido.numeroNf});
      if(respMat.ok) materiaisCriados++;
    }

    await carregarMateriaisEstoque();
    await renderizarCatalogoMateriais();
    await carregarTabelaEntradas();

    confirmacao.style.color = 'var(--teal-700)';
    confirmacao.textContent = `Salvo ✓ — ${materiaisCriados} material(is) novo(s) cadastrado(s), ${pulados} já existiam ou foram desmarcados.`;
    importacaoMaterialResultado = null;
    document.getElementById('material-pdf-arquivo').value = '';
    setTimeout(()=>{ document.getElementById('material-pdf-revisao').style.display = 'none'; }, 2000);
  });
}

