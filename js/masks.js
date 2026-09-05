/**
 * VA Business - Vettore Finances v1.0.0
 * Desenvolvido por OliverStorage
 * Módulo: Máscaras de Input
 */

function maskCNPJ(value) {
  value = value.replace(/\D/g, '');
  if (value.length > 14) value = value.slice(0, 14);
  if (value.length >= 2) value = value.replace(/^(\d{2})/, '$1.');
  if (value.length >= 6) value = value.replace(/^(\d{2})\.(\d{3})/, '$1.$2.');
  if (value.length >= 10) value = value.replace(/^(\d{2})\.(\d{3})\.(\d{3})/, '$1.$2.$3/');
  if (value.length >= 14) value = value.replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})/, '$1.$2.$3/$4-');
  return value;
}

function maskCEP(value) {
  value = value.replace(/\D/g, '');
  if (value.length > 8) value = value.slice(0, 8);
  if (value.length >= 5) value = value.replace(/^(\d{5})/, '$1-');
  return value;
}

function maskPhone(value) {
  value = value.replace(/\D/g, '');
  if (value.length > 11) value = value.slice(0, 11);
  if (value.length >= 2) value = value.replace(/^(\d{2})/, '($1) ');
  if (value.length >= 8) value = value.replace(/^(\(\d{2}\) )(\d{5})/, '$1$2-');
  return value;
}

async function buscarCEP() {
  const cep = document.getElementById('inputCEP').value.replace(/\D/g, '');
  
  if (cep.length !== 8) {
    alert('CEP inválido (8 dígitos)');
    return;
  }
  
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await response.json();
    
    if (data.erro) {
      alert('CEP não encontrado');
      limparEndereco();
      return;
    }
    
    document.getElementById('inputRua').value = data.logradouro || '';
    document.getElementById('inputBairro').value = data.bairro || '';
    document.getElementById('inputCidade').value = data.localidade || '';
    document.getElementById('inputEstado').value = data.uf || '';
    document.getElementById('inputNumero').focus();
    
  } catch (error) {
    alert('Erro ao buscar CEP: ' + error.message);
    limparEndereco();
  }
}

function limparEndereco() {
  document.getElementById('inputRua').value = '';
  document.getElementById('inputBairro').value = '';
  document.getElementById('inputCidade').value = '';
  document.getElementById('inputEstado').value = '';
}
