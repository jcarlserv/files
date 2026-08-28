/* =====================================================================
   ProdClin — api.js
   Camada de API: fala com o Supabase de verdade (supabaseApi) ou com o mock de demonstração
   (mockApi), sempre através da função api(acao, dados). Contém também os helpers de paginação
   e de conversão de datas/mês usados por todo o resto do sistema.
   Este arquivo é carregado via <script src> em index.html, na mesma ordem
   em que aparecia originalmente dentro do <script> único — variáveis e
   funções continuam compartilhando o escopo global, exatamente como antes.
===================================================================== */



/* ---------------------------------------------------------------------
   CAMADA DE API — chama o Supabase de verdade, ou o mock de demo
--------------------------------------------------------------------- */
let chamadasApiEmAndamento = 0;
function mostrarBarraProgresso(mostrar){
  const el = document.getElementById('barra-progresso-topo');
  if(mostrar){
    chamadasApiEmAndamento++;
  } else {
    chamadasApiEmAndamento = Math.max(0, chamadasApiEmAndamento-1);
  }
  el.classList.toggle('ativa', chamadasApiEmAndamento>0);
}


async function api(acao, dados={}) {
  mostrarBarraProgresso(true);
  try {
    if (MODO_DEMO) return await mockApi(acao, dados);
    return await supabaseApi(acao, dados);
  } catch(e) {
    return {ok:false, erro: String((e&&e.message)||e)};
  } finally {
    mostrarBarraProgresso(false);
  }
}


/* Converte um nome de mês + ano no primeiro e último dia daquele mês, em
   ISO (yyyy-MM-dd) — usado para mandar o filtro de período DIRETO pro
   Supabase (gte/lte na própria query), em vez de buscar o ano inteiro e
   filtrar o mês depois no navegador. Buscar o ano inteiro é o que fazia
   o Dashboard/Análises/Crítica sofrerem corte silencioso quando o total
   de linhas do ano passava do limite de retorno de uma única consulta do
   Supabase (o banco corta e não avisa — some com dados sem dar erro). */
function primeiroEUltimoDiaDoMes(nomeMes, ano){
  const idx = MESES.indexOf(nomeMes);
  if(idx===-1 || !ano) return {dataInicio:null, dataFim:null};
  const primeiro = new Date(Number(ano), idx, 1);
  const ultimo = new Date(Number(ano), idx+1, 0);
  const paraISO = d => d.toISOString().slice(0,10);
  return {dataInicio: paraISO(primeiro), dataFim: paraISO(ultimo)};
}


/* Busca produção em PÁGINAS de 1000 linhas até trazer tudo, em vez de uma
   chamada só — necessário para buscas por ano inteiro (RMR, Evolução do
   ano), que só com uma chamada normal correm o mesmo risco de corte
   silencioso do Supabase citado acima. Uma única chamada de listarProducao
   já é segura quando o período é curto (um mês), mas não quando é um ano. */
async function buscarProducaoCompleta(paramsBase){
  const TAMANHO_PAGINA = 1000;
  let todos = [];
  let pagina = 0;
  while(true){
    const resp = await api('listarProducao', Object.assign({}, paramsBase, {
      limitePagina: TAMANHO_PAGINA, offsetPagina: pagina*TAMANHO_PAGINA
    }));
    if(!resp.ok) return resp;
    const lote = resp.registros || [];
    todos = todos.concat(lote);
    if(lote.length < TAMANHO_PAGINA) break; // última página (veio menos que o tamanho cheio)
    pagina++;
    if(pagina > 50) break; // trava de segurança (50 mil linhas) contra loop infinito
  }
  return {ok:true, registros: todos};
}


/* ---------------------------------------------------------------------
   Auxiliares de conversão mês (nome <-> número) e mês/ano a partir da data
   — a tabela do Supabase guarda "data" (yyyy-MM-dd) e "mes" como número
   nas metas/notas; o front-end inteiro trabalha com nomes de mês
   (ex.: "Maio") e com r.mes/r.ano em cada registro de produção, então
   fazemos essa ponte aqui em vez de mudar o resto do código.
--------------------------------------------------------------------- */
function nomeMesParaNumero(nome){
  const i = MESES.indexOf(nome);
  return i>-1 ? i+1 : null;
}
function numeroMesParaNome(num){
  return MESES[Number(num)-1] || '';
}
function anexarMesAnoPelaData(registro){
  if(registro && registro.data){
    const [ano, mes] = String(registro.data).slice(0,10).split('-');
    registro.mes = numeroMesParaNome(Number(mes));
    registro.ano = Number(ano);
  }
  return registro;
}


// Converte uma lista de linhas [{<campoChave>, <campoValor>}] (vinda de
// profissionais_andares, profissionais_procedimentos ou
// atendentes_profissionais) num mapa {chave: [valor1, valor2, ...]} —
// usado pelas travas de formulário. campoChave é opcional e default 'prof'
// (mantém compatível com as chamadas mais antigas, que só agrupavam por
// profissional).
function agruparProfPorCampo(linhas, campoValor, campoChave){
  campoChave = campoChave || 'prof';
  const mapa = {};
  (linhas||[]).forEach(l=>{
    if(!l || !l[campoChave] || !l[campoValor]) return;
    if(!mapa[l[campoChave]]) mapa[l[campoChave]] = [];
    mapa[l[campoChave]].push(l[campoValor]);
  });
  return mapa;
}


// Busca numa lista agrupada (ver agruparProfPorCampo) tolerando diferença de
// maiúsculas/minúsculas e espaços nas pontas. As travas do formulário cruzam
// 3 fontes digitadas em lugares diferentes — usuarios.nome_profissional (login
// do atendente/profissional), a lista em Configurações > Listas, e a matriz
// de vínculos (Configurações > Atendentes/Andares/Procedimentos/Exames por
// profissional) — um espaço a mais ou uma letra maiúscula digitada diferente
// em qualquer uma delas já fazia a busca exata falhar silenciosamente
// (lista aparecia vazia mesmo com o vínculo certinho salvo no banco).
function buscarListaTolerante(mapa, chave){
  if(!chave) return [];
  if(mapa[chave]) return mapa[chave]; // caminho rápido: bateu exato
  const alvo = String(chave).trim().toUpperCase();
  const chaveEncontrada = Object.keys(mapa).find(k => String(k).trim().toUpperCase()===alvo);
  return chaveEncontrada ? mapa[chaveEncontrada] : [];
}


/* ---------------------------------------------------------------------
   CAMADA SUPABASE — substitui as ações que antes iam para o Code.gs
--------------------------------------------------------------------- */
async function supabaseApi(acao, dados) {
  switch(acao){
    case 'login': {
      const { data, error } = await supabaseClient.from('usuarios').select('*')
        .eq('usuario', dados.usuario).eq('senha', dados.senha).maybeSingle();
      if(error) return {ok:false, erro:error.message};
      if(!data) return {ok:false, erro:'Usuário ou senha inválidos.'};
      let permissoes = {};
      if(data.papel !== 'gerente'){
        const { data: sobrescritas, error: errPerm } = await supabaseClient.from('permissoes')
          .select('chave, valor').eq('usuario', data.usuario);
        if(errPerm) return {ok:false, erro:errPerm.message};
        permissoes = calcularPermissoesEfetivas(data.papel, sobrescritas);
      }
      return {ok:true, usuario:data.usuario, papel:data.papel, nomeProfissional:data.nome_profissional, permissoes};
    }


    case 'listarListas': {
      const { data, error } = await supabaseClient.from('listas').select('*').order('ordem');
      if(error) return {ok:false, erro:error.message};
      const listas = {};
      (data||[]).forEach(item=>{
        if(!listas[item.tipo]) listas[item.tipo] = [];
        listas[item.tipo].push(item.valor);
      });
      return {ok:true, listas};
    }


    case 'adicionarItemLista': {
      const { data: existentes, error: errBusca } = await supabaseClient.from('listas').select('valor').eq('tipo', dados.coluna);
      if(errBusca) return {ok:false, erro:errBusca.message};
      const jaExiste = (existentes||[]).some(v=>String(v.valor).trim().toUpperCase()===String(dados.valor).trim().toUpperCase());
      if(jaExiste) return {ok:false, erro:'Esse item já existe nessa lista.'};
      const { error } = await supabaseClient.from('listas').insert({tipo:dados.coluna, valor:dados.valor, ordem:(existentes||[]).length+1});
      return error ? {ok:false, erro:error.message} : {ok:true};
    }


    case 'removerItemLista': {
      const { error } = await supabaseClient.from('listas').delete().eq('tipo', dados.coluna).eq('valor', dados.valor);
      return error ? {ok:false, erro:error.message} : {ok:true};
    }


    case 'listarProducao': {
      let query = supabaseClient.from('producao').select('*');
      if(dados.dataInicio) query = query.gte('data', dados.dataInicio);
      if(dados.dataFim) query = query.lte('data', dados.dataFim);
      if(!dados.dataInicio && !dados.dataFim && dados.ano){
        query = query.gte('data', `${dados.ano}-01-01`).lte('data', `${dados.ano}-12-31`);
      }
      if(dados.prof) query = query.eq('prof', dados.prof);
      if(dados.limite) query = query.limit(Number(dados.limite));
      // Paginação (usada por buscarProducaoCompleta, para buscas de ano
      // inteiro que passariam do limite de linhas de uma consulta só) —
      // independente do "limite" acima, que é usado em outros lugares
      // (ex.: "Meus últimos lançamentos", limite:15).
      if(dados.limitePagina){
        const deslocamento = Number(dados.offsetPagina)||0;
        query = query.range(deslocamento, deslocamento + Number(dados.limitePagina) - 1);
      }
      const { data, error } = await query.order('data', {ascending:false});
      if(error) return {ok:false, erro:error.message};
      let registros = (data||[]).map(anexarMesAnoPelaData);
      if(dados.mes) registros = registros.filter(r=>r.mes===dados.mes);
      return {ok:true, registros};
    }


    case 'adicionarProducao': {
      const registro = Object.assign({}, dados);
      delete registro.id; delete registro.mes; delete registro.ano; delete registro.timestamp;
      if(registro.valor !== undefined) registro.valor = Number(registro.valor)||0;
      const { data, error } = await supabaseClient.from('producao').insert(registro).select().single();
      if(error) return {ok:false, erro:error.message};
      return {ok:true, registro:anexarMesAnoPelaData(data)};
    }


    case 'atualizarProducao': {
      const registro = Object.assign({}, dados.registro);
      delete registro.id; delete registro.mes; delete registro.ano; delete registro.timestamp;
      if(registro.valor !== undefined) registro.valor = Number(registro.valor)||0;
      const { error } = await supabaseClient.from('producao').update(registro).eq('id', dados.id);
      return error ? {ok:false, erro:error.message} : {ok:true};
    }


    case 'excluirProducao': {
      const { error } = await supabaseClient.from('producao').delete().eq('id', dados.id);
      return error ? {ok:false, erro:error.message} : {ok:true};
    }


    case 'listarMetas': {
      let query = supabaseClient.from('metas').select('*');
      const mesNum = nomeMesParaNumero(dados.mes);
      if(mesNum) query = query.eq('mes', mesNum);
      if(dados.ano) query = query.eq('ano', dados.ano);
      const { data, error } = await query;
      if(error) return {ok:false, erro:error.message};
      const metas = (data||[]).map(m=>Object.assign({}, m, {mes:numeroMesParaNome(m.mes)}));
      return {ok:true, metas};
    }


    case 'salvarMeta': {
      const registro = {
        prof: dados.prof,
        mes: nomeMesParaNumero(dados.mes),
        ano: Number(dados.ano),
        turnos_utilizados: Number(dados.turnos_utilizados)||0,
        valor_minimo_turno: Number(dados.valor_minimo_turno)||0
      };
      const { error } = await supabaseClient.from('metas').upsert(registro, {onConflict:'prof,mes,ano'});
      return error ? {ok:false, erro:error.message} : {ok:true};
    }


    case 'obterNota': {
      const { data, error } = await supabaseClient.from('notas').select('texto')
        .eq('mes', nomeMesParaNumero(dados.mes)).eq('ano', dados.ano).maybeSingle();
      if(error) return {ok:false, erro:error.message};
      return {ok:true, texto: data ? data.texto : ''};
    }


    case 'salvarNota': {
      const { error } = await supabaseClient.from('notas').upsert(
        {mes:nomeMesParaNumero(dados.mes), ano:Number(dados.ano), texto:dados.texto},
        {onConflict:'mes,ano'}
      );
      return error ? {ok:false, erro:error.message} : {ok:true};
    }


    case 'obterConfiguracoes': {
      const { data, error } = await supabaseClient.from('configuracoes').select('*');
      if(error) return {ok:false, erro:error.message};
      const configuracoes = {};
      (data||[]).forEach(c=>configuracoes[c.chave]=c.valor);
      return {ok:true, configuracoes};
    }


    case 'salvarConfiguracao': {
      const { error } = await supabaseClient.from('configuracoes').upsert({chave:dados.chave, valor:dados.valor});
      return error ? {ok:false, erro:error.message} : {ok:true};
    }


    case 'alterarConta': {
      const { data: usuario, error: errBusca } = await supabaseClient.from('usuarios').select('*')
        .eq('usuario', dados.usuario).eq('senha', dados.senhaAtual).maybeSingle();
      if(errBusca) return {ok:false, erro:errBusca.message};
      if(!usuario) return {ok:false, erro:'Senha atual incorreta.'};
      const atualizacao = {};
      if(dados.novoNome) atualizacao.nome_profissional = dados.novoNome;
      if(dados.novaSenha) atualizacao.senha = dados.novaSenha;
      const { error } = await supabaseClient.from('usuarios').update(atualizacao).eq('usuario', dados.usuario);
      if(error) return {ok:false, erro:error.message};
      return {ok:true, nomeProfissional: dados.novoNome || usuario.nome_profissional};
    }


    // Direitos e Privilégios — lista todo usuário que não seja gerente (o gerente já
    // tem acesso completo por papel, não precisa de permissão individual nenhuma),
    // com a permissão EFETIVA de cada chave (padrão do papel + sobrescritas).
    case 'listarPermissoesTodos': {
      const { data: usuarios, error: errUsuarios } = await supabaseClient.from('usuarios')
        .select('usuario, papel, nome_profissional').order('nome_profissional');
      if(errUsuarios) return {ok:false, erro:errUsuarios.message};
      const { data: todasSobrescritas, error: errPerm } = await supabaseClient.from('permissoes').select('*');
      if(errPerm) return {ok:false, erro:errPerm.message};
      const resultado = (usuarios||[]).map(u=>{
        const sobrescritasDoUsuario = (todasSobrescritas||[]).filter(s=>s.usuario===u.usuario);
        return Object.assign({}, u, { permissoes: calcularPermissoesEfetivas(u.papel, sobrescritasDoUsuario) });
      });
      return {ok:true, usuarios:resultado};
    }


    case 'definirPermissao': {
      const { error } = await supabaseClient.from('permissoes')
        .upsert({ usuario: dados.usuario, chave: dados.chave, valor: !!dados.valor }, { onConflict: 'usuario,chave' });
      return error ? {ok:false, erro:error.message} : {ok:true};
    }


    // Andares por profissional — cadastro (n:n) usado pra travar/filtrar o
    // campo "Andar" de acordo com o "Profissional" escolhido no Lançamento
    // e no modal de edição. Tabela pequena (poucos andares), sem paginação.
    // ---------- PACIENTES ----------
    // ---------- ESTOQUE — Fornecedores ----------
    case 'listarFornecedores': {
      const { data, error } = await supabaseClient.from('fornecedores').select('*').order('nome');
      if(error) return {ok:false, erro:error.message};
      return {ok:true, fornecedores: data||[]};
    }
    case 'criarFornecedor': {
      const { data, error } = await supabaseClient.from('fornecedores')
        .insert({nome:dados.nome, cnpj:dados.cnpj||null, contato:dados.contato||null}).select().single();
      if(error) return {ok:false, erro:error.message};
      return {ok:true, fornecedor:data};
    }
    case 'atualizarFornecedor': {
      const { error } = await supabaseClient.from('fornecedores')
        .update({nome:dados.nome, cnpj:dados.cnpj||null, contato:dados.contato||null}).eq('id', dados.id);
      return error ? {ok:false, erro:error.message} : {ok:true};
    }

    // ---------- ESTOQUE — Materiais (catálogo) ----------
    case 'listarMateriais': {
      const { data, error } = await supabaseClient.from('materiais').select('*').order('nome');
      if(error) return {ok:false, erro:error.message};
      return {ok:true, materiais: data||[]};
    }
    case 'criarMaterial': {
      const { data, error } = await supabaseClient.from('materiais')
        .insert({nome:dados.nome, categoria:dados.categoria||null, unidade:dados.unidade||'unidade', estoque_minimo:Number(dados.estoque_minimo)||0})
        .select().single();
      if(error) return {ok:false, erro:error.message};
      return {ok:true, material:data};
    }
    case 'atualizarMaterial': {
      const { error } = await supabaseClient.from('materiais')
        .update({nome:dados.nome, categoria:dados.categoria||null, unidade:dados.unidade||'unidade', estoque_minimo:Number(dados.estoque_minimo)||0, ativo:dados.ativo!==false})
        .eq('id', dados.id);
      return error ? {ok:false, erro:error.message} : {ok:true};
    }

    // ---------- ESTOQUE — Entrada por NF (cria um lote) ----------
    case 'criarEntradaEstoque': {
      const { data, error } = await supabaseClient.from('estoque_lotes').insert({
        material_id: dados.material_id, fornecedor_id: dados.fornecedor_id||null,
        lote: dados.lote||null, nota_fiscal: dados.nota_fiscal||null,
        data_entrada: dados.data_entrada || new Date().toISOString().slice(0,10),
        validade: dados.validade||null,
        quantidade_entrada: Number(dados.quantidade)||0, quantidade_atual: Number(dados.quantidade)||0,
        valor_unitario: dados.valor_unitario ? Number(dados.valor_unitario) : null
      }).select().single();
      if(error) return {ok:false, erro:error.message};
      return {ok:true, lote:data};
    }

    // ---------- ESTOQUE — Posição atual (soma dos lotes vivos por material) ----------
    case 'obterPosicaoEstoque': {
      const [materiaisResp, lotesResp] = await Promise.all([
        supabaseClient.from('materiais').select('*').eq('ativo', true).order('nome'),
        supabaseClient.from('estoque_lotes').select('*').gt('quantidade_atual', 0)
      ]);
      if(materiaisResp.error) return {ok:false, erro:materiaisResp.error.message};
      if(lotesResp.error) return {ok:false, erro:lotesResp.error.message};
      return {ok:true, materiais: materiaisResp.data||[], lotes: lotesResp.data||[]};
    }

    // ---------- ESTOQUE — Solicitações ----------
    case 'criarSolicitacaoMaterial': {
      const { data, error } = await supabaseClient.from('solicitacoes_material').insert({
        material_id: dados.material_id, profissional_id: dados.profissional_id||null,
        procedimento: dados.procedimento||null, exame: dados.exame||null,
        quantidade: Number(dados.quantidade)||0, observacao: dados.observacao||null,
        solicitado_por: dados.solicitado_por||null
      }).select().single();
      if(error) return {ok:false, erro:error.message};
      return {ok:true, solicitacao:data};
    }
    case 'listarSolicitacoesMaterial': {
      let query = supabaseClient.from('solicitacoes_material').select('*, materiais(nome, unidade), profissionais(nome)').order('solicitado_em', {ascending:false});
      if(Array.isArray(dados.status)) query = query.in('status', dados.status);
      else if(dados.status) query = query.eq('status', dados.status);
      if(dados.solicitado_por) query = query.eq('solicitado_por', dados.solicitado_por);
      const { data, error } = await query;
      if(error) return {ok:false, erro:error.message};
      return {ok:true, solicitacoes: data||[]};
    }
    case 'negarSolicitacaoMaterial': {
      const { error } = await supabaseClient.from('solicitacoes_material')
        .update({status:'negado', observacao: dados.motivo||null}).eq('id', dados.id);
      return error ? {ok:false, erro:error.message} : {ok:true};
    }

    // ---------- ESTOQUE — Dispensação (baixa FEFO — consome o lote que vence primeiro) ----------
    case 'dispensarSolicitacao': {
      const { data: solicitacao, error: errSol } = await supabaseClient.from('solicitacoes_material')
        .select('*').eq('id', dados.id).maybeSingle();
      if(errSol) return {ok:false, erro:errSol.message};
      if(!solicitacao) return {ok:false, erro:'Solicitação não encontrada.'};
      if(solicitacao.status !== 'pendente') return {ok:false, erro:'Essa solicitação já foi resolvida.'};

      const [{ data: lotes, error: errLotes }, { data: reservados, error: errRes }] = await Promise.all([
        supabaseClient.from('estoque_lotes').select('*').eq('material_id', solicitacao.material_id).gt('quantidade_atual', 0)
          .order('validade', {ascending:true, nullsFirst:false}),
        supabaseClient.from('dispensacoes').select('lote_id, quantidade').eq('status', 'reservado')
      ]);
      if(errLotes) return {ok:false, erro:errLotes.message};
      if(errRes) return {ok:false, erro:errRes.message};

      const reservadoPorLote = {};
      (reservados||[]).forEach(r=>{ reservadoPorLote[r.lote_id] = (reservadoPorLote[r.lote_id]||0) + Number(r.quantidade); });
      const lotesComDisponivel = (lotes||[]).map(l=>({
        ...l, disponivel: Number(l.quantidade_atual) - (reservadoPorLote[l.id]||0)
      })).filter(l=>l.disponivel > 0);

      const totalDisponivel = lotesComDisponivel.reduce((s,l)=>s+l.disponivel, 0);
      if(totalDisponivel < Number(solicitacao.quantidade)){
        return {ok:false, erro:`Estoque insuficiente — disponível: ${totalDisponivel}, solicitado: ${solicitacao.quantidade}.`};
      }

      // NÃO baixa o estoque aqui — só reserva (dispensacoes com status
      // 'reservado'). A baixa de verdade só acontece quando o solicitante
      // confirma o recebimento (ver 'confirmarRecebimentoSolicitacao').
      let restante = Number(solicitacao.quantidade);
      for(const lote of lotesComDisponivel){
        if(restante<=0) break;
        const usar = Math.min(restante, lote.disponivel);
        const { error: errDisp } = await supabaseClient.from('dispensacoes').insert({
          solicitacao_id: dados.id, lote_id: lote.id, quantidade: usar,
          dispensado_por: dados.dispensado_por||null, status: 'reservado'
        });
        if(errDisp) return {ok:false, erro:errDisp.message};
        restante -= usar;
      }

      const { error: errStatus } = await supabaseClient.from('solicitacoes_material')
        .update({status:'dispensado'}).eq('id', dados.id);
      return errStatus ? {ok:false, erro:errStatus.message} : {ok:true};
    }

    // Solicitante confirma que recebeu — SÓ AQUI a baixa de estoque
    // acontece de fato. Marca as reservas como 'confirmado' e desconta de
    // estoque_lotes.quantidade_atual.
    case 'confirmarRecebimentoSolicitacao': {
      const { data: solicitacao, error: errSol } = await supabaseClient.from('solicitacoes_material')
        .select('*').eq('id', dados.id).maybeSingle();
      if(errSol) return {ok:false, erro:errSol.message};
      if(!solicitacao) return {ok:false, erro:'Solicitação não encontrada.'};
      if(solicitacao.status !== 'dispensado') return {ok:false, erro:'Essa solicitação não está aguardando confirmação.'};

      const { data: reservas, error: errRes } = await supabaseClient.from('dispensacoes')
        .select('*').eq('solicitacao_id', dados.id).eq('status', 'reservado');
      if(errRes) return {ok:false, erro:errRes.message};

      for(const reserva of (reservas||[])){
        const { data: lote } = await supabaseClient.from('estoque_lotes').select('quantidade_atual').eq('id', reserva.lote_id).maybeSingle();
        if(!lote) continue;
        const { error: errBaixa } = await supabaseClient.from('estoque_lotes')
          .update({quantidade_atual: Number(lote.quantidade_atual) - Number(reserva.quantidade)}).eq('id', reserva.lote_id);
        if(errBaixa) return {ok:false, erro:errBaixa.message};
        await supabaseClient.from('dispensacoes').update({status:'confirmado'}).eq('id', reserva.id);
      }

      const { error: errStatus } = await supabaseClient.from('solicitacoes_material').update({
        status:'confirmado', confirmado_por: dados.confirmado_por||null,
        confirmado_em: new Date().toISOString(), observacao_recebimento: dados.observacao||null
      }).eq('id', dados.id);
      return errStatus ? {ok:false, erro:errStatus.message} : {ok:true};
    }


    case 'buscarPacientes': {
      const termo = String(dados.termo||'').trim();
      const campo = dados.campo === 'carteirinha' ? 'carteirinha' : 'nome'; // padrão: nome
      let query = supabaseClient.from('pacientes').select('*').order('nome').limit(30);
      if(termo) query = query.ilike(campo, `%${termo}%`);
      const { data, error } = await query;
      if(error) return {ok:false, erro:error.message};
      return {ok:true, pacientes: data||[]};
    }

    // ---------- VÍNCULO PACIENTE × CONVÊNIO (Unimed) ----------
    // Fila de revisão manual — nada aqui é automático. "Próximo pendente"
    // pega o primeiro beneficiário do faturamento que ainda não foi
    // confirmado NEM pulado (paciente_convenio_vinculo é o registro de
    // "já revisado", nos dois casos).
    // Busca só informativa — mostra beneficiários da Unimed com nome
    // parecido, pra conferência visual (não seleciona nada sozinho).
    case 'buscarBeneficiariosUnimedPorNome': {
      const termo = String(dados.termo||'').trim();
      if(termo.length < 2) return {ok:true, beneficiarios: []};
      const { data, error } = await supabaseClient.from('faturamento_notas')
        .select('cartao_beneficiario, nome_beneficiario')
        .ilike('nome_beneficiario', `%${termo}%`)
        .not('cartao_beneficiario', 'is', null)
        .limit(60);
      if(error) return {ok:false, erro:error.message};
      const vistos = new Set();
      const distintos = [];
      (data||[]).forEach(r=>{
        const cartao = String(r.cartao_beneficiario||'').trim();
        if(!cartao || vistos.has(cartao)) return;
        vistos.add(cartao);
        distintos.push({cartao_beneficiario: cartao, nome_beneficiario: r.nome_beneficiario});
      });
      return {ok:true, beneficiarios: distintos.slice(0,10)};
    }

    case 'obterProximoBeneficiarioPendente': {
      const [todosResp, revisadosResp] = await Promise.all([
        supabaseClient.from('faturamento_notas').select('cartao_beneficiario, nome_beneficiario').not('cartao_beneficiario', 'is', null),
        supabaseClient.from('paciente_convenio_vinculo').select('cartao_beneficiario')
      ]);
      if(todosResp.error) return {ok:false, erro:todosResp.error.message};
      if(revisadosResp.error) return {ok:false, erro:revisadosResp.error.message};
      const jaRevisados = new Set((revisadosResp.data||[]).map(r=>r.cartao_beneficiario));
      const vistos = new Set();
      const pendentes = [];
      (todosResp.data||[]).forEach(r=>{
        const cartao = String(r.cartao_beneficiario||'').trim();
        if(!cartao || vistos.has(cartao) || jaRevisados.has(cartao)) return;
        vistos.add(cartao);
        pendentes.push({cartao_beneficiario: cartao, nome_beneficiario: r.nome_beneficiario});
      });
      return {ok:true, beneficiario: pendentes[0]||null, restantes: pendentes.length};
    }

    case 'confirmarVinculoPaciente': {
      const { error: errVinculo } = await supabaseClient.from('paciente_convenio_vinculo').insert({
        cartao_beneficiario: dados.cartao_beneficiario, nome_beneficiario: dados.nome_beneficiario||null,
        paciente_id: dados.paciente_id, status: 'vinculado'
      });
      if(errVinculo) return {ok:false, erro:errVinculo.message};
      // Só preenche carteirinha/convênio do paciente se ainda estiverem
      // vazios — nunca sobrescreve o que já foi cadastrado (manual ou de
      // uma vinculação anterior). Convênio vira "Unimed" porque é
      // exatamente de onde esse beneficiário veio.
      const { data: paciente } = await supabaseClient.from('pacientes').select('carteirinha, convenio').eq('id', dados.paciente_id).maybeSingle();
      const atualizacoes = {};
      if(paciente && (!paciente.carteirinha || !String(paciente.carteirinha).trim())) atualizacoes.carteirinha = dados.cartao_beneficiario;
      if(paciente && (!paciente.convenio || !String(paciente.convenio).trim())) atualizacoes.convenio = 'Unimed';
      if(Object.keys(atualizacoes).length){
        await supabaseClient.from('pacientes').update(atualizacoes).eq('id', dados.paciente_id);
      }
      return {ok:true};
    }

    case 'pularBeneficiarioVinculo': {
      const { error } = await supabaseClient.from('paciente_convenio_vinculo').insert({
        cartao_beneficiario: dados.cartao_beneficiario, nome_beneficiario: dados.nome_beneficiario||null,
        paciente_id: null, status: 'pulado'
      });
      return error ? {ok:false, erro:error.message} : {ok:true};
    }


    case 'obterPaciente': {
      const { data, error } = await supabaseClient.from('pacientes').select('*').eq('id', dados.id).maybeSingle();
      if(error) return {ok:false, erro:error.message};
      return {ok:true, paciente: data};
    }

    case 'criarPaciente': {
      const nome = String(dados.nome||'').trim();
      if(!nome) return {ok:false, erro:'Nome do paciente é obrigatório.'};
      // Idempotente: se já existe um paciente com esse nome (case-insensitive),
      // reaproveita em vez de criar duplicado — importante porque isso é
      // chamado toda vez que um lançamento novo tem um nome digitado sem
      // ter sido escolhido no autocompletar.
      const existente = await supabaseClient.from('pacientes').select('*').ilike('nome', nome).maybeSingle();
      if(existente.data) return {ok:true, paciente: existente.data};
      const { data, error } = await supabaseClient.from('pacientes')
        .insert({ nome, whatsapp: dados.whatsapp||null, endereco: dados.endereco||null, convenio: dados.convenio||null, carteirinha: dados.carteirinha||null, data_nascimento: dados.data_nascimento||null, cpf: dados.cpf||null })
        .select().single();
      if(error) return {ok:false, erro:error.message};
      return {ok:true, paciente: data};
    }

    case 'atualizarPaciente': {
      const { error } = await supabaseClient.from('pacientes')
        .update({ nome: dados.nome, whatsapp: dados.whatsapp||null, endereco: dados.endereco||null, convenio: dados.convenio||null, carteirinha: dados.carteirinha||null, data_nascimento: dados.data_nascimento||null, cpf: dados.cpf||null })
        .eq('id', dados.id);
      return error ? {ok:false, erro:error.message} : {ok:true};
    }

    // ---------- PROFISSIONAIS (cadastro) ----------
    case 'listarProfissionaisCadastro': {
      const { data, error } = await supabaseClient.from('profissionais').select('*').order('nome');
      if(error) return {ok:false, erro:error.message};
      return {ok:true, profissionais: data||[]};
    }

    case 'criarProfissionalCadastro': {
      const { data, error } = await supabaseClient.from('profissionais')
        .insert({ nome: dados.nome, telefone: dados.telefone||null, registro_profissional: dados.registro_profissional||null, especialidade: dados.especialidade||null })
        .select().single();
      if(error) return {ok:false, erro:error.message};
      return {ok:true, profissional: data};
    }

    case 'atualizarProfissionalCadastro': {
      const { error } = await supabaseClient.from('profissionais')
        .update({ telefone: dados.telefone||null, registro_profissional: dados.registro_profissional||null, especialidade: dados.especialidade||null })
        .eq('id', dados.id);
      return error ? {ok:false, erro:error.message} : {ok:true};
    }


    case 'listarProfissionaisAndares': {
      const { data, error } = await supabaseClient.from('profissionais_andares').select('prof, andar');
      if(error) return {ok:false, erro:error.message};
      return {ok:true, linhas: data||[]};
    }


    case 'definirProfissionalAndar': {
      if(dados.valor){
        const { error } = await supabaseClient.from('profissionais_andares')
          .upsert({ prof: dados.prof, andar: dados.andar }, { onConflict: 'prof,andar' });
        return error ? {ok:false, erro:error.message} : {ok:true};
      } else {
        const { error } = await supabaseClient.from('profissionais_andares')
          .delete().eq('prof', dados.prof).eq('andar', dados.andar);
        return error ? {ok:false, erro:error.message} : {ok:true};
      }
    }


    // Procedimentos por profissional — mesma ideia de profissionais_andares,
    // mas pra travar/filtrar o campo "Procedimento" em vez de "Andar".
    case 'listarProfissionaisProcedimentos': {
      const { data, error } = await supabaseClient.from('profissionais_procedimentos').select('prof, procedimento');
      if(error) return {ok:false, erro:error.message};
      return {ok:true, linhas: data||[]};
    }


    case 'definirProfissionalProcedimento': {
      if(dados.valor){
        const { error } = await supabaseClient.from('profissionais_procedimentos')
          .upsert({ prof: dados.prof, procedimento: dados.procedimento }, { onConflict: 'prof,procedimento' });
        return error ? {ok:false, erro:error.message} : {ok:true};
      } else {
        const { error } = await supabaseClient.from('profissionais_procedimentos')
          .delete().eq('prof', dados.prof).eq('procedimento', dados.procedimento);
        return error ? {ok:false, erro:error.message} : {ok:true};
      }
    }


    // Exames por profissional — mesma ideia de profissionais_andares e
    // profissionais_procedimentos, mas pra travar/filtrar o campo "Exame".
    // Diferente dos outros dois, o campo Exame não é obrigatório no
    // formulário, então essa trava só restringe as opções — nunca bloqueia
    // o salvamento por falta de exame cadastrado.
    case 'listarProfissionaisExames': {
      const { data, error } = await supabaseClient.from('profissionais_exames').select('prof, exame');
      if(error) return {ok:false, erro:error.message};
      return {ok:true, linhas: data||[]};
    }


    case 'definirProfissionalExame': {
      if(dados.valor){
        const { error } = await supabaseClient.from('profissionais_exames')
          .upsert({ prof: dados.prof, exame: dados.exame }, { onConflict: 'prof,exame' });
        return error ? {ok:false, erro:error.message} : {ok:true};
      } else {
        const { error } = await supabaseClient.from('profissionais_exames')
          .delete().eq('prof', dados.prof).eq('exame', dados.exame);
        return error ? {ok:false, erro:error.message} : {ok:true};
      }
    }


    // Atendentes por profissional — cadastro (n:n) usado nos dois sentidos:
    // quando o Atendente logado está travado no próprio nome (Lançamento),
    // filtra quem ele pode escolher em "Profissional"; quando o Atendente
    // está livre (gerente no Lançamento, ou qualquer edição no Modal), o
    // Profissional escolhido filtra quem pode ser escolhido em "Atendente".
    case 'listarAtendentesProfissionais': {
      const { data, error } = await supabaseClient.from('atendentes_profissionais').select('atendente, prof');
      if(error) return {ok:false, erro:error.message};
      return {ok:true, linhas: data||[]};
    }


    case 'definirAtendenteProfissional': {
      if(dados.valor){
        const { error } = await supabaseClient.from('atendentes_profissionais')
          .upsert({ atendente: dados.atendente, prof: dados.prof }, { onConflict: 'atendente,prof' });
        return error ? {ok:false, erro:error.message} : {ok:true};
      } else {
        const { error } = await supabaseClient.from('atendentes_profissionais')
          .delete().eq('atendente', dados.atendente).eq('prof', dados.prof);
        return error ? {ok:false, erro:error.message} : {ok:true};
      }
    }


    // Repasse de coparticipados — uma única linha "global" por mês/ano (prof
    // fixo = 'GERAL', já que a taxa/rateio é a mesma para todo mundo). Não
    // usamos upsert com onConflict aqui porque não temos certeza de que existe
    // uma constraint unique(prof,mes,ano) na tabela — fazemos select e depois
    // insert OU update manualmente, o que funciona independente disso.
    case 'obterConfigCoparticipados': {
      const { data, error } = await supabaseClient.from('coparticipados')
        .select('taxa, rateio_clinica, rateio_coparticipado')
        .eq('mes', dados.mes).eq('ano', Number(dados.ano)).eq('prof', REPASSE_COPARTICIPADOS_PROF_GLOBAL)
        .maybeSingle();
      if(error) return {ok:false, erro:error.message};
      return {ok:true, config: data || null};
    }


    case 'salvarConfigCoparticipados': {
      const { data: existente, error: errBusca } = await supabaseClient.from('coparticipados')
        .select('id').eq('mes', dados.mes).eq('ano', Number(dados.ano)).eq('prof', REPASSE_COPARTICIPADOS_PROF_GLOBAL)
        .maybeSingle();
      if(errBusca) return {ok:false, erro:errBusca.message};
      const registro = {
        prof: REPASSE_COPARTICIPADOS_PROF_GLOBAL, mes: dados.mes, ano: Number(dados.ano),
        taxa: Number(dados.taxa)||0, rateio_clinica: Number(dados.rateio_clinica)||0,
        rateio_coparticipado: Number(dados.rateio_coparticipado)||0,
        atualizado_em: new Date().toISOString()
      };
      if(existente){
        const { error } = await supabaseClient.from('coparticipados').update(registro).eq('id', existente.id);
        return error ? {ok:false, erro:error.message} : {ok:true};
      } else {
        const { error } = await supabaseClient.from('coparticipados').insert(registro);
        return error ? {ok:false, erro:error.message} : {ok:true};
      }
    }


    // FINANCEIRO (DRE) — cadastrado manualmente 1x por mês na aba Metas (vem da
    // contabilidade/conciliação bancária, não é calculado a partir da produção).
    // Uma linha por mês/ano só, com os 7 grandes grupos usados no DRE resumido.
    // Alimenta a aba Apresentação; enquanto não for preenchido pro mês, essas
    // telas ficam em branco (não é possível calcular/estimar esse dado sozinho).
    case 'obterFinanceiroDre': {
      const { data, error } = await supabaseClient.from('financeiro_dre')
        .select('*').eq('mes', nomeMesParaNumero(dados.mes)).eq('ano', Number(dados.ano)).maybeSingle();
      if(error) return {ok:false, erro:error.message};
      return {ok:true, dre: data || null};
    }

    case 'salvarFinanceiroDre': {
      const registro = {
        mes: nomeMesParaNumero(dados.mes), ano: Number(dados.ano),
        faturamento_bruto: Number(dados.faturamento_bruto)||0,
        deducoes_impostos: Number(dados.deducoes_impostos)||0,
        custo_servico_prestado: Number(dados.custo_servico_prestado)||0,
        despesas_pessoal: Number(dados.despesas_pessoal)||0,
        despesas_compras_manutencao: Number(dados.despesas_compras_manutencao)||0,
        despesas_operacionais: Number(dados.despesas_operacionais)||0,
        despesas_financeiras: Number(dados.despesas_financeiras)||0,
        prolabore: Number(dados.prolabore)||0,
        atualizado_em: new Date().toISOString()
      };
      const { error } = await supabaseClient.from('financeiro_dre')
        .upsert(registro, { onConflict: 'mes,ano' });
      return error ? {ok:false, erro:error.message} : {ok:true};
    }


    // PLANO DE CONTAS — estrutura de contas (árvore, via `conta_pai_codigo`)
    // e valores mensais por conta-folha. Ver aba Financeiro (js/financeiro.js).
    case 'listarPlanoContas': {
      const { data, error } = await supabaseClient.from('plano_contas')
        .select('*').order('ordem').order('codigo');
      if(error) return {ok:false, erro:error.message};
      return {ok:true, contas: data||[]};
    }

    case 'criarContaPlano': {
      const registro = {
        codigo: dados.codigo, nome: dados.nome,
        conta_pai_codigo: dados.conta_pai_codigo || null,
        natureza: dados.natureza === 'entrada' ? 'entrada' : 'saida',
        ordem: Number(dados.ordem)||0
      };
      const { error } = await supabaseClient.from('plano_contas').insert(registro);
      return error ? {ok:false, erro:error.message} : {ok:true};
    }

    case 'renomearContaPlano': {
      const { error } = await supabaseClient.from('plano_contas')
        .update({ nome: dados.nome }).eq('codigo', dados.codigo);
      return error ? {ok:false, erro:error.message} : {ok:true};
    }

    case 'atualizarNaturezaConta': {
      const { error } = await supabaseClient.from('plano_contas')
        .update({ natureza: dados.natureza==='entrada'?'entrada':'saida' }).eq('codigo', dados.codigo);
      return error ? {ok:false, erro:error.message} : {ok:true};
    }

    case 'excluirContaPlano': {
      // Só permite excluir quem não tem filhos nem valores lançados — a
      // checagem de "não tem filhos" já é feita no front antes de chamar
      // (evita apagar uma conta que é pai de outras sem querer).
      const { error: errValores } = await supabaseClient.from('plano_contas_valores')
        .delete().eq('conta_codigo', dados.codigo);
      if(errValores) return {ok:false, erro:errValores.message};
      const { error } = await supabaseClient.from('plano_contas').delete().eq('codigo', dados.codigo);
      return error ? {ok:false, erro:error.message} : {ok:true};
    }

    case 'listarValoresContas': {
      const { data, error } = await supabaseClient.from('plano_contas_valores')
        .select('conta_codigo, valor')
        .eq('mes', nomeMesParaNumero(dados.mes)).eq('ano', Number(dados.ano));
      if(error) return {ok:false, erro:error.message};
      return {ok:true, valores: data||[]};
    }

    case 'salvarValorConta': {
      const registro = {
        conta_codigo: dados.codigo, mes: nomeMesParaNumero(dados.mes), ano: Number(dados.ano),
        valor: Number(dados.valor)||0, atualizado_em: new Date().toISOString()
      };
      const { error } = await supabaseClient.from('plano_contas_valores')
        .upsert(registro, { onConflict: 'conta_codigo,mes,ano' });
      return error ? {ok:false, erro:error.message} : {ok:true};
    }


    // FLUXO DE CAIXA — lançamentos com DATA exata (diferente do Plano de
    // Contas, que só tem mês/ano). Regime de caixa: quando o dinheiro
    // realmente entrou/saiu, não quando o serviço foi prestado.
    case 'listarFluxoCaixa': {
      const { data, error } = await supabaseClient.from('fluxo_caixa')
        .select('*').gte('data', dados.dataInicio).lte('data', dados.dataFim).order('data');
      if(error) return {ok:false, erro:error.message};
      return {ok:true, lancamentos: data||[]};
    }

    case 'criarLancamentoFluxoCaixa': {
      const registro = {
        data: dados.data, descricao: dados.descricao, valor: Number(dados.valor)||0,
        tipo: dados.tipo==='entrada'?'entrada':'saida', banco: dados.banco||null,
        conta_plano_codigo: dados.conta_plano_codigo||null
      };
      const { error } = await supabaseClient.from('fluxo_caixa').insert(registro);
      return error ? {ok:false, erro:error.message} : {ok:true};
    }

    case 'excluirLancamentoFluxoCaixa': {
      const { error } = await supabaseClient.from('fluxo_caixa').delete().eq('id', dados.id);
      return error ? {ok:false, erro:error.message} : {ok:true};
    }


    case 'dashboard': {
      // Busca o intervalo de datas do mês selecionado EM PÁGINAS (não uma
      // chamada só) — filtrar por mês reduz o volume, mas não garante ficar
      // abaixo do limite de linhas de uma consulta do Supabase se a clínica
      // tiver muitos lançamentos naquele mês. buscarProducaoCompleta pagina
      // até trazer tudo, então funciona independente do volume.
      const { dataInicio, dataFim } = primeiroEUltimoDiaDoMes(dados.mes, dados.ano);
      const respProd = await buscarProducaoCompleta({dataInicio, dataFim});
      if(!respProd.ok) return respProd;
      let registros = respProd.registros;
      if(dados.andar) registros = registros.filter(r=>String(r.andar||'').trim().toUpperCase()===String(dados.andar).trim().toUpperCase());
      const porProfissional = {}, porConvenio = {}, porAndar = {};
      let totalValor = 0;
      registros.forEach(r=>{
        const prof = r.prof || 'Não informado';
        const conv = r.convenio || 'PARTICULAR';
        const andar = r.andar || 'Não informado';
        const valor = Number(r.valor)||0;
        if(!porProfissional[prof]) porProfissional[prof] = {quantidade:0, valor:0};
        porProfissional[prof].quantidade++; porProfissional[prof].valor += valor;
        if(!porConvenio[conv]) porConvenio[conv]=0;
        porConvenio[conv]+=valor;
        if(!porAndar[andar]) porAndar[andar]=0;
        porAndar[andar]+=valor;
        totalValor+=valor;
      });
      const respMetas = await supabaseApi('listarMetas', {mes:dados.mes, ano:dados.ano});
      const metas = respMetas.ok ? respMetas.metas : [];
      const metaPorProf = {}; metas.forEach(m=>metaPorProf[m.prof]=m);
      const comparativo = Object.keys(porProfissional).map(prof=>{
        const m = metaPorProf[prof]||{};
        return {prof, quantidade:porProfissional[prof].quantidade, valorRealizado:porProfissional[prof].valor,
                metaValor: (Number(m.valor_minimo_turno)||0) * (Number(m.turnos_utilizados)||0)};
      });
      return {ok:true, totalAtendimentos:registros.length, totalValor, porProfissional, porConvenio, porAndar, comparativo};
    }


    default: return {ok:false, erro:'Ação desconhecida (Supabase): '+acao};
  }
}


function mockApi(acao, dados) {
  switch(acao){
    case 'login': {
      const achado = demo.usuarios.find(u => u.usuario===dados.usuario && u.senha===dados.senha);
      if(!achado) return {ok:false, erro:'Usuário ou senha inválidos.'};
      const sobrescritas = demo.permissoes.filter(p=>p.usuario===achado.usuario);
      const permissoes = achado.papel==='gerente' ? {} : calcularPermissoesEfetivas(achado.papel, sobrescritas);
      return {ok:true, usuario:achado.usuario, papel:achado.papel, nomeProfissional:achado.nome_profissional, permissoes};
    }
    case 'listarPermissoesTodos': {
      const usuarios = demo.usuarios.map(u=>{
        const sobrescritas = demo.permissoes.filter(p=>p.usuario===u.usuario);
        return {usuario:u.usuario, papel:u.papel, nome_profissional:u.nome_profissional, permissoes: calcularPermissoesEfetivas(u.papel, sobrescritas)};
      });
      return {ok:true, usuarios};
    }
    case 'definirPermissao': {
      const existente = demo.permissoes.find(p=>p.usuario===dados.usuario && p.chave===dados.chave);
      if(existente) existente.valor = !!dados.valor;
      else demo.permissoes.push({usuario:dados.usuario, chave:dados.chave, valor:!!dados.valor});
      return {ok:true};
    }
    // ---------- PACIENTES (demo) ----------
    case 'buscarPacientes': {
      const termo = String(dados.termo||'').trim().toLowerCase();
      const campo = dados.campo === 'carteirinha' ? 'carteirinha' : 'nome';
      const encontrados = demo.pacientes
        .filter(p => !termo || String(p[campo]||'').toLowerCase().includes(termo))
        .sort((a,b)=>a.nome.localeCompare(b.nome))
        .slice(0,30);
      return {ok:true, pacientes: encontrados};
    }

    // ---------- VÍNCULO PACIENTE × CONVÊNIO (demo) ----------
    case 'buscarBeneficiariosUnimedPorNome': {
      const termo = String(dados.termo||'').trim().toLowerCase();
      if(termo.length < 2) return {ok:true, beneficiarios: []};
      const vistos = new Set();
      const distintos = [];
      demo.faturamentoNotas.forEach(n=>{
        const cartao = String(n.cartao_beneficiario||'').trim();
        if(!cartao || vistos.has(cartao)) return;
        if(!String(n.nome_beneficiario||'').toLowerCase().includes(termo)) return;
        vistos.add(cartao);
        distintos.push({cartao_beneficiario: cartao, nome_beneficiario: n.nome_beneficiario});
      });
      return {ok:true, beneficiarios: distintos.slice(0,10)};
    }
    case 'obterProximoBeneficiarioPendente': {
      const jaRevisados = new Set(demo.pacienteConvenioVinculo.map(v=>v.cartao_beneficiario));
      const vistos = new Set();
      const pendentes = [];
      demo.faturamentoNotas.forEach(n=>{
        const cartao = String(n.cartao_beneficiario||'').trim();
        if(!cartao || vistos.has(cartao) || jaRevisados.has(cartao)) return;
        vistos.add(cartao);
        pendentes.push({cartao_beneficiario: cartao, nome_beneficiario: n.nome_beneficiario});
      });
      return {ok:true, beneficiario: pendentes[0]||null, restantes: pendentes.length};
    }
    case 'confirmarVinculoPaciente': {
      demo.pacienteConvenioVinculo.push({cartao_beneficiario: dados.cartao_beneficiario, nome_beneficiario: dados.nome_beneficiario||null, paciente_id: dados.paciente_id, status:'vinculado'});
      const p = demo.pacientes.find(x=>x.id===dados.paciente_id);
      if(p && !p.carteirinha) p.carteirinha = dados.cartao_beneficiario;
      if(p && !p.convenio) p.convenio = 'Unimed';
      return {ok:true};
    }
    case 'pularBeneficiarioVinculo': {
      demo.pacienteConvenioVinculo.push({cartao_beneficiario: dados.cartao_beneficiario, nome_beneficiario: dados.nome_beneficiario||null, paciente_id: null, status:'pulado'});
      return {ok:true};
    }

    case 'obterPaciente': {
      const p = demo.pacientes.find(x=>x.id===dados.id);
      return {ok:true, paciente: p||null};
    }
    case 'criarPaciente': {
      const nome = String(dados.nome||'').trim();
      if(!nome) return {ok:false, erro:'Nome do paciente é obrigatório.'};
      const existente = demo.pacientes.find(p=>p.nome.toLowerCase()===nome.toLowerCase());
      if(existente) return {ok:true, paciente: existente};
      const novo = {id: 'demo-pac-'+Date.now()+'-'+Math.random().toString(36).slice(2,7), nome, whatsapp: dados.whatsapp||null, endereco: dados.endereco||null, convenio: dados.convenio||null, carteirinha: dados.carteirinha||null, data_nascimento: dados.data_nascimento||null, cpf: dados.cpf||null};
      demo.pacientes.push(novo);
      return {ok:true, paciente: novo};
    }
    case 'atualizarPaciente': {
      const p = demo.pacientes.find(x=>x.id===dados.id);
      if(!p) return {ok:false, erro:'Paciente não encontrado.'};
      p.nome = dados.nome; p.whatsapp = dados.whatsapp||null; p.endereco = dados.endereco||null;
      p.convenio = dados.convenio||null; p.carteirinha = dados.carteirinha||null; p.data_nascimento = dados.data_nascimento||null;
      p.cpf = dados.cpf||null;
      return {ok:true};
    }

    // ---------- ESTOQUE (demo) ----------
    case 'listarFornecedores': return {ok:true, fornecedores: demo.fornecedores.slice().sort((a,b)=>a.nome.localeCompare(b.nome))};
    case 'criarFornecedor': {
      const novo = {id:'demo-forn-'+Date.now(), nome:dados.nome, cnpj:dados.cnpj||null, contato:dados.contato||null};
      demo.fornecedores.push(novo);
      return {ok:true, fornecedor:novo};
    }
    case 'atualizarFornecedor': {
      const f = demo.fornecedores.find(x=>x.id===dados.id);
      if(!f) return {ok:false, erro:'Fornecedor não encontrado.'};
      f.nome=dados.nome; f.cnpj=dados.cnpj||null; f.contato=dados.contato||null;
      return {ok:true};
    }
    case 'listarMateriais': return {ok:true, materiais: demo.materiais.slice().sort((a,b)=>a.nome.localeCompare(b.nome))};
    case 'criarMaterial': {
      const novo = {id:'demo-mat-'+Date.now(), nome:dados.nome, categoria:dados.categoria||null, unidade:dados.unidade||'unidade', estoque_minimo:Number(dados.estoque_minimo)||0, ativo:true};
      demo.materiais.push(novo);
      return {ok:true, material:novo};
    }
    case 'atualizarMaterial': {
      const m = demo.materiais.find(x=>x.id===dados.id);
      if(!m) return {ok:false, erro:'Material não encontrado.'};
      m.nome=dados.nome; m.categoria=dados.categoria||null; m.unidade=dados.unidade||'unidade';
      m.estoque_minimo=Number(dados.estoque_minimo)||0; m.ativo=dados.ativo!==false;
      return {ok:true};
    }
    case 'criarEntradaEstoque': {
      const novo = {
        id:'demo-lote-'+Date.now(), material_id:dados.material_id, fornecedor_id:dados.fornecedor_id||null,
        lote:dados.lote||null, nota_fiscal:dados.nota_fiscal||null,
        data_entrada: dados.data_entrada || new Date().toISOString().slice(0,10), validade: dados.validade||null,
        quantidade_entrada: Number(dados.quantidade)||0, quantidade_atual: Number(dados.quantidade)||0,
        valor_unitario: dados.valor_unitario ? Number(dados.valor_unitario) : null
      };
      demo.estoqueLotes.push(novo);
      return {ok:true, lote:novo};
    }
    case 'obterPosicaoEstoque': {
      return {ok:true, materiais: demo.materiais.filter(m=>m.ativo).slice(), lotes: demo.estoqueLotes.filter(l=>l.quantidade_atual>0).slice()};
    }
    case 'criarSolicitacaoMaterial': {
      const novo = {
        id:'demo-sol-'+Date.now(), material_id:dados.material_id, profissional_id:dados.profissional_id||null,
        procedimento:dados.procedimento||null, exame:dados.exame||null, quantidade:Number(dados.quantidade)||0,
        status:'pendente', observacao:dados.observacao||null, solicitado_por:dados.solicitado_por||null,
        solicitado_em:new Date().toISOString()
      };
      demo.solicitacoesMaterial.push(novo);
      return {ok:true, solicitacao:novo};
    }
    case 'listarSolicitacoesMaterial': {
      let lista = demo.solicitacoesMaterial.slice();
      if(Array.isArray(dados.status)) lista = lista.filter(s=>dados.status.includes(s.status));
      else if(dados.status) lista = lista.filter(s=>s.status===dados.status);
      if(dados.solicitado_por) lista = lista.filter(s=>s.solicitado_por===dados.solicitado_por);
      lista = lista.map(s=>({
        ...s,
        materiais: {nome: (demo.materiais.find(m=>m.id===s.material_id)||{}).nome, unidade: (demo.materiais.find(m=>m.id===s.material_id)||{}).unidade},
        profissionais: {nome: (demo.profissionais.find(p=>p.id===s.profissional_id)||{}).nome}
      })).sort((a,b)=>new Date(b.solicitado_em)-new Date(a.solicitado_em));
      return {ok:true, solicitacoes: lista};
    }
    case 'negarSolicitacaoMaterial': {
      const s = demo.solicitacoesMaterial.find(x=>x.id===dados.id);
      if(!s) return {ok:false, erro:'Solicitação não encontrada.'};
      s.status = 'negado'; s.observacao = dados.motivo||null;
      return {ok:true};
    }
    case 'dispensarSolicitacao': {
      const s = demo.solicitacoesMaterial.find(x=>x.id===dados.id);
      if(!s) return {ok:false, erro:'Solicitação não encontrada.'};
      if(s.status!=='pendente') return {ok:false, erro:'Essa solicitação já foi resolvida.'};
      const reservadoPorLote = {};
      demo.dispensacoes.filter(d=>d.status==='reservado').forEach(d=>{ reservadoPorLote[d.lote_id] = (reservadoPorLote[d.lote_id]||0) + Number(d.quantidade); });
      const lotes = demo.estoqueLotes.filter(l=>l.material_id===s.material_id)
        .map(l=>({...l, disponivel: Number(l.quantidade_atual) - (reservadoPorLote[l.id]||0)}))
        .filter(l=>l.disponivel>0)
        .sort((a,b)=>{
          if(!a.validade) return 1; if(!b.validade) return -1;
          return new Date(a.validade)-new Date(b.validade);
        });
      const totalDisponivel = lotes.reduce((sm,l)=>sm+l.disponivel,0);
      if(totalDisponivel < Number(s.quantidade)) return {ok:false, erro:`Estoque insuficiente — disponível: ${totalDisponivel}, solicitado: ${s.quantidade}.`};
      // Não baixa aqui — só reserva. Baixa real ocorre em confirmarRecebimentoSolicitacao.
      let restante = Number(s.quantidade);
      for(const lote of lotes){
        if(restante<=0) break;
        const usar = Math.min(restante, lote.disponivel);
        demo.dispensacoes.push({id:'demo-disp-'+Date.now()+Math.random(), solicitacao_id:s.id, lote_id:lote.id, quantidade:usar, dispensado_por:dados.dispensado_por||null, dispensado_em:new Date().toISOString(), status:'reservado'});
        restante -= usar;
      }
      s.status = 'dispensado';
      return {ok:true};
    }
    case 'confirmarRecebimentoSolicitacao': {
      const s = demo.solicitacoesMaterial.find(x=>x.id===dados.id);
      if(!s) return {ok:false, erro:'Solicitação não encontrada.'};
      if(s.status!=='dispensado') return {ok:false, erro:'Essa solicitação não está aguardando confirmação.'};
      demo.dispensacoes.filter(d=>d.solicitacao_id===s.id && d.status==='reservado').forEach(d=>{
        const lote = demo.estoqueLotes.find(l=>l.id===d.lote_id);
        if(lote) lote.quantidade_atual -= Number(d.quantidade);
        d.status = 'confirmado';
      });
      s.status = 'confirmado';
      s.confirmado_por = dados.confirmado_por||null;
      s.confirmado_em = new Date().toISOString();
      s.observacao_recebimento = dados.observacao||null;
      return {ok:true};
    }

    // ---------- PROFISSIONAIS — cadastro (demo) ----------
    case 'listarProfissionaisCadastro': {
      return {ok:true, profissionais: demo.profissionais.slice().sort((a,b)=>a.nome.localeCompare(b.nome))};
    }
    case 'criarProfissionalCadastro': {
      const novo = {id:'demo-prof-'+Date.now(), nome:dados.nome, telefone:dados.telefone||null, registro_profissional:dados.registro_profissional||null, especialidade:dados.especialidade||null, observacoes:null};
      demo.profissionais.push(novo);
      return {ok:true, profissional: novo};
    }
    case 'atualizarProfissionalCadastro': {
      const p = demo.profissionais.find(x=>x.id===dados.id);
      if(!p) return {ok:false, erro:'Profissional não encontrado.'};
      p.telefone = dados.telefone||null; p.registro_profissional = dados.registro_profissional||null; p.especialidade = dados.especialidade||null;
      return {ok:true};
    }

    case 'listarProfissionaisAndares': {
      return {ok:true, linhas: demo.profissionaisAndares.slice()};
    }
    case 'definirProfissionalAndar': {
      const idx = demo.profissionaisAndares.findIndex(l=>l.prof===dados.prof && l.andar===dados.andar);
      if(dados.valor){
        if(idx===-1) demo.profissionaisAndares.push({prof:dados.prof, andar:dados.andar});
      } else {
        if(idx>-1) demo.profissionaisAndares.splice(idx,1);
      }
      return {ok:true};
    }
    case 'listarProfissionaisProcedimentos': {
      return {ok:true, linhas: demo.profissionaisProcedimentos.slice()};
    }
    case 'definirProfissionalProcedimento': {
      const idx = demo.profissionaisProcedimentos.findIndex(l=>l.prof===dados.prof && l.procedimento===dados.procedimento);
      if(dados.valor){
        if(idx===-1) demo.profissionaisProcedimentos.push({prof:dados.prof, procedimento:dados.procedimento});
      } else {
        if(idx>-1) demo.profissionaisProcedimentos.splice(idx,1);
      }
      return {ok:true};
    }
    case 'listarProfissionaisExames': {
      return {ok:true, linhas: demo.profissionaisExames.slice()};
    }
    case 'definirProfissionalExame': {
      const idx = demo.profissionaisExames.findIndex(l=>l.prof===dados.prof && l.exame===dados.exame);
      if(dados.valor){
        if(idx===-1) demo.profissionaisExames.push({prof:dados.prof, exame:dados.exame});
      } else {
        if(idx>-1) demo.profissionaisExames.splice(idx,1);
      }
      return {ok:true};
    }
    case 'listarAtendentesProfissionais': {
      return {ok:true, linhas: demo.atendentesProfissionais.slice()};
    }
    case 'definirAtendenteProfissional': {
      const idx = demo.atendentesProfissionais.findIndex(l=>l.atendente===dados.atendente && l.prof===dados.prof);
      if(dados.valor){
        if(idx===-1) demo.atendentesProfissionais.push({atendente:dados.atendente, prof:dados.prof});
      } else {
        if(idx>-1) demo.atendentesProfissionais.splice(idx,1);
      }
      return {ok:true};
    }
    case 'obterConfigCoparticipados': {
      const chave = dados.mes+'-'+dados.ano;
      return {ok:true, config: demo.coparticipados[chave] || null};
    }
    case 'salvarConfigCoparticipados': {
      const chave = dados.mes+'-'+dados.ano;
      demo.coparticipados[chave] = {
        taxa: Number(dados.taxa)||0,
        rateio_clinica: Number(dados.rateio_clinica)||0,
        rateio_coparticipado: Number(dados.rateio_coparticipado)||0
      };
      return {ok:true};
    }
    case 'obterFinanceiroDre': {
      const chave = dados.mes+'-'+dados.ano;
      return {ok:true, dre: demo.financeiroDre[chave] || null};
    }
    case 'salvarFinanceiroDre': {
      const chave = dados.mes+'-'+dados.ano;
      demo.financeiroDre[chave] = {
        faturamento_bruto: Number(dados.faturamento_bruto)||0,
        deducoes_impostos: Number(dados.deducoes_impostos)||0,
        custo_servico_prestado: Number(dados.custo_servico_prestado)||0,
        despesas_pessoal: Number(dados.despesas_pessoal)||0,
        despesas_compras_manutencao: Number(dados.despesas_compras_manutencao)||0,
        despesas_operacionais: Number(dados.despesas_operacionais)||0,
        despesas_financeiras: Number(dados.despesas_financeiras)||0,
        prolabore: Number(dados.prolabore)||0
      };
      return {ok:true};
    }
    case 'listarPlanoContas': {
      return {ok:true, contas: demo.planoContas.slice()};
    }
    case 'criarContaPlano': {
      demo.planoContas.push({
        codigo: dados.codigo, nome: dados.nome, conta_pai_codigo: dados.conta_pai_codigo||null,
        natureza: dados.natureza==='entrada'?'entrada':'saida', ordem: Number(dados.ordem)||0
      });
      return {ok:true};
    }
    case 'renomearContaPlano': {
      const conta = demo.planoContas.find(c=>c.codigo===dados.codigo);
      if(conta) conta.nome = dados.nome;
      return {ok:true};
    }
    case 'atualizarNaturezaConta': {
      const conta = demo.planoContas.find(c=>c.codigo===dados.codigo);
      if(conta) conta.natureza = dados.natureza==='entrada'?'entrada':'saida';
      return {ok:true};
    }
    case 'excluirContaPlano': {
      demo.planoContas = demo.planoContas.filter(c=>c.codigo!==dados.codigo);
      Object.keys(demo.planoContasValores).forEach(chave=>{
        if(chave.startsWith(dados.codigo+'|')) delete demo.planoContasValores[chave];
      });
      return {ok:true};
    }
    case 'listarValoresContas': {
      const sufixo = '|'+dados.mes+'-'+dados.ano;
      const valores = Object.keys(demo.planoContasValores)
        .filter(chave=>chave.endsWith(sufixo))
        .map(chave=>({conta_codigo: chave.split('|')[0], valor: demo.planoContasValores[chave]}));
      return {ok:true, valores};
    }
    case 'salvarValorConta': {
      const chave = dados.codigo+'|'+dados.mes+'-'+dados.ano;
      demo.planoContasValores[chave] = Number(dados.valor)||0;
      return {ok:true};
    }
    case 'listarFluxoCaixa': {
      const lancamentos = demo.fluxoCaixa.filter(l => l.data >= dados.dataInicio && l.data <= dados.dataFim);
      return {ok:true, lancamentos: lancamentos.slice().sort((a,b)=>a.data.localeCompare(b.data))};
    }
    case 'criarLancamentoFluxoCaixa': {
      demo.fluxoCaixa.push({
        id: 'fc'+(demo.fluxoCaixa.length+1), data: dados.data, descricao: dados.descricao,
        valor: Number(dados.valor)||0, tipo: dados.tipo==='entrada'?'entrada':'saida',
        banco: dados.banco||null, conta_plano_codigo: dados.conta_plano_codigo||null
      });
      return {ok:true};
    }
    case 'excluirLancamentoFluxoCaixa': {
      demo.fluxoCaixa = demo.fluxoCaixa.filter(l=>l.id!==dados.id);
      return {ok:true};
    }
    case 'listarListas': {
      const copiaListas = {};
      Object.keys(demo.listas).forEach(k=>copiaListas[k]=demo.listas[k].slice());
      return {ok:true, listas:copiaListas};
    }
    case 'listarProducao': {
      let registros = demo.producao.slice();
      if(dados.dataInicio || dados.dataFim){
        if(dados.dataInicio) registros = registros.filter(r=>r.data >= dados.dataInicio);
        if(dados.dataFim) registros = registros.filter(r=>r.data <= dados.dataFim);
      } else {
        if(dados.mes) registros = registros.filter(r=>r.mes===dados.mes);
        if(dados.ano) registros = registros.filter(r=>String(r.ano)===String(dados.ano));
      }
      if(dados.prof) registros = registros.filter(r=>r.prof.toUpperCase()===dados.prof.toUpperCase());
      registros.sort((a,b)=> String(b.data).localeCompare(String(a.data))); // mais recente primeiro, igual ao Supabase
      if(dados.limite) registros = registros.slice(0, Number(dados.limite));
      return {ok:true, registros};
    }
    case 'adicionarProducao': {
      const d = new Date(dados.data+'T00:00:00');
      const novo = Object.assign({id:'d'+Math.random().toString(36).slice(2,9)}, dados, {mes:MESES[d.getMonth()], ano:d.getFullYear()});
      demo.producao.unshift(novo);
      return {ok:true};
    }
    case 'atualizarProducao': {
      const idx = demo.producao.findIndex(r=>r.id===dados.id);
      if(idx===-1) return {ok:false, erro:'Não encontrado'};
      const d = new Date(dados.registro.data+'T00:00:00');
      demo.producao[idx] = Object.assign({id:dados.id}, dados.registro, {mes:MESES[d.getMonth()], ano:d.getFullYear()});
      return {ok:true};
    }
    case 'excluirProducao': {
      demo.producao = demo.producao.filter(r=>r.id!==dados.id);
      return {ok:true};
    }
    case 'listarMetas': {
      let metas = demo.metas.slice();
      if(dados.mes) metas = metas.filter(m=>m.mes===dados.mes);
      if(dados.ano) metas = metas.filter(m=>String(m.ano)===String(dados.ano));
      return {ok:true, metas};
    }
    case 'salvarMeta': {
      const idx = demo.metas.findIndex(m=>m.prof===dados.prof && m.mes===dados.mes && String(m.ano)===String(dados.ano));
      if(idx>-1) demo.metas[idx] = dados; else demo.metas.push(dados);
      return {ok:true};
    }
    case 'obterNota': {
      const chave = dados.mes+'-'+dados.ano;
      return {ok:true, texto: demo.notas[chave] || ''};
    }
    case 'salvarNota': {
      demo.notas[dados.mes+'-'+dados.ano] = dados.texto;
      return {ok:true};
    }
    case 'obterConfiguracoes': {
      return {ok:true, configuracoes: demo.configuracoes};
    }
    case 'salvarConfiguracao': {
      demo.configuracoes[dados.chave] = dados.valor;
      return {ok:true};
    }
    case 'adicionarItemLista': {
      if(!demo.listas[dados.coluna]) demo.listas[dados.coluna] = []; // lista nova (ex.: especialidades) — cria vazia na hora, igual o Supabase faria
      const jaExiste = demo.listas[dados.coluna].some(v=>String(v).trim().toUpperCase()===String(dados.valor).trim().toUpperCase());
      if(jaExiste) return {ok:false, erro:'Esse item já existe nessa lista.'};
      demo.listas[dados.coluna].push(dados.valor);
      return {ok:true};
    }
    case 'removerItemLista': {
      if(!demo.listas[dados.coluna]) return {ok:false, erro:'Lista desconhecida.'};
      demo.listas[dados.coluna] = demo.listas[dados.coluna].filter(v=>v!==dados.valor);
      return {ok:true};
    }
    case 'alterarConta': {
      const usuario = demo.usuarios.find(u=>u.usuario===dados.usuario);
      if(!usuario) return {ok:false, erro:'Usuário não encontrado.'};
      if(usuario.senha !== dados.senhaAtual) return {ok:false, erro:'Senha atual incorreta.'};
      if(dados.novoNome) usuario.nome_profissional = dados.novoNome;
      if(dados.novaSenha) usuario.senha = dados.novaSenha;
      return {ok:true, nomeProfissional: usuario.nome_profissional};
    }
    case 'dashboard': {
      let registros = demo.producao.slice();
      if(dados.mes) registros = registros.filter(r=>r.mes===dados.mes);
      if(dados.ano) registros = registros.filter(r=>String(r.ano)===String(dados.ano));
      if(dados.andar) registros = registros.filter(r=>String(r.andar||'').trim().toUpperCase()===String(dados.andar).trim().toUpperCase());
      const porProfissional = {}, porConvenio = {}, porAndar = {};
      let totalValor = 0;
      registros.forEach(r=>{
        const prof = r.prof || 'Não informado';
        const conv = r.convenio || 'PARTICULAR';
        const andar = r.andar || 'Não informado';
        const valor = Number(r.valor)||0;
        if(!porProfissional[prof]) porProfissional[prof] = {quantidade:0, valor:0};
        porProfissional[prof].quantidade++; porProfissional[prof].valor += valor;
        if(!porConvenio[conv]) porConvenio[conv]=0;
        porConvenio[conv]+=valor;
        if(!porAndar[andar]) porAndar[andar]=0;
        porAndar[andar]+=valor;
        totalValor+=valor;
      });
      let metas = demo.metas.filter(m=>m.mes===dados.mes && String(m.ano)===String(dados.ano));
      const metaPorProf = {}; metas.forEach(m=>metaPorProf[m.prof]=m);
      const comparativo = Object.keys(porProfissional).map(prof=>{
        const m = metaPorProf[prof]||{};
        return {prof, quantidade:porProfissional[prof].quantidade, valorRealizado:porProfissional[prof].valor,
                metaValor: (Number(m.valor_minimo_turno)||0) * (Number(m.turnos_utilizados)||0)};
      });
      return {ok:true, totalAtendimentos:registros.length, totalValor, porProfissional, porConvenio, porAndar, comparativo};
    }
    default: return {ok:false, erro:'Ação desconhecida em modo demo: '+acao};
  }
}


/* ---------------------------------------------------------------------
   FORMATAÇÃO
--------------------------------------------------------------------- */
