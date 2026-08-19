/* =====================================================================
   ABA METAS — metas mensais por profissional (turnos disponibilizados,
   meta de valor, meta de quantidade) e a anotação livre "sugestões de
   melhoria" do período. Extraído de configuracoes.js (era junto porque
   as duas eram telas pequenas — deixou de fazer sentido depois que Metas
   passou a puxar o cartão de Financeiro/Plano de Contas em Configurações).
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


async function atualizarTabelaMetas(mes, ano){
  const respMetas = await api('listarMetas', {mes, ano});
  const metas = respMetas.metas||[];
  const profissionais = estado.listas.profissionais||[];
  const podeEditarMetas = temPermissao('editar_metas');
  const desabilitado = podeEditarMetas ? '' : 'disabled';
  const tabela = document.getElementById('tabela-metas');
  tabela.innerHTML = `
    <thead><tr><th>Profissional</th><th>Turnos disponibilizados</th><th>Meta de valor (R$)</th><th>Meta de qtde</th><th></th></tr></thead>
    <tbody>${profissionais.map(prof=>{
      const m = metas.find(x=>x.prof===prof) || {};
      return `<tr data-prof="${prof}">
        <td>${prof}</td>
        <td><input type="number" class="input-turnos" value="${m.turnos_disponibilizados||''}" ${desabilitado} style="width:90px;padding:6px;border-radius:6px;border:1.5px solid var(--line);"></td>
        <td><input type="number" class="input-meta" value="${m.meta_valor||''}" ${desabilitado} style="width:120px;padding:6px;border-radius:6px;border:1.5px solid var(--line);"></td>
        <td><input type="number" class="input-meta-qtd" value="${m.meta_qtd||''}" ${desabilitado} style="width:100px;padding:6px;border-radius:6px;border:1.5px solid var(--line);"></td>
        <td>${podeEditarMetas?'<button class="botao secundario pequeno botao-salvar-meta">Salvar</button>':''}</td>
      </tr>`;
    }).join('')}</tbody>`;


  if(!podeEditarMetas) return;


  tabela.querySelectorAll('.botao-salvar-meta').forEach(botao=>{
    botao.addEventListener('click', async (ev)=>{
      const linha = ev.target.closest('tr');
      await api('salvarMeta', {
        prof: linha.dataset.prof, mes, ano,
        turnos_disponibilizados: linha.querySelector('.input-turnos').value,
        meta_valor: linha.querySelector('.input-meta').value,
        meta_qtd: linha.querySelector('.input-meta-qtd').value
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
