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
    exames:['MAMAS','ABDOME TOTAL (ABDOME SUPERIOR, RINS, BEXIGA, AORTA, VEIA CAVA INFERIOR E ADRENAIS)','ABDOME SUPERIOR (FÍGADO, VIAS BILIARES, VESÍCULA, PÂNCREAS E BAÇO)','ABDOME INFERIOR MASCULINO (BEXIGA, PRÓSTATA E VESÍCULAS SEMINAIS)','ABDOME INFERIOR FEMININO (BEXIGA, ÚTERO, OVÁRIO E ANEXOS)','DERMATOLÓGICO - PELE E SUBCUTÂNEO','ÓRGÃOS SUPERFICIAIS (TIREÓIDE OU ESCROTO OU PÊNIS OU CRÂNIO)','ARTICULAR (POR ARTICULAÇÃO)','OBSTÉTRICA','OBSTÉTRICA COM DOPPLER','OBSTÉTRICA MORFOLÓGICA','TRANSVAGINAL (ÚTERO, OVÁRIO, ANEXOS E VAGINA)','PRÓSTATA TRANSRETAL (NÃO INCLUI ABDOME INFERIOR MASCULINO)','PRÓSTATA (VIA ABDOMINAL)','APARELHO URINÁRIO (RINS, URETERES E BEXIGA)','PUNÇÃO BIÓPSIA/ASPIRATIVA DE ÓRGÃO OU ESTRUTURA SUPERFICIAL ORIENTADA POR US','COLONOSCOPIA','ENDOSCOPIA','AXILA','DOPPLER','PREPARO COLONOSCOPIA','POLIPECTOMIA DE EDA','POLIPECTOMIA DE COLON','PÉLVICA','CERVICAL','PAREDE ABDOMINAL','PARTES MOLES','MANOMETRIA','PHMETRIA','DOPPLER DE CARÓTIDAS']
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
  metas:[
    {prof:'ANGELINA', mes:'Maio', ano:2026, turnos_disponibilizados:6, meta_valor:1764, meta_qtd:55},
    {prof:'LISIENE', mes:'Maio', ano:2026, turnos_disponibilizados:25, meta_valor:7350, meta_qtd:170},
    {prof:'RENATA', mes:'Maio', ano:2026, turnos_disponibilizados:36, meta_valor:20412, meta_qtd:176},
    {prof:'DR MARCELO USG', mes:'Maio', ano:2026, turnos_disponibilizados:16, meta_valor:15000, meta_qtd:158}
  ],
  notas:{}
};
