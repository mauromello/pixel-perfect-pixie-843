// Importação BDGD (ANEEL, PRODIST Módulo 10) em GeoJSON → modelo CIM único; exportação CIM-XML e GeoJSON.
import type { Alimentador, Chave, Cliente, Coord, Segmento, Subestacao, Trafo } from "./calculationEngine";

type Geometry = { type: string; coordinates: unknown };
type Feature = { type: "Feature"; geometry: Geometry | null; properties: Record<string, unknown> | null };
export type FeatureCollection = { type: "FeatureCollection"; features: Feature[]; name?: string };
export type Camada = "SUB" | "CTMT" | "SSDMT" | "UNSEMT" | "UNTRMT" | "UCBT" | "UCMT" | "UGBT" | "UGMT";
const CAMADAS: Camada[] = ["SSDMT", "UNSEMT", "UNTRMT", "CTMT", "SUB", "UCBT", "UCMT", "UGBT", "UGMT"];

const CORES = ["oklch(0.55 0.17 250)", "oklch(0.62 0.18 40)", "oklch(0.55 0.15 155)", "oklch(0.55 0.2 330)", "oklch(0.6 0.16 95)", "oklch(0.5 0.15 200)", "oklch(0.55 0.2 20)", "oklch(0.5 0.16 290)"];

/** Identifica a camada BDGD pelo nome do arquivo/coleção ou pelos atributos. */
export function detectarCamada(nome: string, props: Record<string, unknown>): Camada | null {
  const cam = String(props.CAMADA ?? props.camada ?? "").toUpperCase();
  if ((CAMADAS as string[]).includes(cam)) return cam as Camada;
  const n = nome.toUpperCase();
  for (const c of CAMADAS) if (new RegExp(`(^|[^A-Z])${c}([^A-Z]|$)`).test(n)) return c;
  const k = new Set(Object.keys(props).map((x) => x.toUpperCase()));
  if (k.has("POT_NOM") && k.has("PER_FER")) return "UNTRMT";
  if (k.has("P_N_OPE")) return "UNSEMT";
  if (k.has("COMP") && k.has("CTMT")) return "SSDMT";
  if (k.has("POT_INST")) return "UGBT";
  if (k.has("UNI_TR_MT")) return "UCBT";
  if (k.has("SUB") && k.has("TEN_NOM")) return "CTMT";
  return null;
}

const up = (p: Record<string, unknown> | null) => Object.fromEntries(Object.entries(p ?? {}).map(([k, v]) => [k.toUpperCase(), v]));
const num = (v: unknown, d = 0) => { const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : d; };
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
/** Média mensal (MWh) a partir de ENE_01..ENE_12 em kWh */
const energiaMes = (p: Record<string, unknown>) => {
  const v = Array.from({ length: 12 }, (_, i) => num(p[`ENE_${String(i + 1).padStart(2, "0")}`], NaN)).filter(Number.isFinite);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length / 1000 : 0;
};
/** TEN_NOM pode vir em V ou kV */
export const kV = (v: unknown, d: number) => { const n = num(v, NaN); if (!Number.isFinite(n) || n <= 0) return d; return n >= 1000 ? n / 1000 : n; };

const toLL = (c: unknown): Coord => { const a = c as number[]; return [a[1]!, a[0]!]; };
function pontos(g: Geometry | null): Coord[] {
  if (!g) return [];
  const c = g.coordinates as unknown;
  switch (g.type) {
    case "Point": return [toLL(c)];
    case "LineString": case "MultiPoint": return (c as unknown[]).map(toLL);
    case "MultiLineString": case "Polygon": return (c as unknown[][]).flat().map(toLL);
    case "MultiPolygon": return (c as unknown[][][]).flat(2).map(toLL);
    default: return [];
  }
}
const centro = (ps: Coord[]): Coord | null => (ps.length ? [ps.reduce((s, p) => s + p[0], 0) / ps.length, ps.reduce((s, p) => s + p[1], 0) / ps.length] : null);
export const distKm = (a: Coord, b: Coord) => {
  const dy = (a[0] - b[0]) * 111, dx = (a[1] - b[1]) * 111 * Math.cos((a[0] * Math.PI) / 180);
  return Math.hypot(dx, dy);
};
const compKm = (ps: Coord[]) => ps.slice(1).reduce((s, p, i) => s + distKm(ps[i]!, p), 0);

export type ResultadoImportacao = { subestacoes: Subestacao[]; chaves: Chave[]; avisos: string[]; contagem: Partial<Record<Camada, number>> };

export function importarBDGD(arquivos: { nome: string; dados: FeatureCollection }[], opts: { tensaoPadraoKV?: number } = {}): ResultadoImportacao {
  const tPad = opts.tensaoPadraoKV ?? 13.8;
  const avisos: string[] = [];
  const L: Record<Camada, Record<string, unknown>[]> = { SUB: [], CTMT: [], SSDMT: [], UNSEMT: [], UNTRMT: [], UCBT: [], UCMT: [], UGBT: [], UGMT: [] };
  const geo = new Map<Record<string, unknown>, Coord[]>();
  for (const a of arquivos) {
    for (const f of a.dados.features ?? []) {
      const p = up(f.properties);
      const c = detectarCamada(a.dados.name ?? a.nome, p) ?? detectarCamada(a.nome, p);
      if (!c) continue;
      L[c].push(p);
      geo.set(p, pontos(f.geometry));
    }
  }
  const contagem = Object.fromEntries(CAMADAS.map((c) => [c, L[c].length]).filter(([, n]) => n)) as Partial<Record<Camada, number>>;
  if (!L.CTMT.length && !L.SSDMT.length) throw new Error("Nenhuma camada CTMT ou SSDMT encontrada. Envie os arquivos GeoJSON da BDGD (SUB, CTMT, SSDMT, UNSEMT, UNTRMT…).");

  // Alimentadores (CTMT); se ausentes, inferidos dos trechos SSDMT
  const ctmtIds = new Set([...L.CTMT.map((p) => str(p.COD_ID)), ...L.SSDMT.map((p) => str(p.CTMT))].filter(Boolean));
  const ctmtProps = new Map(L.CTMT.map((p) => [str(p.COD_ID), p]));
  const subProps = new Map(L.SUB.map((p) => [str(p.COD_ID), p]));
  const feeders = new Map<string, Alimentador>();
  const feederSub = new Map<string, string>();
  [...ctmtIds].forEach((id, i) => {
    const p = ctmtProps.get(id) ?? {};
    const segs = L.SSDMT.filter((s) => str(s.CTMT) === id);
    const segmentos: Segmento[] = ordenarTrechos(segs.map((s) => ({ p: s, coords: geo.get(s) ?? [] }))).map(({ p: s, coords }) => ({
      id: `sg-${str(s.COD_ID) || Math.random().toString(36).slice(2)}`, cod: str(s.COD_ID), coords,
      comprimento: num(s.COMP) ? num(s.COMP) / 1000 : compKm(coords),
    }));
    const comprimento = segmentos.reduce((x, g) => x + g.comprimento, 0);
    const entrada = energiaMes(p);
    feeders.set(id, {
      id: `al-${id}`, cod: str(p.NOME) || id, entradaDisjuntor: entrada, exportacaoFronteira: 0, usoInterno: 0, iluminacaoPublica: 0,
      condutor: { r: num(p.R1, 0.32), comprimento, corrente: 0 },
      tensaoKV: kV(p.TEN_NOM, tPad), ampacidade: num(p.AMPACIDADE, 420), cor: CORES[i % CORES.length]!, segmentos, trafos: [],
    });
    feederSub.set(id, str(p.SUB));
  });

  const nearestSeg = (f: Alimentador, pt: Coord) => {
    let best: Segmento | undefined, bd = Infinity;
    for (const g of f.segmentos) for (const c of g.coords) { const d = distKm(c, pt); if (d < bd) { bd = d; best = g; } }
    return { seg: best, d: bd };
  };

  // Transformadores MT/BT (UNTRMT)
  const trafoById = new Map<string, Trafo>();
  for (const p of L.UNTRMT) {
    const f = feeders.get(str(p.CTMT));
    const pt = centro(geo.get(p) ?? []);
    if (!f || !pt) { avisos.push(`Trafo ${str(p.COD_ID)} sem alimentador/coordenada — ignorado.`); continue; }
    const seg = nearestSeg(f, pt).seg ?? f.segmentos[0];
    const pfe = num(p.PER_FER) / 1000, ptot = num(p.PER_TOT) / 1000;
    const t: Trafo = {
      id: `tr-${str(p.COD_ID)}`, nome: str(p.COD_ID), p0: pfe, pcu: Math.max(0, ptot - pfe), srated: num(p.POT_NOM, 75),
      segmentoId: seg?.id ?? "", lat: pt[0], lng: pt[1], tensaoPrimKV: kV(p.TEN_PRI, f.tensaoKV), tensaoSecV: num(p.TEN_SEC, 220) > 1000 ? 220 : num(p.TEN_SEC, 220),
      clientes: [],
    };
    f.trafos.push(t);
    trafoById.set(str(p.COD_ID), t);
  }

  // Unidades consumidoras e geradoras
  const addCli = (p: Record<string, unknown>, tipo: Cliente["tipo"]) => {
    let t = trafoById.get(str(p.UNI_TR_MT));
    if (!t) t = feeders.get(str(p.CTMT))?.trafos[0];
    if (!t) return false;
    const e = energiaMes(p);
    const livre = tipo === "cativo" && /LIVRE|ACL/i.test(str(p.TIP_CC) + str(p.ARE_LOC_LIVRE ?? ""));
    t.clientes.push({ id: `c-${str(p.COD_ID) || Math.random().toString(36).slice(2)}`, nome: str(p.COD_ID) || "UC", tipo: livre ? "livre" : tipo, importacao: tipo === "gd" ? 0 : e, exportacao: tipo === "gd" ? e : 0 });
    return true;
  };
  let semTrafo = 0;
  for (const p of [...L.UCBT, ...L.UCMT]) if (!addCli(p, "cativo")) semTrafo++;
  for (const p of [...L.UGBT, ...L.UGMT]) if (!addCli(p, "gd")) semTrafo++;
  if (semTrafo) avisos.push(`${semTrafo} unidades consumidoras/geradoras sem trafo ou alimentador — ignoradas.`);

  // Entrada estimada quando CTMT não traz ENE_xx
  for (const f of feeders.values()) {
    const forn = f.trafos.flatMap((t) => t.clientes).reduce((s, c) => s + c.importacao, 0);
    if (!f.entradaDisjuntor && forn) { f.entradaDisjuntor = forn * 1.12; avisos.push(`${f.cod}: sem ENE_xx no CTMT, entrada estimada (+12% sobre o consumo).`); }
    const kva = f.trafos.reduce((s, t) => s + t.srated, 0);
    f.condutor.corrente = Math.round((kva * 0.5) / (Math.sqrt(3) * f.tensaoKV));
  }

  // Chaves (UNSEMT). NA perto de outro alimentador = chave de interligação.
  const chaves: Chave[] = [];
  const todas = [...feeders.values()];
  for (const p of L.UNSEMT) {
    const pt = centro(geo.get(p) ?? []);
    const f = feeders.get(str(p.CTMT));
    if (!pt || !f) continue;
    const seg = nearestSeg(f, pt).seg;
    if (!seg) continue;
    const na = /^A/i.test(str(p.P_N_OPE));
    const tipoTxt = str(p.TIP_UNID).toUpperCase();
    const c: Chave = {
      id: `ch-${str(p.COD_ID)}`, cod: str(p.COD_ID), tipo: /DJ|DISJ/.test(tipoTxt) ? "disjuntor" : /RL|RELIG/.test(tipoTxt) ? "religador" : /FU/.test(tipoTxt) ? "fusivel" : "seccionadora",
      lat: pt[0], lng: pt[1], normalAberta: na, aberta: na, alimentadorId: f.id, segmentoId: seg.id,
    };
    if (na) {
      let best: { f: Alimentador; seg: Segmento; d: number } | null = null;
      for (const o of todas) if (o.id !== f.id) { const r = nearestSeg(o, pt); if (r.seg && r.d < (best?.d ?? 0.5)) best = { f: o, seg: r.seg, d: r.d }; }
      if (best) { c.alimentadorBId = best.f.id; c.segmentoBId = best.seg.id; }
    }
    chaves.push(c);
  }

  // Subestações
  const porSub = new Map<string, Alimentador[]>();
  for (const [id, f] of feeders) { const s = feederSub.get(id) || "SEM-SUB"; porSub.set(s, [...(porSub.get(s) ?? []), f]); }
  const subestacoes: Subestacao[] = [...porSub].map(([sid, als]) => {
    const p = subProps.get(sid) ?? {};
    const pt = centro(geo.get(p) ?? []) ?? als[0]?.segmentos[0]?.coords[0] ?? ([-19.9, -43.9] as Coord);
    const saida = als.reduce((s, f) => s + f.entradaDisjuntor, 0);
    return {
      id: `se-${sid}`, nome: str(p.NOME) || `SE ${sid}`, regional: str(p.REGIONAL) || "—", municipio: str(p.MUN) || "—", lat: pt[0], lng: pt[1],
      tensaoATkV: kV(p.TEN_NOM ?? p.TEN_PRI, 138), tensaoMTkV: als[0]?.tensaoKV ?? tPad,
      entradaAT: saida * 1.01, geracaoLocal: 0, servicoAuxiliar: 0, alvoPT: 7.5, alvoPNT: 5, alimentadores: als,
    };
  });
  if (!L.SUB.length) avisos.push("Camada SUB ausente: subestações posicionadas no início dos alimentadores.");
  avisos.push("Metas PRORET (PT/PNT) não constam da BDGD: valores padrão 7,5% / 5% aplicados — ajuste em cada subestação.");
  return { subestacoes, chaves, avisos, contagem };
}

/** Ordena trechos da cabeceira para jusante usando PAC_1/PAC_2 (conectividade BDGD). */
function ordenarTrechos<T extends { p: Record<string, unknown>; coords: Coord[] }>(segs: T[]): T[] {
  if (segs.length < 2 || !segs.every((s) => s.p.PAC_1 !== undefined && s.p.PAC_2 !== undefined)) return segs;
  const pac2 = new Set(segs.map((s) => str(s.p.PAC_2)));
  const porPac1 = new Map<string, T[]>();
  for (const s of segs) porPac1.set(str(s.p.PAC_1), [...(porPac1.get(str(s.p.PAC_1)) ?? []), s]);
  const raiz = segs.find((s) => !pac2.has(str(s.p.PAC_1))) ?? segs[0]!;
  const out: T[] = [], vis = new Set<T>(), fila = [raiz];
  while (fila.length) {
    const s = fila.shift()!;
    if (vis.has(s)) continue;
    vis.add(s); out.push(s);
    fila.push(...(porPac1.get(str(s.p.PAC_2)) ?? []));
  }
  return [...out, ...segs.filter((s) => !vis.has(s))];
}

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

/** Exporta o modelo em CIM-XML (RDF/XML, IEC 61970-552, namespace CIM17). */
export function exportarCIM(ses: Subestacao[], chaves: Chave[]): string {
  const o: string[] = [];
  const bv = new Set<number>();
  const id = (x: string) => `_${esc(x)}`;
  const loc = (x: string, pts: Coord[]) => {
    o.push(`  <cim:Location rdf:ID="${id("loc-" + x)}"><cim:Location.PowerSystemResources rdf:resource="#${id(x)}"/></cim:Location>`);
    pts.forEach((p, i) => o.push(`  <cim:PositionPoint><cim:PositionPoint.Location rdf:resource="#${id("loc-" + x)}"/><cim:PositionPoint.sequenceNumber>${i + 1}</cim:PositionPoint.sequenceNumber><cim:PositionPoint.xPosition>${p[1]}</cim:PositionPoint.xPosition><cim:PositionPoint.yPosition>${p[0]}</cim:PositionPoint.yPosition></cim:PositionPoint>`));
  };
  for (const s of ses) {
    bv.add(s.tensaoATkV);
    o.push(`  <cim:Substation rdf:ID="${id(s.id)}"><cim:IdentifiedObject.name>${esc(s.nome)}</cim:IdentifiedObject.name></cim:Substation>`);
    loc(s.id, [[s.lat, s.lng]]);
    for (const f of s.alimentadores) {
      bv.add(f.tensaoKV);
      o.push(`  <cim:Feeder rdf:ID="${id(f.id)}"><cim:IdentifiedObject.name>${esc(f.cod)}</cim:IdentifiedObject.name><cim:Feeder.NormalEnergizingSubstation rdf:resource="#${id(s.id)}"/></cim:Feeder>`);
      for (const g of f.segmentos) {
        o.push(`  <cim:ACLineSegment rdf:ID="${id(g.id)}"><cim:IdentifiedObject.name>${esc(g.cod)}</cim:IdentifiedObject.name><cim:Equipment.EquipmentContainer rdf:resource="#${id(f.id)}"/><cim:ConductingEquipment.BaseVoltage rdf:resource="#_BV_${f.tensaoKV}"/><cim:Conductor.length>${(g.comprimento * 1000).toFixed(1)}</cim:Conductor.length><cim:ACLineSegment.r>${(f.condutor.r * g.comprimento).toFixed(4)}</cim:ACLineSegment.r></cim:ACLineSegment>`);
        loc(g.id, g.coords);
      }
      for (const t of f.trafos) {
        o.push(`  <cim:PowerTransformer rdf:ID="${id(t.id)}"><cim:IdentifiedObject.name>${esc(t.nome)}</cim:IdentifiedObject.name><cim:Equipment.EquipmentContainer rdf:resource="#${id(f.id)}"/><cim:PowerTransformer.ratedS>${t.srated}</cim:PowerTransformer.ratedS></cim:PowerTransformer>`);
        o.push(`  <cim:TransformerCoreAdmittance><cim:TransformerCoreAdmittance.g0>${t.p0}</cim:TransformerCoreAdmittance.g0></cim:TransformerCoreAdmittance>`);
        loc(t.id, [[t.lat, t.lng]]);
        for (const c of t.clientes) o.push(`  <cim:EnergyConsumer rdf:ID="${id(c.id)}"><cim:IdentifiedObject.name>${esc(c.nome)}</cim:IdentifiedObject.name><cim:IdentifiedObject.description>${c.tipo}</cim:IdentifiedObject.description><cim:Equipment.EquipmentContainer rdf:resource="#${id(f.id)}"/></cim:EnergyConsumer>`);
      }
    }
  }
  const cls = { disjuntor: "Breaker", religador: "Recloser", seccionadora: "Disconnector", fusivel: "Fuse" } as const;
  for (const c of chaves) {
    const k = cls[c.tipo];
    o.push(`  <cim:${k} rdf:ID="${id(c.id)}"><cim:IdentifiedObject.name>${esc(c.cod)}</cim:IdentifiedObject.name><cim:Switch.normalOpen>${c.normalAberta}</cim:Switch.normalOpen><cim:Switch.open>${c.aberta}</cim:Switch.open><cim:Equipment.EquipmentContainer rdf:resource="#${id(c.alimentadorId)}"/></cim:${k}>`);
    loc(c.id, [[c.lat, c.lng]]);
  }
  const bvs = [...bv].map((v) => `  <cim:BaseVoltage rdf:ID="_BV_${v}"><cim:BaseVoltage.nominalVoltage>${v}</cim:BaseVoltage.nominalVoltage></cim:BaseVoltage>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:cim="http://iec.ch/TC57/CIM100#">\n${[...bvs, ...o].join("\n")}\n</rdf:RDF>\n`;
}

/** Exporta o modelo como GeoJSON no padrão de atributos da BDGD. */
export function exportarGeoJSON(ses: Subestacao[], chaves: Chave[]): FeatureCollection {
  const ll = (p: Coord) => [p[1], p[0]];
  const F = (geometry: Geometry, properties: Record<string, unknown>): Feature => ({ type: "Feature", geometry, properties });
  const fs: Feature[] = [];
  for (const s of ses) {
    fs.push(F({ type: "Point", coordinates: ll([s.lat, s.lng]) }, { CAMADA: "SUB", COD_ID: s.id, NOME: s.nome, TEN_NOM: s.tensaoATkV }));
    for (const f of s.alimentadores) {
      fs.push(F({ type: "Point", coordinates: ll([s.lat, s.lng]) }, { CAMADA: "CTMT", COD_ID: f.id, NOME: f.cod, SUB: s.id, TEN_NOM: f.tensaoKV, ENE_01: f.entradaDisjuntor * 1000 }));
      for (const g of f.segmentos) fs.push(F({ type: "LineString", coordinates: g.coords.map(ll) }, { CAMADA: "SSDMT", COD_ID: g.cod, CTMT: f.id, COMP: g.comprimento * 1000 }));
      for (const t of f.trafos) fs.push(F({ type: "Point", coordinates: ll([t.lat, t.lng]) }, { CAMADA: "UNTRMT", COD_ID: t.nome, CTMT: f.id, POT_NOM: t.srated, PER_FER: t.p0 * 1000, PER_TOT: (t.p0 + t.pcu) * 1000 }));
    }
  }
  for (const c of chaves) fs.push(F({ type: "Point", coordinates: ll([c.lat, c.lng]) }, { CAMADA: "UNSEMT", COD_ID: c.cod, CTMT: c.alimentadorId, P_N_OPE: c.normalAberta ? "A" : "F" }));
  return { type: "FeatureCollection", features: fs };
}
