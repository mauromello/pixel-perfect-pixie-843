import { create } from "zustand";
import type { Alimentador, Cliente, Condutor, Metodologia, Subestacao, Trafo } from "./calculationEngine";

let seq = 1000;
const uid = (p: string) => `${p}${++seq}`;
const cli = (nome: string, tipo: Cliente["tipo"], importacao: number, exportacao = 0): Cliente => ({ id: uid("c"), nome, tipo, importacao, exportacao });

function al(cod: string, entrada: number, k: number): Alimentador {
  return {
    id: uid("al"), cod, entradaDisjuntor: entrada, exportacaoFronteira: Math.round(entrada * 0.03),
    usoInterno: 12, iluminacaoPublica: Math.round(entrada * 0.04),
    condutor: { r: 0.32, comprimento: 14 + k * 3, corrente: 180 + k * 20 },
    trafos: [1, 2].map((t) => ({
      id: uid("tr"), nome: `TR-${cod.slice(0, 3)}-${4500 + k * 10 + t}`, p0: 1.1, pcu: 4.5, srated: 225,
      clientes: [
        cli(`UC ${3000 + k * 10 + t} (Residencial)`, "cativo", Math.round(entrada * 0.36)),
        ...(t === 1 ? [cli(`ACL Indústria ${cod}`, "livre", Math.round(entrada * 0.12))] : []),
        ...(t === 2 ? [cli(`GD Solar ${cod}`, "gd", 8, 40)] : []),
      ],
    })),
  };
}

const inicial: Subestacao[] = [
  { id: "se1", nome: "SE Taquaril", entradaAT: 24200, geracaoLocal: 0, servicoAuxiliar: 45, alvoPT: 7.8, alvoPNT: 5.2, alimentadores: [al("TAQ-AL01", 12850, 1), al("TAQ-AL02", 10420, 2)] },
  { id: "se2", nome: "SE Neves", entradaAT: 21800, geracaoLocal: 300, servicoAuxiliar: 38, alvoPT: 7.5, alvoPNT: 6.0, alimentadores: [al("NEV-AL01", 9870, 3), al("NEV-AL02", 11230, 4)] },
  { id: "se3", nome: "SE Uberlândia-Centro", entradaAT: 14900, geracaoLocal: 0, servicoAuxiliar: 22, alvoPT: 7.2, alvoPNT: 3.5, alimentadores: [al("UBE-AL01", 14320, 5)] },
];

type MapAl = (f: Alimentador) => Alimentador;
const mapAl = (ses: Subestacao[], alId: string, fn: MapAl) => ses.map((s) => ({ ...s, alimentadores: s.alimentadores.map((f) => (f.id === alId ? fn(f) : f)) }));
const mapTr = (ses: Subestacao[], trId: string, fn: (t: Trafo) => Trafo) =>
  ses.map((s) => ({ ...s, alimentadores: s.alimentadores.map((f) => ({ ...f, trafos: f.trafos.map((t) => (t.id === trId ? fn(t) : t)) })) }));

type State = {
  subestacoes: Subestacao[];
  metodologia: Metodologia;
  setMetodologia: (m: Metodologia) => void;
  updSubestacao: (id: string, p: Partial<Subestacao>) => void;
  updAlimentador: (id: string, p: Partial<Alimentador>) => void;
  updCondutor: (id: string, p: Partial<Condutor>) => void;
  updTrafo: (id: string, p: Partial<Trafo>) => void;
  addCliente: (trId: string, c: Omit<Cliente, "id">) => void;
  removeCliente: (trId: string, cId: string) => void;
};

export const useRede = create<State>((set) => ({
  subestacoes: inicial,
  metodologia: "fisico",
  setMetodologia: (metodologia) => set({ metodologia }),
  updSubestacao: (id, p) => set((s) => ({ subestacoes: s.subestacoes.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
  updAlimentador: (id, p) => set((s) => ({ subestacoes: mapAl(s.subestacoes, id, (f) => ({ ...f, ...p })) })),
  updCondutor: (id, p) => set((s) => ({ subestacoes: mapAl(s.subestacoes, id, (f) => ({ ...f, condutor: { ...f.condutor, ...p } })) })),
  updTrafo: (id, p) => set((s) => ({ subestacoes: mapTr(s.subestacoes, id, (t) => ({ ...t, ...p })) })),
  addCliente: (trId, c) => set((s) => ({ subestacoes: mapTr(s.subestacoes, trId, (t) => ({ ...t, clientes: [...t.clientes, { ...c, id: uid("c") }] })) })),
  removeCliente: (trId, cId) => set((s) => ({ subestacoes: mapTr(s.subestacoes, trId, (t) => ({ ...t, clientes: t.clientes.filter((c) => c.id !== cId) })) })),
}));
