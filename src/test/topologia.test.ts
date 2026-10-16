import { describe, expect, it } from "vitest";
import { manobrar, perdasPorNivel, type Alimentador, type Chave, type Subestacao } from "@/lib/calculationEngine";
import { importarBDGD } from "@/lib/bdgd";

const seg = (id: string) => ({ id, cod: id, coords: [[0, 0], [0, 1]] as [number, number][], comprimento: 1 });
const al = (id: string, kv: number, corrente: number, ampacidade = 400): Alimentador => ({
  id, cod: id.toUpperCase(), entradaDisjuntor: 1000, exportacaoFronteira: 0, usoInterno: 0, iluminacaoPublica: 0,
  condutor: { r: 0.3, comprimento: 4, corrente }, tensaoKV: kv, ampacidade, cor: "x",
  segmentos: [seg(`${id}1`), seg(`${id}2`), seg(`${id}3`), seg(`${id}4`)],
  trafos: [`${id}2`, `${id}4`].map((s, i) => ({ id: `${id}t${i}`, nome: "T", p0: 1, pcu: 4, srated: 100, segmentoId: s, lat: 0, lng: 0, tensaoPrimKV: kv, tensaoSecV: 220,
    clientes: [{ id: `${id}c${i}`, nome: "c", tipo: "cativo" as const, importacao: 400, exportacao: 0 }] })),
});
const rede = (kvB = 13.8, ampB = 400) => {
  const ses: Subestacao[] = [{ id: "s", nome: "S", regional: "", municipio: "", lat: 0, lng: 0, tensaoATkV: 138, tensaoMTkV: 13.8, entradaAT: 2100, geracaoLocal: 0, servicoAuxiliar: 0, alvoPT: 7, alvoPNT: 5, alimentadores: [al("a", 13.8, 200), al("b", kvB, 200, ampB)] }];
  const chaves: Chave[] = [
    { id: "sec", cod: "SEC", tipo: "seccionadora", lat: 0, lng: 0, normalAberta: false, aberta: false, alimentadorId: "a", segmentoId: "a3" },
    { id: "tie", cod: "NA", tipo: "seccionadora", lat: 0, lng: 0, normalAberta: true, aberta: true, alimentadorId: "a", segmentoId: "a4", alimentadorBId: "b", segmentoBId: "b4" },
  ];
  return { ses, chaves };
};

describe("manobras com re-topologização", () => {
  it("transfere trechos e trafos a jusante da seccionadora ao receptor", () => {
    const { ses, chaves } = rede();
    const r = manobrar(ses, chaves, "tie", "sec");
    if (!r.ok) throw new Error(r.erro);
    const [a, b] = r.subestacoes[0]!.alimentadores;
    expect(a!.segmentos.map((g) => g.id)).toEqual(["a1", "a2"]);
    expect(b!.trafos.some((t) => t.segmentoId === "a4")).toBe(true);
    expect(a!.entradaDisjuntor).toBe(500);
    expect(b!.entradaDisjuntor).toBe(1500);
    expect(b!.condutor.corrente).toBe(300);
    expect(r.chaves.find((c) => c.id === "tie")!.aberta).toBe(false);
    expect(r.chaves.find((c) => c.id === "sec")!.aberta).toBe(true);
  });
  it("bloqueia manobra entre níveis de tensão diferentes", () => {
    const { ses, chaves } = rede(34.5);
    expect(manobrar(ses, chaves, "tie", "sec").ok).toBe(false);
  });
  it("bloqueia manobra que excede a ampacidade do receptor", () => {
    const { ses, chaves } = rede(13.8, 250);
    const r = manobrar(ses, chaves, "tie", "sec");
    expect(r.ok).toBe(false);
  });
  it("bloqueia fechar uma chave de interligação já fechada (laço)", () => {
    const { ses, chaves } = rede();
    expect(manobrar(ses, chaves.map((c) => ({ ...c, aberta: false })), "tie", "sec").ok).toBe(false);
  });
  it("perdas por nível: AT = sobra da SE, MT = condutores, BT = trafos", () => {
    const { ses } = rede();
    const p = perdasPorNivel(ses[0]!);
    expect(p.at).toBe(100);
    expect(p.total).toBeCloseTo(p.at + p.mt + p.bt);
  });
});

describe("importação BDGD", () => {
  it("monta SE → alimentador → trechos → trafos → UC e chave de interligação", () => {
    const fc = (name: string, features: unknown[]) => ({ nome: `${name}.geojson`, dados: { type: "FeatureCollection" as const, name, features: features as never } });
    const pt = (x: number, y: number) => ({ type: "Point", coordinates: [x, y] });
    const ln = (...c: number[][]) => ({ type: "LineString", coordinates: c });
    const r = importarBDGD([
      fc("SUB", [{ type: "Feature", geometry: pt(-44, -19.9), properties: { COD_ID: "S1", NOME: "SE Teste" } }]),
      fc("CTMT", [
        { type: "Feature", geometry: null, properties: { COD_ID: "C1", NOME: "AL1", SUB: "S1", TEN_NOM: 13800, ENE_01: 1000000 } },
        { type: "Feature", geometry: null, properties: { COD_ID: "C2", NOME: "AL2", SUB: "S1", TEN_NOM: 13.8, ENE_01: 800000 } },
      ]),
      fc("SSDMT", [
        { type: "Feature", geometry: ln([-44, -19.9], [-44.01, -19.9]), properties: { COD_ID: "G1", CTMT: "C1", COMP: 1000 } },
        { type: "Feature", geometry: ln([-44, -19.9], [-44.01, -19.901]), properties: { COD_ID: "G2", CTMT: "C2", COMP: 1100 } },
      ]),
      fc("UNTRMT", [{ type: "Feature", geometry: pt(-44.01, -19.9), properties: { COD_ID: "T1", CTMT: "C1", POT_NOM: 75, PER_FER: 300, PER_TOT: 1500 } }]),
      fc("UCBT", [{ type: "Feature", geometry: pt(-44.01, -19.9), properties: { COD_ID: "U1", UNI_TR_MT: "T1", ENE_01: 200000 } }]),
      fc("UNSEMT", [{ type: "Feature", geometry: pt(-44.01, -19.9005), properties: { COD_ID: "K1", CTMT: "C1", P_N_OPE: "A" } }]),
    ]);
    const s = r.subestacoes[0]!;
    expect(s.nome).toBe("SE Teste");
    expect(s.alimentadores.map((a) => a.tensaoKV)).toEqual([13.8, 13.8]);
    const a1 = s.alimentadores.find((a) => a.cod === "AL1")!;
    expect(a1.entradaDisjuntor).toBe(1000);
    expect(a1.trafos[0]!.p0).toBeCloseTo(0.3);
    expect(a1.trafos[0]!.pcu).toBeCloseTo(1.2);
    expect(a1.trafos[0]!.clientes[0]!.importacao).toBe(200);
    expect(r.chaves[0]!.alimentadorBId).toBe(s.alimentadores.find((a) => a.cod === "AL2")!.id);
  });
});
