// Motor de cálculo do balanço energético. Todas as energias em MWh no ciclo mensal.
export const HORAS_CICLO = 730;
export const FATOR_CARGA_TRAFO = 0.6;
export type ParametrosPerda = { fd: number; coeficiente: number; fc: number };
export const PARAMETROS_PERDA_PADRAO: ParametrosPerda = { fd: 1 / 3, coeficiente: 0.2, fc: 0.6 };
export function validarParametrosPerda(p: ParametrosPerda) {
  return Object.values(p).every(v => Number.isFinite(v) && v >= 0 && v <= 1);
}
export function fatorPerdas(p: ParametrosPerda) {
  return p.coeficiente * p.fc + (1 - p.coeficiente) * p.fc ** 2;
}

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
/** PowerTransformer de distribuição MT/BT */
export type Trafo = {
  id: string; nome: string; p0: number; pcu: number; srated: number; // kW, kW, kVA
  segmentoId: string; lat: number; lng: number; tensaoPrimKV: number; tensaoSecV: number;
  clientes: Cliente[];
};
export type Alimentador = {
  parametrosPerda?: ParametrosPerda;
  motorPT?: "analitico" | "importado";
  ptImportada?: number;
  id: string;
  cod: string;
  entradaDisjuntor: number; // E_breaker_net_input
  exportacaoFronteira: number; // E_downstream_boundary_exports
  usoInterno: number;
  iluminacaoPublica: number;
  condutor: Condutor;
  tensaoKV: number; // BaseVoltage MT
  ampacidade: number; // A
  cor: string;
  segmentos: Segmento[];
  trafos: Trafo[];
};
export type Subestacao = {
  id: string;
  nome: string;
  regional: string;
  municipio: string;
  lat: number;
  lng: number;
  tensaoATkV: number;
  tensaoMTkV: number;
  entradaAT: number; // E_HV_net_input
  geracaoLocal: number;
  servicoAuxiliar: number; // E_station_service
  alvoPT: number; // % regulatório PRORET
  alvoPNT: number;
  alimentadores: Alimentador[];
  /** Medições direcionais mensais entre elementos identificados; exterior representa fora do modelo. */
  medidoresFronteira?: MedidorFronteira[];
};
export type MedidorFronteira = {
  id: string; nome: string; origemId: string; destinoId: string;
  energiaMWh: number; reversaMWh: number;
  fonte: "medida" | "estimada";
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

/** Analytical MT losses use distributed load and loss factors; trunk current is never modified. */
export function perdaTecnicaAnalitica(f: Alimentador) {
  const p = f.parametrosPerda ?? PARAMETROS_PERDA_PADRAO;
  const { r, comprimento, corrente } = f.condutor;
  const condutor = (3 * corrente ** 2 * r * comprimento * HORAS_CICLO * p.fd * fatorPerdas(p)) / 1e6;
  const trafos = f.trafos.reduce((s, t) => s + perdaTecnicaTrafo(t, p.fc), 0);
  return { condutor, trafos, total: condutor + trafos };
}
export function perdaTecnicaTrafo(t: Trafo, fc = FATOR_CARGA_TRAFO) {
  return ((t.p0 + t.pcu * fc ** 2) * HORAS_CICLO) / 1000;
}
/** Imported feeder totals are allocated by analytical MT/BT shares, not measured level losses. */
export function perdaTecnica(f: Alimentador) {
  const a = perdaTecnicaAnalitica(f);
  if (f.motorPT !== "importado" || f.ptImportada === undefined || !Number.isFinite(f.ptImportada) || f.ptImportada < 0) return a;
  const condutor = a.total > 0 ? f.ptImportada * a.condutor / a.total : f.ptImportada;
  return { condutor, trafos: f.ptImportada - condutor, total: f.ptImportada };
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

// ================= Topologia CIM (IEC 61970 / CIM17) =================
export type Coord = [number, number]; // [lat, lng]
/** ACLineSegment — trecho de média tensão com traçado geográfico */
export type Segmento = { id: string; cod: string; coords: Coord[]; comprimento: number }; // km
export type TipoChave = "disjuntor" | "religador" | "seccionadora" | "fusivel";
/** Switch (Breaker / Recloser / Disconnector / Fuse). Chave de interligação liga dois alimentadores. */
export type Chave = {
  id: string;
  cod: string;
  tipo: TipoChave;
  lat: number;
  lng: number;
  normalAberta: boolean;
  aberta: boolean;
  alimentadorId: string;
  segmentoId: string;
  /** Somente chaves de interligação (tie): alimentador e trecho do outro lado */
  alimentadorBId?: string | undefined;
  segmentoBId?: string | undefined;
};

/** Perdas segregadas por nível de tensão (PRORET Módulo 7): AT na SE, MT nos condutores, BT nos trafos de distribuição. */
export function perdasPorNivel(s: Subestacao) {
  const at = Math.max(0, balancoSubestacao(s).lTotal);
  const mt = s.alimentadores.reduce((x, f) => x + perdaTecnica(f).condutor, 0);
  const bt = s.alimentadores.reduce((x, f) => x + perdaTecnica(f).trafos, 0);
  return { at, mt, bt, total: at + mt + bt };
}

export type ResultadoManobra =
  | { ok: true; subestacoes: Subestacao[]; chaves: Chave[]; resumo: { origem: string; destino: string; segmentos: number; trafos: number; energia: number; correnteDestino: number; ampacidade: number } }
  | { ok: false; erro: string };

/**
 * Manobra com re-topologização: fecha a chave de interligação `tieId` e abre a seccionadora `secId`.
 * Todos os trechos a jusante da seccionadora (e seus trafos/clientes) passam ao alimentador receptor.
 * Valida topologia (laço/isolamento), nível de tensão e ampacidade do receptor.
 */
export function manobrar(ses: Subestacao[], chaves: Chave[], tieId: string, secId: string): ResultadoManobra {
  const tie = chaves.find((c) => c.id === tieId);
  const sec = chaves.find((c) => c.id === secId);
  if (!tie || !sec) return { ok: false, erro: "Chave não encontrada no modelo de rede." };
  if (!tie.alimentadorBId) return { ok: false, erro: `${tie.cod} não é chave de interligação entre alimentadores.` };
  if (!tie.aberta) return { ok: false, erro: `${tie.cod} já está fechada — fechá-la novamente criaria laço.` };
  if (sec.aberta || sec.alimentadorBId) return { ok: false, erro: `${sec.cod} deve ser uma seccionadora fechada.` };
  const feeders = ses.flatMap((s) => s.alimentadores);
  const src = feeders.find((f) => f.id === sec.alimentadorId);
  if (!src) return { ok: false, erro: "Alimentador da seccionadora não existe." };
  const lado = tie.alimentadorId === src.id ? "A" : tie.alimentadorBId === src.id ? "B" : null;
  if (!lado) return { ok: false, erro: `${tie.cod} não está conectada ao alimentador ${src.cod}.` };
  const dst = feeders.find((f) => f.id === (lado === "A" ? tie.alimentadorBId : tie.alimentadorId));
  if (!dst) return { ok: false, erro: "Alimentador receptor não existe." };
  if (src.tensaoKV !== dst.tensaoKV) return { ok: false, erro: `Níveis de tensão incompatíveis: ${src.cod} ${src.tensaoKV} kV × ${dst.cod} ${dst.tensaoKV} kV.` };
  const idxSec = src.segmentos.findIndex((g) => g.id === sec.segmentoId);
  const idxTie = src.segmentos.findIndex((g) => g.id === (lado === "A" ? tie.segmentoId : tie.segmentoBId));
  if (idxSec < 0 || idxTie < 0) return { ok: false, erro: "Chaves não pertencem aos trechos do alimentador de origem." };
  if (idxTie < idxSec) return { ok: false, erro: `Abrir ${sec.cod} não separa o trecho ligado a ${tie.cod}: formaria laço entre ${src.cod} e ${dst.cod}.` };

  const mov = src.segmentos.slice(idxSec);
  const movIds = new Set(mov.map((g) => g.id));
  const trMov = src.trafos.filter((t) => movIds.has(t.segmentoId));
  const kva = (ts: Trafo[]) => ts.reduce((x, t) => x + t.srated, 0);
  const imp = (ts: Trafo[]) => ts.reduce((x, t) => x + t.clientes.reduce((y, c) => y + c.importacao, 0), 0);
  const shareK = kva(src.trafos) ? kva(trMov) / kva(src.trafos) : 0;
  const shareE = imp(src.trafos) ? imp(trMov) / imp(src.trafos) : shareK;
  const iMov = src.condutor.corrente * shareK;
  const iDst = dst.condutor.corrente + iMov;
  if (iDst > dst.ampacidade) return { ok: false, erro: `Sobrecarga: ${dst.cod} passaria a ${iDst.toFixed(0)} A, acima da ampacidade de ${dst.ampacidade} A.` };
  const energia = src.entradaDisjuntor * shareE;
  const L = mov.reduce((x, g) => x + g.comprimento, 0);

  const novoSrc: Alimentador = {
    ...src, segmentos: src.segmentos.slice(0, idxSec), trafos: src.trafos.filter((t) => !movIds.has(t.segmentoId)),
    entradaDisjuntor: src.entradaDisjuntor - energia,
    condutor: { ...src.condutor, corrente: src.condutor.corrente - iMov, comprimento: Math.max(0, src.condutor.comprimento - L) },
  };
  const novoDst: Alimentador = {
    ...dst, segmentos: [...dst.segmentos, ...mov], trafos: [...dst.trafos, ...trMov],
    entradaDisjuntor: dst.entradaDisjuntor + energia,
    condutor: { ...dst.condutor, corrente: iDst, comprimento: dst.condutor.comprimento + L },
  };
  const subestacoes = ses.map((s) => ({ ...s, alimentadores: s.alimentadores.map((f) => (f.id === src.id ? novoSrc : f.id === dst.id ? novoDst : f)) }));
  const novasChaves = chaves.map((c) => {
    if (c.id === tie.id) return { ...c, aberta: false };
    if (c.id === sec.id) return { ...c, aberta: true };
    if (c.alimentadorId === src.id && movIds.has(c.segmentoId)) return { ...c, alimentadorId: dst.id };
    if (c.alimentadorBId === src.id && c.segmentoBId && movIds.has(c.segmentoBId)) return { ...c, alimentadorBId: dst.id };
    return c;
  });
  return { ok: true, subestacoes, chaves: novasChaves, resumo: { origem: src.cod, destino: dst.cod, segmentos: mov.length, trafos: trMov.length, energia, correnteDestino: iDst, ampacidade: dst.ampacidade } };
}
