/* =====================================================================
   ProdClin — sessao-login.js
   Sessão salva no localStorage, tela de login, modal 'Minha conta' e nome da clínica exibido
   no topo/tela de login.
   Este arquivo é carregado via <script src> em index.html, na mesma ordem
   em que aparecia originalmente dentro do <script> único — variáveis e
   funções continuam compartilhando o escopo global, exatamente como antes.
===================================================================== */

const CHAVE_SESSAO = 'prodclin_sessao';


function salvarSessao(){
  try{
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify({
      usuario: estado.usuario, papel: estado.papel, nomeProfissional: estado.nomeProfissional,
      permissoes: estado.permissoes
    }));
  }catch(e){ /* navegador pode bloquear localStorage (ex.: modo privado) — segue sem persistir sessão */ }
}


function limparSessao(){
  try{ localStorage.removeItem(CHAVE_SESSAO); }catch(e){}
}


function carregarSessaoSalva(){
  try{
    const bruto = localStorage.getItem(CHAVE_SESSAO);
    return bruto ? JSON.parse(bruto) : null;
  }catch(e){ return null; }
}


/* ---------------------------------------------------------------------
   LOGIN
--------------------------------------------------------------------- */
if(MODO_DEMO){
  document.getElementById('contas-demo').innerHTML =
    '<b>Contas de demonstração</b><br>Gerente → usuário <b>gerente</b> / senha <b>gerente123</b><br>Profissional → usuário <b>angelina</b> / senha <b>123</b><br>Atendente → usuário <b>kaillany</b> / senha <b>123</b>';
}


// Se já existir uma sessão salva de uma visita anterior, entra direto —
// sem isso, atualizar a página (F5) sempre derrubava a pessoa pro login.
(function tentarRetomarSessao(){
  const sessao = carregarSessaoSalva();
  if(!sessao || !sessao.usuario) return;
  estado.usuario = sessao.usuario;
  estado.papel = sessao.papel;
  estado.nomeProfissional = sessao.nomeProfissional;
  estado.permissoes = sessao.permissoes || {};
  iniciarApp().catch(()=>limparSessao());
})();


document.getElementById('form-login').addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  const usuario = document.getElementById('usuario').value.trim();
  const senha = document.getElementById('senha').value.trim();
  const erroEl = document.getElementById('erro-login');
  erroEl.textContent = 'Entrando...';
  try{
    const resp = await api('login', {usuario, senha});
    if(!resp.ok){ erroEl.textContent = resp.erro || 'Não foi possível entrar.'; return; }
    estado.usuario = resp.usuario;
    estado.papel = resp.papel;
    estado.nomeProfissional = resp.nomeProfissional;
    estado.permissoes = resp.permissoes || {};
    salvarSessao();
    await iniciarApp();
  }catch(e){
    erroEl.textContent = 'Erro de conexão com o servidor.';
  }
});


document.getElementById('botao-sair').addEventListener('click', ()=>{
  limparSessao();
  location.reload();
});


/* ---------------------------------------------------------------------
   MINHA CONTA — trocar nome exibido e/ou senha (qualquer usuário)
--------------------------------------------------------------------- */
document.getElementById('botao-minha-conta').addEventListener('click', ()=>{
  document.getElementById('conta-nome').value = estado.nomeProfissional || '';
  document.getElementById('conta-senha-atual').value = '';
  document.getElementById('conta-nova-senha').value = '';
  document.getElementById('conta-confirmar-senha').value = '';
  document.getElementById('conta-mensagem').textContent = '';
  document.getElementById('sobreposicao-conta').classList.add('aberta');
});
document.getElementById('botao-cancelar-conta').addEventListener('click', ()=>{
  document.getElementById('sobreposicao-conta').classList.remove('aberta');
});
document.getElementById('sobreposicao-conta').addEventListener('click', (ev)=>{
  if(ev.target.id==='sobreposicao-conta') document.getElementById('sobreposicao-conta').classList.remove('aberta');
});


document.getElementById('form-conta').addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  const mensagemEl = document.getElementById('conta-mensagem');
  const novoNome = document.getElementById('conta-nome').value.trim();
  const senhaAtual = document.getElementById('conta-senha-atual').value;
  const novaSenha = document.getElementById('conta-nova-senha').value;
  const confirmarSenha = document.getElementById('conta-confirmar-senha').value;


  if(!novoNome){ mensagemEl.style.color='var(--danger)'; mensagemEl.textContent='O nome não pode ficar em branco.'; return; }
  if(novaSenha && novaSenha !== confirmarSenha){
    mensagemEl.style.color = 'var(--danger)';
    mensagemEl.textContent = 'A nova senha e a confirmação não são iguais.';
    return;
  }


  mensagemEl.style.color = 'var(--ink-400)';
  mensagemEl.textContent = 'Salvando...';
  const resp = await api('alterarConta', {usuario: estado.usuario, senhaAtual, novoNome, novaSenha});
  if(!resp.ok){
    mensagemEl.style.color = 'var(--danger)';
    mensagemEl.textContent = resp.erro || 'Não foi possível salvar.';
    return;
  }


  estado.nomeProfissional = novoNome;
  document.getElementById('nome-usuario-topo').textContent = novoNome;
  salvarSessao();
  mensagemEl.style.color = 'var(--teal-700)';
  mensagemEl.textContent = 'Salvo com sucesso!';
  setTimeout(()=>document.getElementById('sobreposicao-conta').classList.remove('aberta'), 900);
});


/* ---------------------------------------------------------------------
   NOME DA CLÍNICA — carregado já na tela de login, salvo na planilha
--------------------------------------------------------------------- */
let nomeClinicaAtual = 'Clínica';
async function carregarNomeClinica(){
  try{
    const resp = await api('obterConfiguracoes', {});
    nomeClinicaAtual = (resp.configuracoes && resp.configuracoes.nome_clinica) || 'Clínica';
    // Logo e cor principal personalizadas (ver LOGO E CORES em configuracoes.js) —
    // aplicadas já na tela de login, antes de qualquer usuário entrar, e ficam
    // guardadas em estado pra a aba Configurações mostrar a prévia depois.
    estado.logoClinica = (resp.configuracoes && resp.configuracoes.logo_clinica) || null;
    estado.corPrimaria = (resp.configuracoes && resp.configuracoes.cor_primaria) || null;
    if(estado.logoClinica) aplicarLogoNosSelo(estado.logoClinica);
    if(estado.corPrimaria) aplicarPaletaCor(estado.corPrimaria);
  }catch(e){
    nomeClinicaAtual = 'Clínica';
  }
  document.getElementById('subtitulo-login').textContent = 'Acesso restrito à equipe — ' + nomeClinicaAtual;
  document.getElementById('nome-clinica-topo').textContent = nomeClinicaAtual;
}
carregarNomeClinica();
