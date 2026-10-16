import { describe, expect, it } from "vitest";
import { aplicarMetodologia, balancoAlimentador, balancoSubestacao, energiaFornecida, type Alimentador } from "@/lib/calculationEngine";

const al = (): Alimentador => ({
  id: "a", cod: "X", entradaDisjuntor: 1000, exportacaoFronteira: 50, usoInterno: 10, iluminacaoPublica: 20,
  condutor: { r: 0, comprimento: 0, corrente: 0 }, tensaoKV: 13.8, ampacidade: 400, cor: "x", segmentos: [],
  trafos: [{ id: "t", nome: "T", p0: 0, pcu: 0, srated: 100, segmentoId: "", lat: 0, lng: 0, tensaoPrimKV: 13.8, tensaoSecV: 220, clientes: [
    { id: "1", nome: "c", tipo: "cativo", importacao: 600, exportacao: 0 },
    { id: "2", nome: "l", tipo: "livre", importacao: 200, exportacao: 0 },
    { id: "3", nome: "g", tipo: "gd", importacao: 30, exportacao: 80 },
  ] }],
});

describe("calculationEngine", () => {
  it("E_delivered includes captive, free, internal use, public lighting and GD import", () => {
    expect(energiaFornecida(al()).total).toBe(600 + 200 + 10 + 20 + 30);
  });
  it("GD export and import are summed separately (no net metering)", () => {
    // L_f = 1000 + 80 − 860 − 50 = 170 ; net metering would give 120
    expect(balancoAlimentador(al()).lTotal).toBe(170);
  });
  it("L_NT = L_total − L_technical", () => {
    const b = balancoAlimentador(al());
    expect(b.lNT).toBeCloseTo(b.lTotal - b.lTecnica);
  });
  it("substation balance subtracts feeder outputs and station service", () => {
    const s = { id: "s", nome: "S", entradaAT: 2500, geracaoLocal: 100, servicoAuxiliar: 40, alvoPT: 7, alvoPNT: 3, alimentadores: [al(), al()] };
    expect(balancoSubestacao(s).lTotal).toBe(2500 + 100 - 2000 - 40);
  });
  it("regulatory method overrides losses with PRORET targets and shows exposure", () => {
    const m = aplicarMetodologia({ entradaLiquida: 1000, lTotal: 170, lTecnica: 100, lNT: 70 }, "regulatorio", 7, 3);
    expect(m.pt).toBe(70);
    expect(m.pnt).toBe(30);
    expect(m.exposicao).toBe(70);
  });
});
