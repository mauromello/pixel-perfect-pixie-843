export function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 100000;
  return h;
}

export const fontesBalanco = [
  { id: "b1", elemento: "SE Taquaril", sistema: "SCADA", injetada: 48210, faturada: 42950, confiavel: true },
  { id: "b2", elemento: "SE Neves", sistema: "MDM", injetada: 39880, faturada: 33120, confiavel: true },
  { id: "b3", elemento: "UBE-AL01 Uberlândia-Centro", sistema: "SCADA", injetada: 21400, faturada: 18990, confiavel: true },
  { id: "b4", elemento: "JUI-AL02 Juiz de Fora 1", sistema: "Comercial (CIS)", injetada: 18760, faturada: 19480, confiavel: false },
  { id: "b5", elemento: "TR-MON-4501 Montes Claros", sistema: "AMI", injetada: 812, faturada: 701, confiavel: true },
];

// Alimentadores usados na simulação de manobras (energia mensal em MWh)
export const alimentadoresManobra = [
  { cod: "TAQ-AL01", se: "SE Taquaril", injetada: 12850, faturada: 11210 },
  { cod: "TAQ-AL02", se: "SE Taquaril", injetada: 10420, faturada: 9180 },
  { cod: "NEV-AL01", se: "SE Neves", injetada: 9870, faturada: 8540 },
  { cod: "NEV-AL02", se: "SE Neves", injetada: 11230, faturada: 9960 },
  { cod: "UBE-AL01", se: "SE Uberlândia-Centro", injetada: 14320, faturada: 12880 },
  { cod: "UBE-AL02", se: "SE Uberlândia-Sul", injetada: 8760, faturada: 7710 },
  { cod: "JUI-AL01", se: "SE Juiz de Fora 1", injetada: 9540, faturada: 8350 },
  { cod: "JUI-AL02", se: "SE Juiz de Fora 4", injetada: 7980, faturada: 7020 },
];

export const chavesManobra = ["CH-NA TAQ/NEV 01", "RL-TAQ201", "RL-NEV101", "CH-NA UBE 05", "RL-UBE102", "CH-NA JUI 03"];

export const elementosProjecao = ["Distribuidora MG (Global)", "Regional Metropolitana", "Regional Triângulo", "Regional Norte", "Regional Sul", "Regional Zona da Mata"];

export const fontesDados = [
  { cat: "Dados Históricos", origem: "Data Lake / Parquet", status: "Sincronizado", volume: "4,8 TB", ultima: "há 5 min", sync: 100 },
  { cat: "Mercado", origem: "CIS Comercial", status: "Sincronizado", volume: "612 GB", ultima: "há 12 min", sync: 100 },
  { cat: "Climáticos (MG)", origem: "INMET — estações BH, Uberlândia, Montes Claros", status: "Sincronizando", volume: "38 GB", ultima: "em curso", sync: 72 },
  { cat: "Medições de Fronteiras", origem: "SMF / CCEE", status: "Sincronizado", volume: "1,2 TB", ultima: "há 1 h", sync: 100 },
  { cat: "GD/GC", origem: "Cadastro GD / ONS", status: "Falha", volume: "74 GB", ultima: "há 2 dias", sync: 35 },
  { cat: "Registo de Manobras", origem: "ADMS / OMS", status: "Sincronizado", volume: "205 GB", ultima: "há 2 min", sync: 100 },
  { cat: "Dados Geoespaciais", origem: "GIS (BDGD ANEEL)", status: "Atrasado", volume: "910 GB", ultima: "há 9 h", sync: 88 },
];

export const perfis = [
  { perfil: "Administrador", grupoAD: "GG-PERDAS-ADMIN", usuarios: 3, balanco: "Editar", projecao: "Editar", mapas: "Ver", ia: "Editar", admin: "Editar" },
  { perfil: "Analista de Perdas", grupoAD: "GG-PERDAS-ANALISTA", usuarios: 18, balanco: "Editar", projecao: "Editar", mapas: "Ver", ia: "Ver", admin: "—" },
  { perfil: "Operação de Campo", grupoAD: "GG-PERDAS-CAMPO", usuarios: 42, balanco: "Ver", projecao: "—", mapas: "Ver", ia: "—", admin: "—" },
  { perfil: "Auditoria / Regulatório", grupoAD: "GG-PERDAS-AUDIT", usuarios: 5, balanco: "Ver", projecao: "Ver", mapas: "Ver", ia: "Ver", admin: "Ver" },
];

export const usuariosAD = [
  { login: "ana.souza", nome: "Ana Souza", ou: "OU=Perdas,OU=BH", perfil: "Administrador", ativo: true, ultimo: "16/10/2026 09:12" },
  { login: "carlos.m", nome: "Carlos Mendes", ou: "OU=Perdas,OU=Uberlandia", perfil: "Analista de Perdas", ativo: true, ultimo: "16/10/2026 08:47" },
  { login: "juliana.r", nome: "Juliana Ribeiro", ou: "OU=Campo,OU=JuizDeFora", perfil: "Operação de Campo", ativo: true, ultimo: "15/10/2026 17:30" },
  { login: "pedro.alves", nome: "Pedro Alves", ou: "OU=Campo,OU=MontesClaros", perfil: "Operação de Campo", ativo: false, ultimo: "02/09/2026 11:05" },
  { login: "marina.c", nome: "Marina Costa", ou: "OU=Regulatorio,OU=BH", perfil: "Auditoria / Regulatório", ativo: true, ultimo: "14/10/2026 14:22" },
  { login: "rafael.l", nome: "Rafael Lima", ou: "OU=Perdas,OU=Varginha", perfil: "Analista de Perdas", ativo: true, ultimo: "16/10/2026 07:58" },
];

export const pontosMapa = [
  { nome: "Regional Metropolitana", tipo: "Regional", lat: -19.92, lng: -43.94 },
  { nome: "Regional Triângulo", tipo: "Regional", lat: -18.92, lng: -48.28 },
  { nome: "Regional Norte", tipo: "Regional", lat: -16.73, lng: -43.86 },
  { nome: "Regional Sul", tipo: "Regional", lat: -21.55, lng: -45.43 },
  { nome: "Regional Zona da Mata", tipo: "Regional", lat: -21.76, lng: -43.35 },
  { nome: "Belo Horizonte", tipo: "Município", lat: -19.9167, lng: -43.9345 },
  { nome: "Uberlândia", tipo: "Município", lat: -18.9186, lng: -48.2772 },
  { nome: "Juiz de Fora", tipo: "Município", lat: -21.7642, lng: -43.3503 },
  { nome: "Montes Claros", tipo: "Município", lat: -16.735, lng: -43.8617 },
  { nome: "Varginha", tipo: "Município", lat: -21.5513, lng: -45.4303 },
  { nome: "SE Taquaril", tipo: "Subestação", lat: -19.915, lng: -43.88 },
  { nome: "SE Neves", tipo: "Subestação", lat: -19.77, lng: -44.08 },
  { nome: "SE Uberlândia-Centro", tipo: "Subestação", lat: -18.912, lng: -48.27 },
  { nome: "SE Juiz de Fora 1", tipo: "Subestação", lat: -21.76, lng: -43.34 },
  { nome: "SE Montes Claros 1", tipo: "Subestação", lat: -16.72, lng: -43.87 },
  { nome: "SE Varginha", tipo: "Subestação", lat: -21.56, lng: -45.44 },
  { nome: "TAQ-AL01", tipo: "Alimentador", lat: -19.905, lng: -43.9 },
  { nome: "UBE-AL01", tipo: "Alimentador", lat: -18.93, lng: -48.26 },
  { nome: "JUI-AL02", tipo: "Alimentador", lat: -21.78, lng: -43.36 },
];

export const cidadesMG = pontosMapa.filter((p) => p.tipo === "Município");
