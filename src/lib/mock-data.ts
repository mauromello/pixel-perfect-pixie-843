export type Node = {
  id: string;
  nome: string;
  tipo: "Distribuidora" | "Regional" | "Município" | "SE" | "Alimentador" | "Religador" | "Trafo" | "Medidor" | "Instalação";
  filhos?: Node[];
};

const tipos: Node["tipo"][] = ["Regional", "Município", "SE", "Alimentador", "Religador", "Trafo", "Medidor", "Instalação"];
const nomes: Record<string, string[]> = {
  Regional: ["Regional Norte", "Regional Sul"],
  Município: ["Campinas", "Sorocaba"],
  SE: ["SE Taquaral", "SE Barão"],
  Alimentador: ["AL-01", "AL-02"],
  Religador: ["RL-101", "RL-102"],
  Trafo: ["TR-4501", "TR-4502"],
  Medidor: ["MD-88012", "MD-88013"],
  Instalação: ["UC 3001", "UC 3002"],
};

function build(level: number, prefix: string): Node[] {
  const t = tipos[level] as string;
  const qtd = level >= 5 ? 1 : 2;
  return nomes[t].slice(0, qtd).map((n: string, i: number) => {
    const id = `${prefix}-${i}`;
    return { id, nome: level <= 1 ? n : `${n}${prefix.length > 6 ? "" : ""}`, tipo: t as Node["tipo"], filhos: level < tipos.length - 1 ? build(level + 1, id) : undefined };
  });
}

export const arvore: Node = { id: "root", nome: "Distribuidora", tipo: "Distribuidora", filhos: build(0, "n") };

export function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 100000;
  return h;
}

export function balanco(id: string) {
  const h = hash(id);
  const injetada = id === "root" ? 1_284_500 : 2000 + (h % 90000);
  const pt = 0.06 + (h % 30) / 1000;
  const pnt = 0.04 + (h % 70) / 1000;
  return {
    injetada,
    faturada: Math.round(injetada * (1 - pt - pnt)),
    pt: Math.round(injetada * pt),
    pnt: Math.round(injetada * pnt),
    ptPct: pt * 100,
    pntPct: pnt * 100,
    serie: ["Mai", "Jun", "Jul", "Ago", "Set", "Out"].map((m, i) => ({
      mes: m,
      injetada: Math.round(injetada * (0.92 + ((h + i * 7) % 15) / 100)),
      perdas: Math.round(injetada * (pt + pnt) * (0.9 + ((h + i * 3) % 20) / 100)),
    })),
  };
}

export const criticas = [
  { id: 1, elemento: "SE Taquaral / AL-02", tipo: "Extração", descricao: "Lacuna de 4h na curva de carga (SCADA)", severidade: "Alta", variacao: "-" },
  { id: 2, elemento: "AL-01 / RL-101", tipo: "Histórico", descricao: "Carga 38% acima da média 12m", severidade: "Média", variacao: "+38%" },
  { id: 3, elemento: "TR-4501", tipo: "Extração", descricao: "Medidor de fronteira sem leitura MDM", severidade: "Alta", variacao: "-" },
  { id: 4, elemento: "SE Barão", tipo: "Histórico", descricao: "Queda abrupta de energia injetada", severidade: "Média", variacao: "-22%" },
  { id: 5, elemento: "Sorocaba / AL-02", tipo: "Consistência", descricao: "Faturado > Injetado no ciclo", severidade: "Crítica", variacao: "+104%" },
  { id: 6, elemento: "MD-88013", tipo: "Histórico", descricao: "Consumo zerado por 3 ciclos", severidade: "Baixa", variacao: "-100%" },
];

export const fontesBalanco = [
  { id: "b1", elemento: "SE Taquaral", sistema: "SCADA", injetada: 48210, faturada: 42950, confiavel: true },
  { id: "b2", elemento: "SE Barão", sistema: "MDM", injetada: 39880, faturada: 33120, confiavel: true },
  { id: "b3", elemento: "AL-01 Taquaral", sistema: "SCADA", injetada: 21400, faturada: 18990, confiavel: true },
  { id: "b4", elemento: "AL-02 Barão", sistema: "Comercial (CIS)", injetada: 18760, faturada: 19480, confiavel: false },
  { id: "b5", elemento: "TR-4501", sistema: "AMI", injetada: 812, faturada: 701, confiavel: true },
];

export const elementosProjecao = ["Distribuidora (Global)", "SE Taquaral", "SE Barão", "AL-01 Taquaral", "AL-02 Barão"];

export const fontesDados = [
  { cat: "Dados Históricos", origem: "Data Lake / Parquet", status: "Online", volume: "4,8 TB", latencia: "120 ms" },
  { cat: "Mercado", origem: "CIS Comercial", status: "Online", volume: "612 GB", latencia: "85 ms" },
  { cat: "Climáticos", origem: "INMET API", status: "Online", volume: "38 GB", latencia: "340 ms" },
  { cat: "Medições de Fronteiras", origem: "SMF / CCEE", status: "Online", volume: "1,2 TB", latencia: "95 ms" },
  { cat: "GD/GC", origem: "Cadastro GD", status: "Offline", volume: "74 GB", latencia: "—" },
  { cat: "Manobras", origem: "ADMS / OMS", status: "Online", volume: "205 GB", latencia: "60 ms" },
  { cat: "Geoespaciais", origem: "GIS (BDGD)", status: "Online", volume: "910 GB", latencia: "150 ms" },
  { cat: "Dados de Projeção", origem: "Motor ML", status: "Online", volume: "122 GB", latencia: "210 ms" },
  { cat: "Segurança", origem: "SIEM / IAM", status: "Online", volume: "56 GB", latencia: "40 ms" },
];

export const dicionario = [
  { variavel: "energia_injetada_kwh", tipo: "decimal(14,3)", nivel: "SE / Alimentador", origem: "SCADA, SMF", descricao: "Energia que entra no elemento no período" },
  { variavel: "energia_faturada_kwh", tipo: "decimal(14,3)", nivel: "Instalação", origem: "CIS", descricao: "Energia faturada das unidades consumidoras" },
  { variavel: "perda_tecnica_kwh", tipo: "decimal(14,3)", nivel: "Todos", origem: "Motor de Cálculo", descricao: "Perdas por efeito Joule, núcleo e demais técnicas" },
  { variavel: "perda_nao_tecnica_kwh", tipo: "decimal(14,3)", nivel: "Todos", origem: "Derivada", descricao: "Injetada − Faturada − Perda técnica" },
  { variavel: "geracao_distribuida_kwh", tipo: "decimal(14,3)", nivel: "Instalação", origem: "Cadastro GD", descricao: "Energia injetada por micro/minigeração" },
  { variavel: "cod_alimentador", tipo: "varchar(12)", nivel: "Alimentador", origem: "GIS / BDGD", descricao: "Identificador único do alimentador" },
  { variavel: "cod_trafo", tipo: "varchar(16)", nivel: "Trafo", origem: "GIS / BDGD", descricao: "Identificador do transformador de distribuição" },
  { variavel: "flag_confiavel", tipo: "boolean", nivel: "Balanço", origem: "Usuário", descricao: "Indica se o balanço pode ser usado em relatórios" },
];

export const perfis = [
  { perfil: "Administrador", usuarios: 3, balanco: "Editar", projecao: "Editar", mapas: "Ver", ia: "Editar", admin: "Editar" },
  { perfil: "Analista de Perdas", usuarios: 18, balanco: "Editar", projecao: "Editar", mapas: "Ver", ia: "Ver", admin: "—" },
  { perfil: "Operação de Campo", usuarios: 42, balanco: "Ver", projecao: "—", mapas: "Ver", ia: "—", admin: "—" },
  { perfil: "Auditoria / Regulatório", usuarios: 5, balanco: "Ver", projecao: "Ver", mapas: "Ver", ia: "Ver", admin: "Ver" },
];

export const pontosMapa = [
  { nome: "Regional Norte", tipo: "Regional", lat: -22.85, lng: -47.06 },
  { nome: "Campinas", tipo: "Município", lat: -22.9056, lng: -47.0608 },
  { nome: "Sorocaba", tipo: "Município", lat: -23.5015, lng: -47.4526 },
  { nome: "SE Taquaral", tipo: "Subestação", lat: -22.875, lng: -47.05 },
  { nome: "SE Barão", tipo: "Subestação", lat: -22.83, lng: -47.08 },
  { nome: "AL-01", tipo: "Alimentador", lat: -22.89, lng: -47.04 },
  { nome: "RL-101", tipo: "Religador", lat: -22.9, lng: -47.07 },
  { nome: "TR-4501", tipo: "Transformador", lat: -22.915, lng: -47.055 },
];
