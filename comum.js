/* =====================================================================
   comum.js — código compartilhado entre index.html e faturamento.html.

   Contém tudo que os dois arquivos precisavam duplicar antes: meses,
   sessão (localStorage), definição de permissões e a lista de abas do
   sistema. Carregar este arquivo ANTES do <script> principal de cada
   página (via <script src="comum.js"></script>).

   Não redeclarar nada disso localmente nos arquivos que o consomem —
   é exatamente essa duplicação que este arquivo elimina.
===================================================================== */

/* ---------------------------------------------------------------------
   MESES E MOEDA
--------------------------------------------------------------------- */
const PRODCLIN_MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function formatarMoeda(v){
  return (Number(v)||0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
}

/* ---------------------------------------------------------------------
   SESSÃO — persistida em localStorage, lida pelos dois arquivos
--------------------------------------------------------------------- */
const CHAVE_SESSAO = 'prodclin_sessao';

function carregarSessaoSalva(){
  try{
    const bruto = localStorage.getItem(CHAVE_SESSAO);
    return bruto ? JSON.parse(bruto) : null;
  }catch(e){
    return null;
  }
}

function persistirSessao(dados){
  try{
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify({
      usuario: dados.usuario, papel: dados.papel,
      nomeProfissional: dados.nomeProfissional, permissoes: dados.permissoes || {}
    }));
  }catch(e){ /* localStorage indisponível — ignora silenciosamente */ }
}

function limparSessao(){
  try{ localStorage.removeItem(CHAVE_SESSAO); }catch(e){}
}

/* ---------------------------------------------------------------------
   PERMISSÕES
   DEFINICAO_PERMISSOES é a fonte única usada pela tela "Direitos e
   Privilégios" (index.html → Configurações) para montar a grade de
   checkboxes por tela. PERMISSOES_PADRAO_POR_PAPEL é o pacote que cada
   papel novo (profissional/atendente) já nasce com, antes de qualquer
   sobrescrita individual salva na tabela "permissoes" do Supabase.
   Gerente sempre tem acesso total e nunca passa por aqui (ver
   temPermissaoBase abaixo).

   IMPORTANTE: "ver_faturamento" propositalmente NÃO entra em nenhum
   pacote padrão — por padrão só o gerente vê Faturamento; libera-se
   usuário a usuário em Configurações → Direitos e Privilégios.
--------------------------------------------------------------------- */
const DEFINICAO_PERMISSOES = [
  {tela:'Lançamento',    chave:'ver_lancamento',          rotulo:'Ver'},
  {tela:'Verificar',     chave:'ver_verificar',            rotulo:'Ver'},
  {tela:'Verificar',     chave:'criar_verificar',          rotulo:'Criar'},
  {tela:'Verificar',     chave:'editar_verificar',         rotulo:'Editar'},
  {tela:'Verificar',     chave:'excluir_verificar',        rotulo:'Excluir'},
  {tela:'Verificar',     chave:'ver_financeiro_verificar', rotulo:'Ver financeiro'},
  {tela:'Crítica',       chave:'ver_critica',              rotulo:'Ver'},
  {tela:'Crítica',       chave:'editar_critica',           rotulo:'Editar'},
  {tela:'Crítica',       chave:'excluir_critica',          rotulo:'Excluir'},
  {tela:'Metas',         chave:'ver_metas',                rotulo:'Ver'},
  {tela:'Metas',         chave:'editar_metas',             rotulo:'Editar'},
  {tela:'Dashboard',     chave:'ver_dashboard',            rotulo:'Ver'},
  {tela:'Análises',      chave:'ver_analises',             rotulo:'Ver'},
  {tela:'RMR',           chave:'ver_rmr',                  rotulo:'Ver'},
  {tela:'Faturamento',   chave:'ver_faturamento',          rotulo:'Ver'},
  {tela:'Configurações', chave:'ver_configuracoes',        rotulo:'Ver'},
  {tela:'Configurações', chave:'editar_configuracoes',     rotulo:'Editar'}
];

const PERMISSOES_PADRAO_POR_PAPEL = {
  profissional: {
    ver_lancamento:true, ver_verificar:true, ver_critica:true, ver_metas:true
  },
  atendente: {
    ver_lancamento:true, ver_verificar:true, criar_verificar:true,
    ver_critica:true, editar_critica:true
  }
};

/* Combina o pacote padrão do papel com as sobrescritas individuais
   salvas no Supabase (array [{chave, valor}] vindo da tabela
   "permissoes"). Sobrescrita sempre ganha do padrão. */
function calcularPermissoesEfetivas(papel, sobrescritas){
  const efetivas = Object.assign({}, PERMISSOES_PADRAO_POR_PAPEL[papel] || {});
  (sobrescritas || []).forEach(s => { efetivas[s.chave] = !!s.valor; });
  return efetivas;
}

/* Atalho puro (sem depender de nenhuma variável global de cada página):
   gerente sempre pode; qualquer outro papel só se a chave estiver
   marcada em permissoesEfetivas. Cada página envolve isto num
   temPermissao(chave) local que já injeta o papel/permissões certos
   (estado.* no index.html, sessao.* no faturamento.html). */
function temPermissaoBase(papel, permissoesEfetivas, chave){
  return papel === 'gerente' || !!(permissoesEfetivas || {})[chave];
}

/* ---------------------------------------------------------------------
   ABAS DO SISTEMA
   Lista única de abas (id, rótulo, chave de permissão de visualização).
   index.html usa isto para montar a barra de navegação principal,
   trocando de painel internamente em todas exceto "faturamento" (que
   navega para faturamento.html). faturamento.html usa a mesma lista
   pra montar sua própria barra, navegando para index.html#id em todas
   exceto "faturamento" (que é a página local, sempre ativa).
--------------------------------------------------------------------- */
const PRODCLIN_DEFINICAO_ABAS = [
  {id:'lancamento',     rotulo:'Lançamento',     chave:'ver_lancamento'},
  {id:'editar',         rotulo:'Verificar',      chave:'ver_verificar'},
  {id:'critica',        rotulo:'Crítica',        chave:'ver_critica'},
  {id:'metas',          rotulo:'Metas',          chave:'ver_metas'},
  {id:'dashboard',      rotulo:'Dashboard',      chave:'ver_dashboard'},
  {id:'analises',       rotulo:'Análises',       chave:'ver_analises'},
  {id:'rmr',            rotulo:'RMR',            chave:'ver_rmr'},
  {id:'faturamento',    rotulo:'Faturamento',    chave:'ver_faturamento'},
  {id:'configuracoes',  rotulo:'Configurações',  chave:'ver_configuracoes'}
];
