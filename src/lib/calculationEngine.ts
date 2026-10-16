// Motor de cálculo do balanço energético. Todas as energias em MWh no ciclo mensal.
export const HORAS_CICLO = 730;
export const FATOR_CARGA_TRAFO = 0.6;

export type TipoCliente = "cativo" | "livre" | "gd";
export type Cliente = {
  id: string;
  nome: string;
  tipo: TipoCliente;
  /** Registrador de importação (energia consumida da rede) */
  importacao: number;
  /** Registrador de exportação (somente GD) — NUNCA compensado com a importação */
  exportacao: number;
};
export type Condutor = { r: number; comprimento: number; corrente: number }; // Ω/km, km, A
export type Trafo = { id: string; nome: string; p0: number; pcu: number; srated: number; clientes: Cliente[] }; // kW, kW, kVA
export type Alimentador = {
  id: string;
  cod: string;
  entradaDisjuntor: number; // E_breaker_net_input
  exportacaoFronteira: number; // E_downstream_boundary_exports
  usoInterno: number;
  iluminacaoPublica: number;
  condutor: Condutor;
  trafos: Trafo[];
};
export type Subestacao = {
  id: string;
  nome: string;
  entradaAT: number; // E_HV_net_input
  geracaoLocal: number;
  servicoAuxiliar: number; // E_station_service
  alvoPT: number; // % regulatório PRORET
  alvoPNT: number;
  alimentadores: Alimentador[];
};
export type Metodologia = "fisico" | "regulatorio";

const clientes = (f: Alimentador) => f.trafos.flatMap((t) => t.clientes);

/** Soma separada dos registradores de GD — proibido net metering. */
export function registradoresGD(f: Alimentador) {
  const gd = clientes(f).filter((c) => c.tipo === "gd");
  return { exportacao: gd.reduce((s, c) => s + c.exportacao, 0), importacao: gd.reduce((s, c) => s + c.importacao, 0) };
}

/** E_delivered = cativos + livres (medido) + uso interno + iluminação pública + importação GD */
export function energiaFornecida(f: Alimentador) {
  const cs = clientes(f);
  const cativos = cs.filter((c) => c.tipo === "cativo").reduce((s, c) => s + c.importacao, 0);
  const livres = cs.filter((c) => c.tipo === "livre").reduce((s, c) => s + c.importacao, 0);
  const gdImport = registradoresGD(f).importacao;
  return { cativos, livres, gdImport, usoInterno: f.usoInterno, iluminacao: f.iluminacaoPublica, total: cativos + livres + gdImport + f.usoInterno + f.iluminacaoPublica };
}

/** L_total = E_net_input − E_delivered */
export const perdasTotais = (entradaLiquida: number, fornecida: number) => entradaLiquida - fornecida;

/** L_NT = L_total_actual − L_technical_calculated */
export const perdasNaoTecnicas = (lTotal: number, lTecnica: number) => lTotal - lTecnica;

/** Perda técnica: condutor trifásico 3·I²·R·L + trafos P0 + Pcu·(carga)² */
export function perdaTecnica(f: Alimentador) {
  const { r, comprimento, corrente } = f.condutor;
  const condutor = (3 * corrente ** 2 * r * comprimento * HORAS_CICLO) / 1e6;
  const trafos = f.trafos.reduce((s, t) => s + ((t.p0 + t.pcu * FATOR_CARGA_TRAFO ** 2) * HORAS_CICLO) / 1000, 0);
  return { condutor, trafos, total: condutor + trafos };
}

/** L_f = E_breaker_net_input + E_embedded_generation − E_customer_imports − E_downstream_boundary_exports */
export function balancoAlimentador(f: Alimentador) {
  const gd = registradoresGD(f);
  const forn = energiaFornecida(f);
  const entradaLiquida = f.entradaDisjuntor + gd.exportacao - f.exportacaoFronteira;
  const lTotal = perdasTotais(entradaLiquida, forn.total);
  const tec = perdaTecnica(f);
  return { entradaLiquida, geracaoEmbutida: gd.exportacao, fornecida: forn, lTotal, lTecnica: tec.total, tecnica: tec, lNT: perdasNaoTecnicas(lTotal, tec.total) };
}

/** L_substation = E_HV_net_input + E_local_generation − Σ E_MV_feeder_net_output − E_station_service */
export function balancoSubestacao(s: Subestacao) {
  const saidaMT = s.alimentadores.reduce((x, f) => x + f.entradaDisjuntor, 0);
  return { saidaMT, lTotal: s.entradaAT + s.geracaoLocal - saidaMT - s.servicoAuxiliar };
}

/** Aplica metodologia: regulatório sobrescreve PT/PNT com alvos PRORET e expõe a diferença. */
export function aplicarMetodologia(b: { entradaLiquida: number; lTotal: number; lTecnica: number; lNT: number }, m: Metodologia, alvoPT: number, alvoPNT: number) {
  if (m === "fisico") return { pt: b.lTecnica, pnt: b.lNT, exposicao: 0 };
  const pt = (b.entradaLiquida * alvoPT) / 100;
  const pnt = (b.entradaLiquida * alvoPNT) / 100;
  return { pt, pnt, exposicao: b.lTotal - (pt + pnt) };
}
