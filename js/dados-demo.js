/* =====================================================================
   ProdClin — dados-demo.js
   Dados de demonstração — usados só quando SUPABASE_URL não está configurado (MODO_DEMO).
   Este arquivo é carregado via <script src> em index.html, na mesma ordem
   em que aparecia originalmente dentro do <script> único — variáveis e
   funções continuam compartilhando o escopo global, exatamente como antes.
===================================================================== */



/* ---------------------------------------------------------------------
   DADOS DE DEMONSTRAÇÃO (usados só quando SUPABASE_URL estiver vazio)
--------------------------------------------------------------------- */
const demo = {
  configuracoes: { nome_clinica: 'Clínica Cliza' },
  // chave "Mês-Ano" -> {taxa, rateio_clinica, rateio_coparticipado} — equivalente
  // à tabela `coparticipados` (uma linha global por mês, prof='GERAL').
  coparticipados: {},
  // chave "Mês-Ano" -> {faturamento_bruto, deducoes_impostos, ...} — equivalente à
  // tabela `financeiro_dre` (DRE mensal, cadastrado manualmente na aba Metas).
  financeiroDre: {},
  // Plano de contas (árvore, via conta_pai_codigo) — estrutura equivalente à
  // tabela `plano_contas`. Só contas-FOLHA (sem filhos) guardam valor — as
  // demais são só agrupadoras/somatórias, calculadas na hora.
  planoContas: [
    {codigo:'3', nome:'RECEITAS', conta_pai_codigo:null, natureza:'entrada', ordem:1},
    {codigo:'3.1', nome:'Receita Bruta de Serviços Prestados', conta_pai_codigo:'3', natureza:'entrada', ordem:1},
    {codigo:'3.1.1', nome:'Receitas de Serviços Médicos e Exames', conta_pai_codigo:'3.1', natureza:'entrada', ordem:1},
    {codigo:'3.1.1.01', nome:'Produção Térreo', conta_pai_codigo:'3.1.1', natureza:'entrada', ordem:1},
    {codigo:'3.1.1.02', nome:'Produção Coparticipados', conta_pai_codigo:'3.1.1', natureza:'entrada', ordem:2},
    {codigo:'3.1.1.03', nome:'Cirurgias', conta_pai_codigo:'3.1.1', natureza:'entrada', ordem:3},
    {codigo:'3.1.1.04', nome:'Polipectomias', conta_pai_codigo:'3.1.1', natureza:'entrada', ordem:4},
    {codigo:'3.1.1.05', nome:'Larbos', conta_pai_codigo:'3.1.1', natureza:'entrada', ordem:5},
    {codigo:'3.1.1.06', nome:'Pathus — Nosso Lucro', conta_pai_codigo:'3.1.1', natureza:'entrada', ordem:6},
    {codigo:'3.1.1.07', nome:'Produção do Sábado', conta_pai_codigo:'3.1.1', natureza:'entrada', ordem:7},
    {codigo:'3.1.2', nome:'Receitas de Locação e Diversas', conta_pai_codigo:'3.1', natureza:'entrada', ordem:2},
    {codigo:'3.1.2.01', nome:'Aluguéis de Sala', conta_pai_codigo:'3.1.2', natureza:'entrada', ordem:1},
    {codigo:'3.1.2.02', nome:'Receitas Diversas', conta_pai_codigo:'3.1.2', natureza:'entrada', ordem:2},
    {codigo:'3.2', nome:'Deduções da Receita Bruta', conta_pai_codigo:'3', natureza:'saida', ordem:2},
    {codigo:'3.2.01', nome:'Impostos Térreo', conta_pai_codigo:'3.2', natureza:'saida', ordem:1},
    {codigo:'3.2.02', nome:'Impostos Coparticipado', conta_pai_codigo:'3.2', natureza:'saida', ordem:2},
    {codigo:'3.2.03', nome:'Impostos sobre Aluguéis de Sala', conta_pai_codigo:'3.2', natureza:'saida', ordem:3},
    {codigo:'3.2.04', nome:'Provisão de ISS', conta_pai_codigo:'3.2', natureza:'saida', ordem:4},

    {codigo:'4', nome:'CUSTO DO SERVIÇO PRESTADO', conta_pai_codigo:null, natureza:'saida', ordem:2},
    {codigo:'4.1', nome:'Custos Diretos e Repasses Médicos', conta_pai_codigo:'4', natureza:'saida', ordem:1},
    {codigo:'4.1.1', nome:'Repasses e Coparticipação Médica', conta_pai_codigo:'4.1', natureza:'saida', ordem:1},
    {codigo:'4.1.1.01', nome:'Coparticipação Dra. Ivna', conta_pai_codigo:'4.1.1', natureza:'saida', ordem:1},
    {codigo:'4.1.1.02', nome:'Coparticipação Dr. Maurício', conta_pai_codigo:'4.1.1', natureza:'saida', ordem:2},
    {codigo:'4.1.2', nome:'Anestesia e Laboratório Especializado', conta_pai_codigo:'4.1', natureza:'saida', ordem:2},
    {codigo:'4.1.2.01', nome:'Anestesista Centro Cirúrgico', conta_pai_codigo:'4.1.2', natureza:'saida', ordem:1},
    {codigo:'4.1.2.02', nome:'Anestesista Clínica', conta_pai_codigo:'4.1.2', natureza:'saida', ordem:2},
    {codigo:'4.1.2.03', nome:'Gastos de Preparo', conta_pai_codigo:'4.1.2', natureza:'saida', ordem:3},
    {codigo:'4.1.3', nome:'Insumos e Materiais Aplicados', conta_pai_codigo:'4.1', natureza:'saida', ordem:3},
    {codigo:'4.1.3.01', nome:'Materiais Hospitalares Diretos', conta_pai_codigo:'4.1.3', natureza:'saida', ordem:1},

    {codigo:'5', nome:'DESPESAS OPERACIONAIS E FINANCEIRAS', conta_pai_codigo:null, natureza:'saida', ordem:3},
    {codigo:'5.1', nome:'Setor Pessoal', conta_pai_codigo:'5', natureza:'saida', ordem:1},
    {codigo:'5.1.01', nome:'Salários de Funcionários', conta_pai_codigo:'5.1', natureza:'saida', ordem:1},
    {codigo:'5.1.02', nome:'Horas Extras', conta_pai_codigo:'5.1', natureza:'saida', ordem:2},
    {codigo:'5.1.03', nome:'Férias de Funcionários', conta_pai_codigo:'5.1', natureza:'saida', ordem:3},
    {codigo:'5.1.04', nome:'FGTS e INSS', conta_pai_codigo:'5.1', natureza:'saida', ordem:4},
    {codigo:'5.1.05', nome:'Alimentação de Funcionários', conta_pai_codigo:'5.1', natureza:'saida', ordem:5},
    {codigo:'5.2', nome:'Compras e Manutenção', conta_pai_codigo:'5', natureza:'saida', ordem:2},
    {codigo:'5.2.01', nome:'Equipamentos e Materiais', conta_pai_codigo:'5.2', natureza:'saida', ordem:1},
    {codigo:'5.2.02', nome:'Manutenção das Instalações', conta_pai_codigo:'5.2', natureza:'saida', ordem:2},
    {codigo:'5.3', nome:'Despesas Operacionais e Administrativas', conta_pai_codigo:'5', natureza:'saida', ordem:3},
    {codigo:'5.3.01', nome:'Água, Energia e Internet', conta_pai_codigo:'5.3', natureza:'saida', ordem:1},
    {codigo:'5.3.02', nome:'Contabilidade', conta_pai_codigo:'5.3', natureza:'saida', ordem:2},
    {codigo:'5.3.03', nome:'Sistema / TI', conta_pai_codigo:'5.3', natureza:'saida', ordem:3},
    {codigo:'5.5', nome:'Despesas Financeiras', conta_pai_codigo:'5', natureza:'saida', ordem:4},
    {codigo:'5.5.01', nome:'Tarifas Bancárias', conta_pai_codigo:'5.5', natureza:'saida', ordem:1},
    {codigo:'5.5.02', nome:'Juros de Empréstimos', conta_pai_codigo:'5.5', natureza:'saida', ordem:2},
    {codigo:'5.6', nome:'Prolabore e Retiradas', conta_pai_codigo:'5', natureza:'saida', ordem:5},
    {codigo:'5.6.01', nome:'Retiradas Dr. Maurício', conta_pai_codigo:'5.6', natureza:'saida', ordem:1},
    {codigo:'5.6.02', nome:'Retiradas Dra. Ivna', conta_pai_codigo:'5.6', natureza:'saida', ordem:2}
  ],
  // chave "codigo|Mês-Ano" -> valor (número) — equivalente à tabela
  // `plano_contas_valores`. Seed de Junho/2026 batendo com o DRE real já
  // conferido (Resultado da operação: -R$ 28.607,14).
  planoContasValores: {
    '3.1.1.01|Junho-2026': 210917.03, '3.1.1.02|Junho-2026': 86936.54, '3.1.1.03|Junho-2026': 12600.00,
    '3.1.1.04|Junho-2026': 38321.26, '3.1.1.05|Junho-2026': 5425.00, '3.1.1.06|Junho-2026': 8830.00,
    '3.1.1.07|Junho-2026': 17118.57, '3.1.2.01|Junho-2026': 15250.90,
    '3.2.01|Junho-2026': 18093.00, '3.2.02|Junho-2026': 8473.95, '3.2.04|Junho-2026': 9632.92,
    '4.1.1.01|Junho-2026': 44581.24, '4.1.1.02|Junho-2026': 44581.23,
    '5.1.01|Junho-2026': 56880.39, '5.2.01|Junho-2026': 116200.19,
    '5.3.01|Junho-2026': 44525.50, '5.5.01|Junho-2026': 11138.55, '5.6.01|Junho-2026': 69899.47
  },
  // Lançamentos de exemplo do Fluxo de Caixa (regime de caixa — data exata,
  // diferente do plano de contas que só tem mês/ano). Equivalente à tabela
  // `fluxo_caixa`.
  fluxoCaixa: [
    {id:'fc1', data:'2026-06-01', descricao:'Tarifa bancária BNB', valor:105.00, tipo:'saida', banco:'BNB', conta_plano_codigo:'5.5.01'},
    {id:'fc2', data:'2026-06-02', descricao:'Recebimento Pix — atendimentos do dia', valor:3200.00, tipo:'entrada', banco:'Cora', conta_plano_codigo:null},
    {id:'fc3', data:'2026-06-15', descricao:'Pagamento encargos', valor:2333.18, tipo:'saida', banco:'BNB', conta_plano_codigo:'5.5.01'},
    {id:'fc4', data:'2026-06-15', descricao:'Transferência recebida', valor:11049.86, tipo:'entrada', banco:'BNB', conta_plano_codigo:null}
  ],
  // Lista de {prof, andar} — equivalente à tabela profissionais_andares.
  profissionaisAndares:[
    {prof:'ANGELINA', andar:'TÉRREO'},
    {prof:'LISIENE', andar:'TÉRREO'},
    {prof:'RENATA', andar:'COPARTICIPADOS'},
    {prof:'DR MARCELO USG', andar:'COPARTICIPADOS'}
  ],
  // Lista de {prof, procedimento} — equivalente à tabela profissionais_procedimentos.
  profissionaisProcedimentos:[
    {prof:'ANGELINA', procedimento:'SESSÃO'},
    {prof:'LISIENE', procedimento:'SESSÃO'},
    {prof:'RENATA', procedimento:'SESSÃO'},
    {prof:'DR MARCELO USG', procedimento:'USG'}
  ],
  // Lista de {prof, exame} — equivalente à tabela profissionais_exames.
  profissionaisExames:[
    {prof:'DR MARCELO USG', exame:'ABDOME TOTAL (ABDOME SUPERIOR, RINS, BEXIGA, AORTA, VEIA CAVA INFERIOR E ADRENAIS)'}
  ],
  // Lista de {atendente, prof} — equivalente à tabela atendentes_profissionais.
  atendentesProfissionais:[
    {atendente:'KAILLANY', prof:'ANGELINA'},
    {atendente:'KAILLANY', prof:'LISIENE'}
  ],
  usuarios:[
    {usuario:'gerente', senha:'gerente123', papel:'gerente', nome_profissional:'Coordenação'},
    {usuario:'angelina', senha:'123', papel:'profissional', nome_profissional:'ANGELINA'},
    {usuario:'lisiene', senha:'123', papel:'profissional', nome_profissional:'LISIENE'},
    {usuario:'renata', senha:'123', papel:'profissional', nome_profissional:'RENATA'},
    {usuario:'kaillany', senha:'123', papel:'atendente', nome_profissional:'KAILLANY'}
  ],
  // Sobrescritas individuais de permissão (equivalente à tabela `permissoes` do Supabase).
  // KAILLANY já entra com editar_verificar ligado, como pedido antes.
  permissoes:[
    {usuario:'kaillany', chave:'editar_verificar', valor:true}
  ],
  listas:{
    profissionais:['ANGELINA','AYANE CARNEIRO','CARLOTA','CLEIA','DANIELE ERTHAL','DR CARLOS AUGUSTO','DR CHARLES USG','DR MARCELO','DR MARCELO USG','DR MAURICIO','DR MAURICIO EXAMES','DR OSMAR','DRA AMANDA USG','DRA IVNA','DRA RICARLA USG','GABRIELE','ISABELLE','IZADORA ZARA','JAQUELANE PONTE','JOSEANE','KÁTIA RODRIGUES','KIMBERLY','LIA BRITO','LISIENE','MARILIA','RAFAELA MORAIS','RENATA','RONALDO GILDO','VALERIA','VICTOR MOREIRA'],
    convenios:['ASSEFAZ','BRADESCO','CAFAZ','CAMED','CAPESESP','CASSI','CORREIOS','FUNSA','GEAP','ISSEC','NF PLANO ABA','PARTICULAR','PREF CARIRÉ','PREF SOBRAL','SÃO CAMILO','SAÚDE CAIXA','SINDICATO','SULAMERICA','UNIMED','AMIL'],
    procedimentos:['SESSÃO','BIOIMPEDÂNCIA','CONSULTA','EXAMES','PROCEDIMENTO','USG','POLIPECTOMIA','MUCOSECTOMIA','PREPARO','RETORNO','OUTRO','MATERIAL','PHOPOSNEMA','CIRURGIA','ANESTESISTA','ANESTESISTA CONVÊNIO'],
    atendentes:['KAILLANY','ADRIELE','SOCORRO','GERMANA','LETICIA','ROBERTA','KEROLAINE','GLEIDY MARA'],
    turnos:['M','T'],
    formas_pagamento:['CONVÊNIO','PIX','CARTÃO','ESPÉCIE'],
    biopsias_frascos:['','1 FRASCO','2 FRASCOS','3 FRASCOS','4 FRASCOS','5 FRASCOS','6 FRASCOS','7 FRASCOS','8 FRASCOS','9 FRASCOS'],
    andares:['TÉRREO','COPARTICIPADOS'],
    exames:['MAMAS','ABDOME TOTAL (ABDOME SUPERIOR, RINS, BEXIGA, AORTA, VEIA CAVA INFERIOR E ADRENAIS)','ABDOME SUPERIOR (FÍGADO, VIAS BILIARES, VESÍCULA, PÂNCREAS E BAÇO)','ABDOME INFERIOR MASCULINO (BEXIGA, PRÓSTATA E VESÍCULAS SEMINAIS)','ABDOME INFERIOR FEMININO (BEXIGA, ÚTERO, OVÁRIO E ANEXOS)','DERMATOLÓGICO - PELE E SUBCUTÂNEO','ÓRGÃOS SUPERFICIAIS (TIREÓIDE OU ESCROTO OU PÊNIS OU CRÂNIO)','ARTICULAR (POR ARTICULAÇÃO)','OBSTÉTRICA','OBSTÉTRICA COM DOPPLER','OBSTÉTRICA MORFOLÓGICA','TRANSVAGINAL (ÚTERO, OVÁRIO, ANEXOS E VAGINA)','PRÓSTATA TRANSRETAL (NÃO INCLUI ABDOME INFERIOR MASCULINO)','PRÓSTATA (VIA ABDOMINAL)','APARELHO URINÁRIO (RINS, URETERES E BEXIGA)','PUNÇÃO BIÓPSIA/ASPIRATIVA DE ÓRGÃO OU ESTRUTURA SUPERFICIAL ORIENTADA POR US','COLONOSCOPIA','ENDOSCOPIA','AXILA','DOPPLER','PREPARO COLONOSCOPIA','POLIPECTOMIA DE EDA','POLIPECTOMIA DE COLON','PÉLVICA','CERVICAL','PAREDE ABDOMINAL','PARTES MOLES','MANOMETRIA','PHMETRIA','DOPPLER DE CARÓTIDAS'],
    especialidades:['Psicólogo','Nutricionista']
  },
  producao:[
    {id:'d1',prof:'ANGELINA',data:'2026-05-04',turno:'M',paciente:'YSE DE QUEIROZ PONTE',protocolo:'206774113',procedimento:'SESSÃO',exames:'',biopsias:'',convenio:'UNIMED',valor:35,forma_pagamento:'CONVÊNIO',atendente:'KAILLANY',andar:'TÉRREO',mes:'Maio',ano:2026},
    {id:'d2',prof:'ANGELINA',data:'2026-05-05',turno:'M',paciente:'LARA PAULA PESSOA ARAUJO',protocolo:'206861817',procedimento:'SESSÃO',exames:'',biopsias:'',convenio:'UNIMED',valor:35,forma_pagamento:'CONVÊNIO',atendente:'KAILLANY',andar:'TÉRREO',mes:'Maio',ano:2026},
    {id:'d3',prof:'LISIENE',data:'2026-05-04',turno:'T',paciente:'KHYO RAMON ANJOS CUNHA',protocolo:'206632649',procedimento:'SESSÃO',exames:'',biopsias:'',convenio:'UNIMED',valor:35,forma_pagamento:'CONVÊNIO',atendente:'KAILLANY',andar:'TÉRREO',mes:'Maio',ano:2026},
    {id:'d4',prof:'LISIENE',data:'2026-05-06',turno:'T',paciente:'MIRYAN LIRA VIANA',protocolo:'',procedimento:'SESSÃO',exames:'',biopsias:'',convenio:'',valor:120,forma_pagamento:'ESPÉCIE',atendente:'KAILLANY',andar:'TÉRREO',mes:'Maio',ano:2026},
    {id:'d5',prof:'RENATA',data:'2026-05-07',turno:'M',paciente:'MARIA CLARA SILVA ARAUJO',protocolo:'207794248',procedimento:'SESSÃO',exames:'',biopsias:'',convenio:'UNIMED',valor:35,forma_pagamento:'CONVÊNIO',atendente:'ADRIELE',andar:'COPARTICIPADOS',mes:'Maio',ano:2026},
    {id:'d6',prof:'DR MARCELO USG',data:'2026-05-08',turno:'T',paciente:'FRANCISCO M G NOBRE JR',protocolo:'207751609',procedimento:'USG',exames:'ABDOME TOTAL (ABDOME SUPERIOR, RINS, BEXIGA, AORTA, VEIA CAVA INFERIOR E ADRENAIS)',biopsias:'',convenio:'UNIMED',valor:120,forma_pagamento:'CONVÊNIO',atendente:'SOCORRO',andar:'COPARTICIPADOS',mes:'Maio',ano:2026},
    {id:'d7',prof:'DR CHARLES USG',data:'2026-05-08',turno:'M',paciente:'JOÃO PEDRO LIMA',protocolo:'207751610',procedimento:'USG',exames:'TRANSVAGINAL (ÚTERO, OVÁRIO, ANEXOS E VAGINA)',biopsias:'',convenio:'CASSI',valor:140,forma_pagamento:'CONVÊNIO',atendente:'ROBERTA',andar:'COPARTICIPADOS',mes:'Maio',ano:2026},
    {id:'d8',prof:'DR MAURICIO EXAMES',data:'2026-05-09',turno:'M',paciente:'MARIA EDUARDA COSTA',protocolo:'207751611',procedimento:'PROCEDIMENTO',exames:'COLONOSCOPIA',biopsias:'2 FRASCOS',convenio:'BRADESCO',valor:850,forma_pagamento:'CONVÊNIO',atendente:'GERMANA',andar:'COPARTICIPADOS',mes:'Maio',ano:2026},
    {id:'d9',prof:'DR MAURICIO',data:'2026-05-09',turno:'T',paciente:'PEDRO HENRIQUE ALVES',protocolo:'207751612',procedimento:'PROCEDIMENTO',exames:'ENDOSCOPIA',biopsias:'1 FRASCO',convenio:'UNIMED',valor:620,forma_pagamento:'CONVÊNIO',atendente:'LETICIA',andar:'COPARTICIPADOS',mes:'Maio',ano:2026},
    {id:'d10',prof:'GABRIELE',data:'2026-05-10',turno:'M',paciente:'ANA CLARA MENDES',protocolo:'',procedimento:'BIOIMPEDÂNCIA',exames:'',biopsias:'',convenio:'',valor:80,forma_pagamento:'PIX',atendente:'ADRIELE',andar:'TÉRREO',mes:'Maio',ano:2026},
    {id:'d11',prof:'ISABELLE',data:'2026-05-11',turno:'T',paciente:'LUCAS GABRIEL SOUZA',protocolo:'207751613',procedimento:'CONSULTA',exames:'',biopsias:'',convenio:'SÃO CAMILO',valor:250,forma_pagamento:'CONVÊNIO',atendente:'KEROLAINE',andar:'TÉRREO',mes:'Maio',ano:2026},
    {id:'d12',prof:'DRA RICARLA USG',data:'2026-05-11',turno:'M',paciente:'BEATRIZ OLIVEIRA',protocolo:'207751614',procedimento:'USG',exames:'OBSTÉTRICA MORFOLÓGICA',biopsias:'',convenio:'PARTICULAR',valor:380,forma_pagamento:'CARTÃO',atendente:'ROBERTA',andar:'COPARTICIPADOS',mes:'Maio',ano:2026},
    {id:'d13',prof:'DR MARCELO',data:'2026-05-12',turno:'T',paciente:'RAFAEL COSTA LIMA',protocolo:'207751615',procedimento:'RETORNO',exames:'',biopsias:'',convenio:'GEAP',valor:60,forma_pagamento:'CONVÊNIO',atendente:'GLEIDY MARA',andar:'COPARTICIPADOS',mes:'Maio',ano:2026},
    {id:'d14',prof:'DRA AMANDA USG',data:'2026-05-12',turno:'M',paciente:'CAMILA FERREIRA',protocolo:'',procedimento:'USG',exames:'MAMAS',biopsias:'',convenio:'',valor:180,forma_pagamento:'ESPÉCIE',atendente:'SOCORRO',andar:'TÉRREO',mes:'Maio',ano:2026}
  ],
  pacientes:[
    {
      "id": "1c465176-7ffc-4c9f-905e-54c9cb0053d7",
      "nome": "YSE DE QUEIROZ PONTE",
      "whatsapp": null,
      "endereco": null
    },
    {
      "id": "6e749046-1c67-4de0-8d57-383c86c4b14d",
      "nome": "LARA PAULA PESSOA ARAUJO",
      "whatsapp": null,
      "endereco": null
    },
    {
      "id": "2173b541-7f66-4f88-8ceb-252ed5b13b0c",
      "nome": "KHYO RAMON ANJOS CUNHA",
      "whatsapp": null,
      "endereco": null
    },
    {
      "id": "d9c7cec9-d803-4773-936d-8f7768471142",
      "nome": "MIRYAN LIRA VIANA",
      "whatsapp": null,
      "endereco": null
    },
    {
      "id": "4609b29f-c874-415d-8229-93870b85ee6f",
      "nome": "MARIA CLARA SILVA ARAUJO",
      "whatsapp": null,
      "endereco": null
    },
    {
      "id": "4ffdfe09-816c-4b64-b9a7-74494875580c",
      "nome": "FRANCISCO M G NOBRE JR",
      "whatsapp": null,
      "endereco": null
    },
    {
      "id": "f328667a-e09b-4381-93cb-37ff83bef724",
      "nome": "JOÃO PEDRO LIMA",
      "whatsapp": null,
      "endereco": null
    },
    {
      "id": "ef617923-d078-468d-8f6e-3cdb7f87e02c",
      "nome": "MARIA EDUARDA COSTA",
      "whatsapp": null,
      "endereco": null
    },
    {
      "id": "fa99707d-eaf7-4187-9bf5-51e9f74d62a1",
      "nome": "PEDRO HENRIQUE ALVES",
      "whatsapp": null,
      "endereco": null
    },
    {
      "id": "90a67ead-ac5a-44d6-af64-867a08fab528",
      "nome": "ANA CLARA MENDES",
      "whatsapp": null,
      "endereco": null
    },
    {
      "id": "e2a3f8d0-7d16-4902-b27f-c078bb2004cf",
      "nome": "LUCAS GABRIEL SOUZA",
      "whatsapp": null,
      "endereco": null
    },
    {
      "id": "5f4977a7-bb28-4216-a877-6b317ba6afc4",
      "nome": "BEATRIZ OLIVEIRA",
      "whatsapp": null,
      "endereco": null
    },
    {
      "id": "71519630-5fdf-460f-a9e0-f2e8af137eec",
      "nome": "RAFAEL COSTA LIMA",
      "whatsapp": null,
      "endereco": null
    },
    {
      "id": "3aa75d47-e968-4e68-9ee6-50408cd4cab1",
      "nome": "CAMILA FERREIRA",
      "whatsapp": null,
      "endereco": null
    }
  ],
  profissionais:[
    {
      "id": "c1c4d801-9167-49b6-ae92-c2da06346059",
      "nome": "ANGELINA",
      "telefone": null,
      "registro_profissional": null,
      "especialidade": null,
      "observacoes": null
    },
    {
      "id": "4773a63e-7c5f-4407-8279-9fd97de62c8a",
      "nome": "LISIENE",
      "telefone": null,
      "registro_profissional": null,
      "especialidade": null,
      "observacoes": null
    },
    {
      "id": "05aad5fd-303d-4db8-a766-1de09eac13fd",
      "nome": "RENATA",
      "telefone": null,
      "registro_profissional": null,
      "especialidade": null,
      "observacoes": null
    },
    {
      "id": "2aae43da-ffe7-4ca7-b7e2-0d1d80b19c58",
      "nome": "DR MARCELO USG",
      "telefone": null,
      "registro_profissional": null,
      "especialidade": null,
      "observacoes": null
    },
    {
      "id": "b2b93f39-46a3-4090-8f93-6ddeb4098e1f",
      "nome": "DR CHARLES USG",
      "telefone": null,
      "registro_profissional": null,
      "especialidade": null,
      "observacoes": null
    },
    {
      "id": "94c0f3e5-c883-480d-bbaf-cee7044ccf44",
      "nome": "DR MAURICIO EXAMES",
      "telefone": null,
      "registro_profissional": null,
      "especialidade": null,
      "observacoes": null
    },
    {
      "id": "54e86d13-ebef-410b-a40f-2dc6514d7b67",
      "nome": "DR MAURICIO",
      "telefone": null,
      "registro_profissional": null,
      "especialidade": null,
      "observacoes": null
    },
    {
      "id": "8f60dee6-5b6a-486a-a22f-93fb518aa0c5",
      "nome": "GABRIELE",
      "telefone": null,
      "registro_profissional": null,
      "especialidade": null,
      "observacoes": null
    },
    {
      "id": "b19b7228-da39-4531-a6a7-527405e5d3bd",
      "nome": "ISABELLE",
      "telefone": null,
      "registro_profissional": null,
      "especialidade": null,
      "observacoes": null
    },
    {
      "id": "64b8c58d-8bcf-41c8-b96a-da6f512ef04e",
      "nome": "DRA RICARLA USG",
      "telefone": null,
      "registro_profissional": null,
      "especialidade": null,
      "observacoes": null
    },
    {
      "id": "6300caeb-24e7-4efc-ab17-a3f7cb2d9d9b",
      "nome": "DR MARCELO",
      "telefone": null,
      "registro_profissional": null,
      "especialidade": null,
      "observacoes": null
    },
    {
      "id": "f182b1c0-f2e5-4200-bba4-337056a50d05",
      "nome": "DRA AMANDA USG",
      "telefone": null,
      "registro_profissional": null,
      "especialidade": null,
      "observacoes": null
    }
  ],
  fornecedores:[
    {id:'demo-forn-1', nome:'Cirúrgica Fernandes', cnpj:'12.345.678/0001-90', contato:'(88) 3211-0000'},
    {id:'demo-forn-2', nome:'MedHosp Distribuidora', cnpj:'98.765.432/0001-10', contato:'(85) 3055-1122'}
  ],
  materiais:[
    {id:'demo-mat-1', nome:'Seringa 10ml', categoria:'Descartável', unidade:'unidade', estoque_minimo:50, ativo:true},
    {id:'demo-mat-2', nome:'Luva Cirúrgica (par)', categoria:'EPI', unidade:'par', estoque_minimo:100, ativo:true},
    {id:'demo-mat-3', nome:'Gaze Estéril', categoria:'Curativo', unidade:'pacote', estoque_minimo:30, ativo:true}
  ],
  estoqueLotes:[
    {id:'demo-lote-1', material_id:'demo-mat-1', fornecedor_id:'demo-forn-1', lote:'L2026A', nota_fiscal:'4521', data_entrada:'2026-06-10', validade:'2027-06-10', quantidade_entrada:200, quantidade_atual:120, valor_unitario:0.85},
    {id:'demo-lote-2', material_id:'demo-mat-2', fornecedor_id:'demo-forn-2', lote:'L890', nota_fiscal:'7788', data_entrada:'2026-07-01', validade:'2026-09-15', quantidade_entrada:300, quantidade_atual:40, valor_unitario:1.20},
    {id:'demo-lote-3', material_id:'demo-mat-3', fornecedor_id:'demo-forn-1', lote:'G102', nota_fiscal:'4521', data_entrada:'2026-06-10', validade:'2026-12-01', quantidade_entrada:80, quantidade_atual:65, valor_unitario:2.10}
  ],
  solicitacoesMaterial:[
    {id:'demo-sol-1', material_id:'demo-mat-2', profissional_id:null, procedimento:'CIRURGIA', exame:null, quantidade:10, status:'pendente', observacao:null, solicitado_por:'DR MAURICIO', solicitado_em:new Date().toISOString()}
  ],
  dispensacoes:[],
  faturamentoNotas:[
    {cartao_beneficiario:'0123456789012345', nome_beneficiario:'MARIA CLARA SILVA ARAUJO'},
    {cartao_beneficiario:'0123456789099999', nome_beneficiario:'JOAO PEDRO OLIVEIRA'},
    {cartao_beneficiario:'0123456789055555', nome_beneficiario:'RAFAEL COSTA LIMA'}
  ],
  pacienteConvenioVinculo:[],
  metas:[
    {prof:'ANGELINA', mes:'Maio', ano:2026, turnos_utilizados:2, valor_minimo_turno:294},
    {prof:'LISIENE', mes:'Maio', ano:2026, turnos_utilizados:2, valor_minimo_turno:294},
    {prof:'RENATA', mes:'Maio', ano:2026, turnos_utilizados:1, valor_minimo_turno:567},
    {prof:'DR MARCELO USG', mes:'Maio', ano:2026, turnos_utilizados:1, valor_minimo_turno:938}
  ],
  notas:{}
};
