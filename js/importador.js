/**
 * Vettore Finances - Importador de Extratos v1.9.0
 * Salva em Supabase com suporte a edição
 */

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  console.log('📤 Upload iniciado:', file.name);
  
  const user = JSON.parse(localStorage.getItem('currentUser'));
  const banco = document.getElementById('inputBanco').value;
  const agencia = document.getElementById('inputAgencia').value;
  const conta = document.getElementById('inputConta').value;

  if (!banco || !agencia || !conta) {
    alert('⚠️ Preencha Banco, Agência e Conta!');
    return;
  }

  if (typeof XLSX === 'undefined') {
    alert('❌ XLSX não disponível');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = e.target.result;
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Detectar mês e ano do arquivo
      const { mes, ano } = detectarMesAno(json, file.name);
      
      console.log(`📅 Detectado: ${mes}/${ano}`);
      
      const extratos = parseXLS(json, user.unidade_id, mes, ano, banco, agencia, conta);
      
      if (extratos.length === 0) {
        alert('⚠️ Nenhum extrato válido encontrado');
        return;
      }
      
      salvarExtratosSupabase(extratos);
    } catch (error) {
      console.error('❌ Erro:', error);
      alert('Erro: ' + error.message);
    }
  };
  
  reader.readAsArrayBuffer(file);
}

function detectarMesAno(dados, nomeArquivo) {
  let mes = String(new Date().getMonth() + 1).padStart(2, '0');
  let ano = new Date().getFullYear();

  // Tentar extrair do nome do arquivo (ex: extrato_07_2026.xlsx)
  const regexFileName = /(\d{1,2})[-_](\d{4})/;
  const matchFileName = nomeArquivo.match(regexFileName);
  if (matchFileName) {
    mes = String(parseInt(matchFileName[1])).padStart(2, '0');
    ano = parseInt(matchFileName[2]);
    return { mes, ano };
  }

  // Tentar extrair da primeira data da planilha
  for (let i = 0; i < Math.min(30, dados.length); i++) {
    const row = dados[i];
    if (row && row[0]) {
      const dateStr = String(row[0]);
      const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (dateMatch) {
        mes = String(parseInt(dateMatch[2])).padStart(2, '0');
        ano = parseInt(dateMatch[3]);
        return { mes, ano };
      }
    }
  }

  return { mes, ano };
}

function parseValorBR(valor) {
  if (typeof valor === 'number') {
    return valor;
  }
  
  if (!valor || typeof valor !== 'string') {
    return 0;
  }

  // Detectar se valor está entre parênteses (negativo)
  const isNegativo = valor.trim().startsWith('(') && valor.trim().endsWith(')');
  
  // Remover parênteses, R$, espaços
  let cleaned = valor.trim()
    .replace(/[()]/g, '')
    .replace(/R\$\s*/g, '')
    .trim();
  
  // Converter formato BR (1.234,56) para internacional (1234.56)
  cleaned = cleaned
    .replace(/\./g, '')  // Remove pontos de milhar
    .replace(',', '.');  // Substitui vírgula por ponto
  
  let num = parseFloat(cleaned) || 0;
  
  // Aplicar sinal negativo se estava entre parênteses
  if (isNegativo && num > 0) {
    num = -num;
  }
  
  return num;
}

function parseXLS(dados, unidadeId, mes, ano, banco, agencia, conta) {
  let extratos = [];
  
  let headerIdx = -1;
  for (let i = 0; i < Math.min(20, dados.length); i++) {
    const row = dados[i];
    if (!row) continue;
    
    const str = (row.join('') || '').toLowerCase();
    if ((str.includes('data') || str.includes('date')) && 
        (str.includes('descri') || str.includes('histórico') || str.includes('detail')) && 
        str.includes('valor')) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    for (let i = 0; i < Math.min(20, dados.length); i++) {
      const row = dados[i];
      if (row && row.filter(cell => cell !== null && cell !== undefined && cell !== '').length >= 3) {
        headerIdx = i;
        break;
      }
    }
  }

  if (headerIdx === -1) {
    throw new Error('Não foi possível detectar o formato');
  }

  for (let i = headerIdx + 1; i < dados.length; i++) {
    const row = dados[i];
    if (!row || row.length < 2) continue;

    const data = row[0];
    const descricao = row[1];
    const codigo = row[2] || '';
    const valor = parseValorBR(row[3]);

    if (!data || !descricao || valor === 0) continue;

    let dataFormatada = data;
    if (typeof data === 'number') {
      const d = new Date((data - 25569) * 86400 * 1000);
      dataFormatada = String(d.getFullYear()) + '-' + 
                      String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(d.getDate()).padStart(2, '0');
    } else if (typeof data === 'string') {
      const parts = data.split('/');
      if (parts.length === 3) {
        dataFormatada = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    extratos.push({
      unidade_id: unidadeId,
      banco: banco,
      agencia: agencia,
      conta: conta,
      mes: mes,
      ano: ano,
      data: dataFormatada,
      descricao: String(descricao).trim(),
      codigo: String(codigo).trim(),
      valor: valor,
      historico_correcao: null,
      data_referencia: null,
      categoria: null,
      servicos: null,
      cliente: null,
      observacao: null
    });
  }

  return extratos;
}

async function salvarExtratosSupabase(extratos) {
  try {
    for (const extrato of extratos) {
      await SupabaseAPI.insert('extratos', extrato);
    }

    console.log('✅ Importados:', extratos.length);
    alert(`✅ ${extratos.length} extratos importados com sucesso!`);
    
    document.getElementById('fileInput').value = '';
    if (typeof loadExtratos === 'function') {
      loadExtratos();
    }
  } catch (error) {
    console.error('❌ Erro ao salvar:', error);
    alert('Erro ao salvar: ' + error.message);
  }
}
