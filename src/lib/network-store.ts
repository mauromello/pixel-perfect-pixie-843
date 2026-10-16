import { create } from "zustand";
import { manobrar, type Alimentador, type Chave, type Cliente, type Condutor, type Coord, type Metodologia, type Segmento, type Subestacao, type Trafo } from "./calculationEngine";

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

function al(cod: string, entrada: number, k: number, o: Coord, ang: number, tensaoKV = 13.8): Alimentador {
  const comprimento = 14 + k * 3;
  const segmentos: Segmento[] = tracado(o, ang, comprimento).map((coords, i) => ({ id: uid("sg"), cod: `${cod}-T${i + 1}`, coords, comprimento: comprimento / 4 }));
  return {
    id: uid("al"), cod, entradaDisjuntor: entrada, exportacaoFronteira: Math.round(entrada * 0.03),
    usoInterno: 12, iluminacaoPublica: Math.round(entrada * 0.04),
    condutor: { r: 0.32, comprimento, corrente: 180 + k * 20 },
    tensaoKV, ampacidade: 420, cor: CORES[k % CORES.length]!, segmentos,
    trafos: [1, 3].map((si, t) => {
      const p = segmentos[si]!.coords[1]!;
      return {
        id: uid("tr"), nome: `TR-${cod.slice(0, 3)}-${4500 + k * 10 + t + 1}`, p0: 1.1, pcu: 4.5, srated: 225,
        segmentoId: segmentos[si]!.id, lat: p[0], lng: p[1], tensaoPrimKV: tensaoKV, tensaoSecV: 220,
        clientes: [
          cli(`UC ${3000 + k * 10 + t} (Residencial)`, "cativo", Math.round(entrada * 0.36)),
          ...(t === 0 ? [cli(`ACL Indústria ${cod}`, "livre", Math.round(entrada * 0.12))] : []),
          ...(t === 1 ? [cli(`GD Solar ${cod}`, "gd", 8, 40)] : []),
        ],
      };
    }),
  };
}

const TAQ: Coord = [-19.915, -43.885], NEV: Coord = [-19.765, -44.085], UBE: Coord = [-18.918, -48.277];
const se = (id: string, nome: string, regional: string, municipio: string, o: Coord, entradaAT: number, geracaoLocal: number, servicoAuxiliar: number, alvoPT: number, alvoPNT: number, alimentadores: Alimentador[]): Subestacao =>
  ({ id, nome, regional, municipio, lat: o[0], lng: o[1], tensaoATkV: 138, tensaoMTkV: 13.8, entradaAT, geracaoLocal, servicoAuxiliar, alvoPT, alvoPNT, alimentadores });

function demo() {
  const subestacoes: Subestacao[] = [
    se("se1", "SE Taquaril", "Metropolitana", "Belo Horizonte", TAQ, 24200, 0, 45, 7.8, 5.2, [al("TAQ-AL01", 12850, 1, TAQ, 200), al("TAQ-AL02", 10420, 2, TAQ, 250)]),
    se("se2", "SE Neves", "Metropolitana", "Ribeirão das Neves", NEV, 21800, 300, 38, 7.5, 6.0, [al("NEV-AL01", 9870, 3, NEV, -40), al("NEV-AL02", 11230, 4, NEV, 10, 34.5)]),
    se("se3", "SE Uberlândia-Centro", "Triângulo", "Uberlândia", UBE, 14900, 0, 22, 7.2, 3.5, [al("UBE-AL01", 14320, 5, UBE, 30)]),
  ];
  const f = subestacoes.flatMap((s) => s.alimentadores);
  const chaves: Chave[] = [];
  for (const a of f) {
    const s0 = a.segmentos[0]!, s2 = a.segmentos[2]!;
    chaves.push({ id: uid("ch"), cod: `DJ-${a.cod}`, tipo: "disjuntor", lat: s0.coords[0]![0], lng: s0.coords[0]![1], normalAberta: false, aberta: false, alimentadorId: a.id, segmentoId: s0.id });
    chaves.push({ id: uid("ch"), cod: `SEC-${a.cod}`, tipo: "seccionadora", lat: s2.coords[0]![0], lng: s2.coords[0]![1], normalAberta: false, aberta: false, alimentadorId: a.id, segmentoId: s2.id });
  }
  const tie = (cod: string, a: Alimentador, b: Alimentador): Chave => {
    const ea = a.segmentos.at(-1)!, eb = b.segmentos.at(-1)!;
    const pa = ea.coords.at(-1)!, pb = eb.coords.at(-1)!;
    return { id: uid("ch"), cod, tipo: "seccionadora", lat: (pa[0] + pb[0]) / 2, lng: (pa[1] + pb[1]) / 2, normalAberta: true, aberta: true, alimentadorId: a.id, segmentoId: ea.id, alimentadorBId: b.id, segmentoBId: eb.id };
  };
  chaves.push(tie("NA-TAQ01-TAQ02", f[0]!, f[1]!), tie("NA-TAQ01-NEV01", f[0]!, f[2]!), tie("NA-NEV01-NEV02", f[2]!, f[3]!));
  return { subestacoes, chaves };
}

type MapAl = (f: Alimentador) => Alimentador;
const mapAl = (ses: Subestacao[], alId: string, fn: MapAl) => ses.map((s) => ({ ...s, alimentadores: s.alimentadores.map((f) => (f.id === alId ? fn(f) : f)) }));
const mapTr = (ses: Subestacao[], trId: string, fn: (t: Trafo) => Trafo) =>
  ses.map((s) => ({ ...s, alimentadores: s.alimentadores.map((f) => ({ ...f, trafos: f.trafos.map((t) => (t.id === trId ? fn(t) : t)) })) }));

export type RegistroManobra = { id: number; tie: string; sec: string; origem: string; destino: string; segmentos: number; trafos: number; energia: number; correnteDestino: number; ampacidade: number; quando: string };

type State = {
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
  addCliente: (trId, c) => set((s) => ({ subestacoes: mapTr(s.subestacoes, trId, (t) => ({ ...t, clientes: [...t.clientes, { ...c, id: uid("c") }] })) })),
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
  carregarModelo: (m, origemModelo) => set({ ...m, base: null, manobras: [], origemModelo }),
  restaurarDemo: () => { const d = demo(); set({ ...d, base: null, manobras: [], origemModelo: "Rede demonstrativa (dados fictícios)" }); },
}));
