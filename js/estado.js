/* =====================================================================
   ProdClin — estado.js
   Constantes de meses/permissões e o objeto `estado`, que guarda tudo que muda durante o uso
   do sistema (usuário logado, listas carregadas, aba ativa, caches de travas por profissional etc).
   Este arquivo é carregado via <script src> em index.html, na mesma ordem
   em que aparecia originalmente dentro do <script> único — variáveis e
   funções continuam compartilhando o escopo global, exatamente como antes.
===================================================================== */

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MODO_DEMO = !supabaseClient;


/* ---------------------------------------------------------------------
   REPASSE DE COPARTICIPADOS — configuração padrão (18% de taxa, rateio
   40% clínica / 60% coparticipado), salva por mês na tabela
   `coparticipados` do Supabase (uma linha "global" por mês/ano, usando
   prof = 'GERAL' porque a taxa é a mesma para todo mundo). Cache em
   memória evita reconsultar o banco a cada troca de filtro no mesmo mês.
--------------------------------------------------------------------- */
const REPASSE_COPARTICIPADOS_PADRAO = { taxa: 18, rateio_clinica: 40, rateio_coparticipado: 60 };
const REPASSE_COPARTICIPADOS_PROF_GLOBAL = 'GERAL';
let repasseCoparticipadosCache = {}; // chave "Mês-Ano" -> {taxa, rateio_clinica, rateio_coparticipado}


/* ---------------------------------------------------------------------
   DIREITOS E PRIVILÉGIOS — permissões fragmentadas por tela/ação.
   O gerente NUNCA passa por essa matriz (sempre tem acesso completo, para
   nunca correr o risco de um gerente se autobloquear por engano). Para
   profissional/atendente, cada usuário tem um "pacote padrão" conforme o
   papel (PERMISSOES_PADRAO_POR_PAPEL) que pode ser sobrescrito
   individualmente na tabela `permissoes` do Supabase (usuario, chave, valor).
--------------------------------------------------------------------- */
const DEFINICAO_PERMISSOES = [
  {tela:'Início',          chave:'ver_inicio',              rotulo:'Ver'},
  {tela:'Lançamento',     chave:'ver_lancamento',          rotulo:'Ver'},
  {tela:'Verificar',      chave:'ver_verificar',           rotulo:'Ver'},
  {tela:'Verificar',      chave:'ver_financeiro_verificar',rotulo:'Ver financeiro'},
  {tela:'Verificar',      chave:'criar_verificar',         rotulo:'Criar'},
  {tela:'Verificar',      chave:'editar_verificar',        rotulo:'Editar'},
  {tela:'Verificar',      chave:'excluir_verificar',       rotulo:'Excluir'},
  {tela:'Crítica',        chave:'ver_critica',             rotulo:'Ver'},
  {tela:'Crítica',        chave:'editar_critica',          rotulo:'Editar'},
  {tela:'Crítica',        chave:'excluir_critica',         rotulo:'Excluir'},
  {tela:'Metas',          chave:'ver_metas',               rotulo:'Ver'},
  {tela:'Metas',          chave:'editar_metas',            rotulo:'Editar'},
  {tela:'Análises',       chave:'ver_rmr',                 rotulo:'Ver'},
  {tela:'RMR',            chave:'ver_rmr_squad',           rotulo:'Ver'},
  {tela:'Configurações',  chave:'ver_configuracoes',       rotulo:'Ver'},
  {tela:'Configurações',  chave:'editar_configuracoes',    rotulo:'Editar'},
  {tela:'Apresentação',   chave:'ver_apresentacao',        rotulo:'Ver'},
  {tela:'Financeiro',     chave:'ver_financeiro',          rotulo:'Ver'},
  {tela:'Financeiro',     chave:'editar_financeiro',       rotulo:'Editar'}
];


const PERMISSOES_PADRAO_POR_PAPEL = {
  profissional: {
    ver_lancamento:true, ver_critica:true, editar_critica:true
    // tudo que não aparece aqui vale false por padrão
  },
  atendente: {
    ver_lancamento:true, ver_critica:true, editar_critica:true,
    ver_verificar:true, ver_financeiro_verificar:true
  }
};


// Combina o pacote padrão do papel com qualquer sobrescrita individual
// (linhas da tabela permissoes para aquele usuário) — a sobrescrita sempre
// ganha da regra padrão.
function calcularPermissoesEfetivas(papel, sobrescritas){
  const padrao = PERMISSOES_PADRAO_POR_PAPEL[papel] || {};
  const efetivas = Object.assign({}, padrao);
  (sobrescritas||[]).forEach(o=>{ efetivas[o.chave] = !!o.valor; });
  return efetivas;
}


// Atalho usado em toda a aplicação: gerente sempre pode; outro papel só se
// a permissão efetiva daquela chave estiver marcada.
function temPermissao(chave){
  return estado.papel === 'gerente' || !!estado.permissoes[chave];
}


/* ---------------------------------------------------------------------
   ESTADO
--------------------------------------------------------------------- */
const estado = {
  usuario:null, papel:null, nomeProfissional:null, permissoes:{},
  listas:{}, abaAtiva:'lancamento',
  editandoId:null, editandoMes:null, editandoAno:null, editandoContexto:null,
  conveniosSelecionados:[],
  // Cadastro de "qual(is) andar(es) cada profissional atende" — map
  // {prof: ['TÉRREO','COPARTICIPADOS', ...]}. Usado pra travar/filtrar o
  // campo Andar de acordo com o Profissional escolhido (ver
  // aplicarTravasCondicionadasDoFormulario).
  profissionaisAndares:{},
  // Mesma ideia, mas pra "quais procedimentos cada profissional realiza" —
  // map {prof: ['CONSULTA','CIRURGIA', ...]}.
  profissionaisProcedimentos:{},
  // Mesma ideia, mas pra "quais exames cada profissional pode realizar" —
  // map {prof: ['MAMAS','ABDOME TOTAL...', ...]}.
  profissionaisExames:{},
  // Cadastro de "quais profissionais cada atendente atende" — guardado nos
  // dois sentidos, porque a trava funciona em direções diferentes conforme
  // quem está logado (ver aplicarTravasCondicionadasDoFormulario):
  // atendentesProfissionais: {atendente: [prof, ...]}
  // profissionaisAtendentes: {prof: [atendente, ...]}
  atendentesProfissionais:{},
  profissionaisAtendentes:{},
  // Logo da clínica (base64) e cor primária personalizada (hex) — carregadas uma vez em
  // carregarNomeClinica() (sessao-login.js) e usadas pra trocar o selo "C" pela logo e
  // reaplicar a paleta salva. Ficam null enquanto a clínica não tiver configurado nada.
  logoClinica:null,
  corPrimaria:null
};
