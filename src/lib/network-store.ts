import { create } from "zustand";
import { manobrar, HORAS_CICLO, FATOR_CARGA_TRAFO, PARAMETROS_PERDA_PADRAO, validarParametrosPerda, type ParametrosPerda, type Alimentador, type Chave, type Cliente, type Condutor, type Coord, type Metodologia, type Segmento, type Subestacao, type Trafo } from "./calculationEngine";

let seq = 1000;
const uid = (p: string) => `${p}${++seq}`;
const cli = (nome: string, tipo: Cliente["tipo"], importacao: number, exportacao = 0): Cliente => ({ id: uid("c"), nome, tipo, importacao, exportacao });

export const CORES = ["oklch(0.55 0.17 250)", "oklch(0.62 0.18 40)", "oklch(0.55 0.15 155)", "oklch(0.55 0.2 330)", "oklch(0.6 0.16 95)", "oklch(0.5 0.15 200)", "oklch(0.55 0.2 20)", "oklch(0.5 0.16 290)"];

const KM = 1 / 111;
/** Traçado radial: n trechos a partir da SE na direção `ang` (graus). */
function tracado(o: Coord, ang: number, km: number, n = 4): Coord[][] {
  const pts: Coord[] = [o];
  for (let i = 1; i <= n; i++) {
    const a = ((ang + (i % 2 ? 8 : -8)) * Math.PI) / 180;
    const d = (km / n) * i * KM;
    pts.push([o[0] + Math.sin(a) * d, o[1] + Math.cos(a) * d / Math.cos((o[0] * Math.PI) / 180)]);
  }
  return Array.from({ length: n }, (_, i) => [pts[i]!, pts[i + 1]!]);
}

/** Gerador determinístico (mesma rede a cada carga). */
let semente = 42;
const rnd = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
const entre = (a: number, b: number) => a + rnd() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]!;

const CLASSES = ["Residencial", "Comercial", "Rural", "Poder Público", "Industrial BT"];
const SRATED = [45, 75, 112.5, 150, 225, 300];

function al(cod: string, entrada: number, k: number, o: Coord, ang: number, tensaoKV = 13.8): Alimentador {
  const nSeg = 6 + Math.floor(rnd() * 7); // 6–12 trechos
  const comprimento = Math.round(entre(8, 32));
  const segmentos: Segmento[] = tracado(o, ang, comprimento, nSeg).map((coords, i) => ({ id: uid("sg"), cod: `${cod}-T${i + 1}`, coords, comprimento: comprimento / nSeg }));
  const nTr = 4 + Math.floor(rnd() * 5); // 4–8 trafos
  const fracConsumo = entre(0.74, 0.9); // varia perdas entre alimentadores
  const temACL = rnd() < 0.55;
  const acl = temACL ? Math.round(entrada * entre(0.06, 0.16)) : 0;
  const restante = entrada * fracConsumo - acl;
  const pesos = Array.from({ length: nTr }, () => entre(0.5, 1.5));
  const somaP = pesos.reduce((a, b) => a + b, 0);
  const trafos: Trafo[] = pesos.map((w, t) => {
    const si = Math.min(nSeg - 1, 1 + Math.floor(((nSeg - 1) * t) / nTr));
    const p = segmentos[si]!.coords[1]!;
    const consumo = (restante * w) / somaP;
    const nCli = 2 + Math.floor(rnd() * 3);
    const clientes: Cliente[] = Array.from({ length: nCli }, (_, c) =>
      cli(`UC ${10000 + k * 100 + t * 10 + c} (${pick(CLASSES)})`, "cativo", Math.round(consumo / nCli)));
    if (t === 0 && temACL) clientes.push(cli(`ACL ${pick(["Indústria", "Shopping", "Hospital", "Mineradora", "Frigorífico"])} ${cod}`, "livre", acl));
    if (rnd() < 0.35) { const g = Math.round(entre(5, 30)); clientes.push(cli(`GD ${pick(["Solar", "Solar", "Biogás"])} ${cod}-${t + 1}`, "gd", Math.round(g * 0.2), Math.round(g * entre(2, 6)))); }
    const carga = (consumo * 1000) / 730;
    const srated = SRATED.reduce((b, x) => (Math.abs(x - carga / entre(0.45, 1.25)) < Math.abs(b - carga / 0.8) ? x : b), 225);
    return {
      id: uid("tr"), nome: `TR-${cod.slice(0, 3)}-${4500 + k * 10 + t + 1}`, p0: +(srated * 0.0045).toFixed(2), pcu: +(srated * 0.018).toFixed(2), srated,
      segmentoId: segmentos[si]!.id, lat: p[0], lng: p[1], tensaoPrimKV: tensaoKV, tensaoSecV: pick([220, 220, 380]), clientes,
    };
  });
  return {
    id: uid("al"), cod, entradaDisjuntor: entrada, exportacaoFronteira: Math.round(entrada * entre(0, 0.05)),
    usoInterno: Math.round(entre(5, 25)), iluminacaoPublica: Math.round(entrada * entre(0.02, 0.06)),
    condutor: { r: +entre(0.18, 0.6).toFixed(3), comprimento, corrente: Math.round(entre(140, 445)) },
    tensaoKV, ampacidade: pick([380, 420, 420, 500]), cor: CORES[k % CORES.length]!, segmentos, trafos,
  };
}

const se = (id: string, nome: string, regional: string, municipio: string, o: Coord, entradaAT: number, geracaoLocal: number, servicoAuxiliar: number, alvoPT: number, alvoPNT: number, alimentadores: Alimentador[]): Subestacao =>
  ({ id, nome, regional, municipio, lat: o[0], lng: o[1], tensaoATkV: 138, tensaoMTkV: 13.8, entradaAT, geracaoLocal, servicoAuxiliar, alvoPT, alvoPNT, alimentadores });

type DefSE = [nome: string, regional: string, municipio: string, lat: number, lng: number, nAl: number, sigla: string];
const SES: DefSE[] = [
  ["SE Taquaril", "Metropolitana", "Belo Horizonte", -19.915, -43.885, 4, "TAQ"],
  ["SE Neves", "Metropolitana", "Ribeirão das Neves", -19.765, -44.085, 3, "NEV"],
  ["SE Barreiro", "Metropolitana", "Belo Horizonte", -19.975, -44.02, 3, "BAR"],
  ["SE Betim-Centro", "Metropolitana", "Betim", -19.967, -44.198, 3, "BET"],
  ["SE Contagem", "Metropolitana", "Contagem", -19.932, -44.054, 3, "CON"],
  ["SE Uberlândia-Centro", "Triângulo", "Uberlândia", -18.918, -48.277, 4, "UBE"],
  ["SE Uberlândia-Industrial", "Triângulo", "Uberlândia", -18.97, -48.32, 3, "UBI"],
  ["SE Uberaba-Oeste", "Triângulo", "Uberaba", -19.748, -47.94, 3, "UBA"],
  ["SE Montes Claros-Norte", "Norte", "Montes Claros", -16.69, -43.86, 3, "MCN"],
  ["SE Montes Claros-Sul", "Norte", "Montes Claros", -16.76, -43.87, 3, "MCS"],
  ["SE Januária", "Norte", "Januária", -15.488, -44.36, 2, "JAN"],
  ["SE Varginha", "Sul", "Varginha", -21.551, -45.43, 3, "VAR"],
  ["SE Pouso Alegre", "Sul", "Pouso Alegre", -22.23, -45.936, 3, "POA"],
  ["SE Juiz de Fora-Centro", "Zona da Mata", "Juiz de Fora", -21.761, -43.35, 4, "JFC"],
  ["SE Ubá", "Zona da Mata", "Ubá", -21.12, -42.943, 2, "UBA2"],
  ["SE Ipatinga-Aço", "Vale do Aço", "Ipatinga", -19.468, -42.536, 3, "IPA"],
  ["SE Governador Valadares", "Vale do Aço", "Governador Valadares", -18.851, -41.949, 3, "GVA"],
];

function demo() {
  semente = 42;
  seq = 1000;
  let k = 0;
  const subestacoes: Subestacao[] = SES.map(([nome, regional, municipio, lat, lng, nAl, sigla], i) => {
    const o: Coord = [lat, lng];
    const als = Array.from({ length: nAl }, (_, j) => {
      k++;
      const kv = rnd() < 0.15 ? 34.5 : rnd() < 0.1 ? 23 : 13.8;
      return al(`${sigla.slice(0, 3)}${sigla.length > 3 ? "2" : ""}-AL${String(j + 1).padStart(2, "0")}`, Math.round(entre(5500, 16000)), k, o, (360 / nAl) * j + entre(-20, 20), kv);
    });
    const somaAl = als.reduce((a, b) => a + b.entradaDisjuntor, 0);
    const geracaoLocal = rnd() < 0.25 ? Math.round(entre(100, 600)) : 0;
    return se(`se${i + 1}`, nome, regional, municipio, o, Math.round(somaAl * entre(1.01, 1.04)) - geracaoLocal, geracaoLocal, Math.round(entre(15, 60)), +entre(6.5, 8.5).toFixed(1), +entre(2.5, 9).toFixed(1), als);
  });
  const chaves: Chave[] = [];
  for (const s of subestacoes) for (const a of s.alimentadores) {
    const s0 = a.segmentos[0]!;
    chaves.push({ id: uid("ch"), cod: `DJ-${a.cod}`, tipo: "disjuntor", lat: s0.coords[0]![0], lng: s0.coords[0]![1], normalAberta: false, aberta: false, alimentadorId: a.id, segmentoId: s0.id });
    for (const idx of [2, Math.floor(a.segmentos.length * 0.66)]) {
      const sg = a.segmentos[idx]!;
      if (chaves.some((c) => c.segmentoId === sg.id)) continue;
      chaves.push({ id: uid("ch"), cod: `SEC-${a.cod}-${idx + 1}`, tipo: "seccionadora", lat: sg.coords[0]![0], lng: sg.coords[0]![1], normalAberta: false, aberta: false, alimentadorId: a.id, segmentoId: sg.id });
    }
  }
  const tie = (a: Alimentador, b: Alimentador): Chave => {
    const ea = a.segmentos.at(-1)!, eb = b.segmentos.at(-1)!;
    const pa = ea.coords.at(-1)!, pb = eb.coords.at(-1)!;
    return { id: uid("ch"), cod: `NA-${a.cod}-${b.cod}`, tipo: "seccionadora", lat: (pa[0] + pb[0]) / 2, lng: (pa[1] + pb[1]) / 2, normalAberta: true, aberta: true, alimentadorId: a.id, segmentoId: ea.id, alimentadorBId: b.id, segmentoBId: eb.id };
  };
  for (const s of subestacoes) for (let j = 0; j + 1 < s.alimentadores.length; j++) chaves.push(tie(s.alimentadores[j]!, s.alimentadores[j + 1]!));
  // interligações entre SEs vizinhas da mesma regional
  for (let i = 0; i + 1 < subestacoes.length; i++) {
    const a = subestacoes[i]!, b = subestacoes[i + 1]!;
    if (a.regional === b.regional) chaves.push(tie(a.alimentadores.at(-1)!, b.alimentadores[0]!));
  }
  for (const s of subestacoes) {
    for (const f of s.alimentadores) for (const [i, t] of f.trafos.entries()) {
      t.classe = (i % 3 === 0 ? "Rural" : i % 3 === 1 ? "Comercial" : "Residencial");
      t.clientes = t.clientes.map(c => ({ ...c, trafoId: t.id, cargaKva: c.importacao * 1000 / HORAS_CICLO / 0.92,
        medidor: { id: `md-${c.id}`, numero: `MD-${c.id}`, tecnologia: "AMI", tipo: c.tipo === "gd" ? "bidirecional" : "consumo" } }));
    }
    s.medidoresFronteira = s.alimentadores.flatMap((f) => [
      { id: `mf-${f.id}`, nome: `MF-${f.cod}`, origemId: f.id, destinoId: "exterior", energiaMWh: f.exportacaoFronteira, reversaMWh: 0, fonte: "estimada" as const },
      ...f.trafos.map((t) => {
        const consumo = t.clientes.reduce((v, c) => v + c.importacao, 0);
        const gd = t.clientes.reduce((v, c) => v + (c.tipo === "gd" ? c.exportacao : 0), 0);
        const perdas = (t.p0 + t.pcu * FATOR_CARGA_TRAFO ** 2) * HORAS_CICLO / 1000;
        return { id: `mf-${t.id}`, nome: `MF-${t.nome}`, origemId: f.id, destinoId: t.id, energiaMWh: consumo + perdas, reversaMWh: gd, fonte: "estimada" as const };
      }),
    ]);
  }
  return { subestacoes, chaves };
}

type MapAl = (f: Alimentador) => Alimentador;
const mapAl = (ses: Subestacao[], alId: string, fn: MapAl) => ses.map((s) => ({ ...s, alimentadores: s.alimentadores.map((f) => (f.id === alId ? fn(f) : f)) }));
const mapTr = (ses: Subestacao[], trId: string, fn: (t: Trafo) => Trafo) =>
  ses.map((s) => ({ ...s, alimentadores: s.alimentadores.map((f) => ({ ...f, trafos: f.trafos.map((t) => (t.id === trId ? fn(t) : t)) })) }));

export type RegistroManobra = { id: number; tie: string; sec: string; origem: string; destino: string; segmentos: number; trafos: number; energia: number; correnteDestino: number; ampacidade: number; quando: string };

type State = {
  parametrosPerda: ParametrosPerda;
  motorPT: "analitico" | "importado";
  setParametrosPerda: (p: ParametrosPerda) => void;
  setMotorPT: (m: "analitico" | "importado") => void;
  importarPT: (valores: Record<string, number>) => void;
  subestacoes: Subestacao[];
  chaves: Chave[];
  /** Estado normal da rede antes das manobras (para desfazer) */
  base: { subestacoes: Subestacao[]; chaves: Chave[] } | null;
  manobras: RegistroManobra[];
  origemModelo: string;
  metodologia: Metodologia;
  setMetodologia: (m: Metodologia) => void;
  updSubestacao: (id: string, p: Partial<Subestacao>) => void;
  updAlimentador: (id: string, p: Partial<Alimentador>) => void;
  updCondutor: (id: string, p: Partial<Condutor>) => void;
  updTrafo: (id: string, p: Partial<Trafo>) => void;
  updChave: (id: string, p: Partial<Chave>) => void;
  addCliente: (trId: string, c: Omit<Cliente, "id">) => void;
  removeCliente: (trId: string, cId: string) => void;
  executarManobra: (tieId: string, secId: string) => string | null;
  desfazerManobras: () => void;
  carregarModelo: (m: { subestacoes: Subestacao[]; chaves: Chave[] }, origem: string) => void;
  restaurarDemo: () => void;
};

const d0 = demo();
export const useRede = create<State>((set, get) => ({
  parametrosPerda: { ...PARAMETROS_PERDA_PADRAO },
  motorPT: "analitico",
  setParametrosPerda: (p) => {
    if (!validarParametrosPerda(p)) return;
    set(s => ({ parametrosPerda: { ...p }, subestacoes: s.subestacoes.map(se => ({ ...se, alimentadores: se.alimentadores.map(f => ({ ...f, parametrosPerda: { ...p } })) })), base: s.base ? { ...s.base, subestacoes: s.base.subestacoes.map(se => ({ ...se, alimentadores: se.alimentadores.map(f => ({ ...f, parametrosPerda: { ...p } })) })) } : null }));
  },
  setMotorPT: (m) => set(s => ({ motorPT: m, subestacoes: s.subestacoes.map(se => ({ ...se, alimentadores: se.alimentadores.map(f => ({ ...f, motorPT: m })) })), base: s.base ? { ...s.base, subestacoes: s.base.subestacoes.map(se => ({ ...se, alimentadores: se.alimentadores.map(f => ({ ...f, motorPT: m })) })) } : null })),
  importarPT: (valores) => set(s => {
    const aplicar = (ses: Subestacao[]) => ses.map(se => ({ ...se, alimentadores: se.alimentadores.map(f => {
      const { ptImportada: anterior, ...resto } = f;
      const valor = valores[f.cod];
      return { ...resto, motorPT: "importado" as const, ...(valor !== undefined ? { ptImportada: valor } : {}) };
    }) }));
    return { motorPT: "importado", subestacoes: aplicar(s.subestacoes), base: s.base ? { ...s.base, subestacoes: aplicar(s.base.subestacoes) } : null };
  }),
  subestacoes: d0.subestacoes,
  chaves: d0.chaves,
  base: null,
  manobras: [],
  origemModelo: "Rede demonstrativa (dados fictícios)",
  metodologia: "fisico",
  setMetodologia: (metodologia) => set({ metodologia }),
  updSubestacao: (id, p) => set((s) => ({ subestacoes: s.subestacoes.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
  updAlimentador: (id, p) => set((s) => ({ subestacoes: mapAl(s.subestacoes, id, (f) => ({ ...f, ...p })) })),
  updCondutor: (id, p) => set((s) => ({ subestacoes: mapAl(s.subestacoes, id, (f) => ({ ...f, condutor: { ...f.condutor, ...p } })) })),
  updTrafo: (id, p) => set((s) => ({ subestacoes: mapTr(s.subestacoes, id, (t) => ({ ...t, ...p })) })),
  updChave: (id, p) => set((s) => ({ chaves: s.chaves.map((c) => (c.id === id ? { ...c, ...p } : c)) })),
  addCliente: (trId, c) => set((s) => ({ subestacoes: mapTr(s.subestacoes, trId, (t) => ({ ...t, clientes: [...t.clientes, { ...c, trafoId: c.trafoId ?? trId, id: uid("c") }] })) })),
  removeCliente: (trId, cId) => set((s) => ({ subestacoes: mapTr(s.subestacoes, trId, (t) => ({ ...t, clientes: t.clientes.filter((c) => c.id !== cId) })) })),
  executarManobra: (tieId, secId) => {
    const st = get();
    const r = manobrar(st.subestacoes, st.chaves, tieId, secId);
    if (!r.ok) return r.erro;
    const cod = (id: string) => st.chaves.find((c) => c.id === id)?.cod ?? id;
    set({
      base: st.base ?? { subestacoes: st.subestacoes, chaves: st.chaves },
      subestacoes: r.subestacoes, chaves: r.chaves,
      manobras: [{ id: Date.now(), tie: cod(tieId), sec: cod(secId), ...r.resumo, quando: new Date().toLocaleString("pt-BR") }, ...st.manobras],
    });
    return null;
  },
  desfazerManobras: () => set((s) => (s.base ? { ...s.base, base: null, manobras: [] } : {})),
  carregarModelo: (m, origemModelo) => set({ ...m, parametrosPerda: { ...PARAMETROS_PERDA_PADRAO }, motorPT: "analitico", base: null, manobras: [], origemModelo }),
  restaurarDemo: () => { const d = demo(); set({ ...d, parametrosPerda: { ...PARAMETROS_PERDA_PADRAO }, motorPT: "analitico", base: null, manobras: [], origemModelo: "Rede demonstrativa (dados fictícios)" }); },
}));
