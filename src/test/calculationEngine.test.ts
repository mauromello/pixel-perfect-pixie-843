import { describe, expect, it } from "vitest";
import { aplicarMetodologia, balancoAlimentador, balancoSubestacao, energiaFornecida, perdaTecnica, fatorPerdas, PARAMETROS_PERDA_PADRAO, type Alimentador } from "@/lib/calculationEngine";
import { useRede } from "@/lib/network-store";

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
  it("demo: all 52 feeders have nonnegative PNT and aggregate PT is 1.5–3.5% of net input", () => {
    useRede.getState().restaurarDemo();
    const feeders = useRede.getState().subestacoes.flatMap(s => s.alimentadores);
    expect(feeders).toHaveLength(52);
    const bs = feeders.map(balancoAlimentador);
    for (const b of bs) expect(b.lNT).toBeGreaterThanOrEqual(0);
    const pct = 100 * bs.reduce((n,b) => n + b.lTecnica, 0) / bs.reduce((n,b) => n + b.entradaLiquida, 0);
    expect(pct).toBeGreaterThanOrEqual(1.5); expect(pct).toBeLessThanOrEqual(3.5);
  });
  it("MT uses Fd=1/3 and Fp=0.2·0.6+0.8·0.6² without changing trunk current", () => {
    const f = { ...al(), condutor: { r: 0.3, comprimento: 10, corrente: 200 } };
    expect(fatorPerdas(PARAMETROS_PERDA_PADRAO)).toBeCloseTo(0.408);
    expect(perdaTecnica(f).condutor).toBeCloseTo(3 * 200 ** 2 * 0.3 * 10 * 730 / 1e6 / 3 * 0.408);
    expect(f.condutor.corrente).toBe(200);
  });
  it("each editable factor changes calculated losses", () => {
    const f = { ...al(), condutor: { r: 0.3, comprimento: 10, corrente: 200 } };
    for (const key of ["fd", "coeficiente", "fc"] as const) {
      expect(perdaTecnica({ ...f, parametrosPerda: { ...PARAMETROS_PERDA_PADRAO, [key]: 0.8 } }).total).not.toBe(perdaTecnica(f).total);
    }
  });
  it("imported PT replaces feeder total, including zero, and missing rows fall back analytically", () => {
    const f = { ...al(), condutor: { r: 0.3, comprimento: 10, corrente: 200 }, motorPT: "importado" as const };
    expect(perdaTecnica({ ...f, ptImportada: 17 }).total).toBe(17);
    expect(perdaTecnica({ ...f, ptImportada: 0 }).total).toBe(0);
    expect(perdaTecnica(f).total).toBe(perdaTecnica({ ...f, motorPT: "analitico" }).total);
  });
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
    const s = { id: "s", nome: "S", regional: "", municipio: "", lat: 0, lng: 0, tensaoATkV: 138, tensaoMTkV: 13.8, entradaAT: 2500, geracaoLocal: 100, servicoAuxiliar: 40, alvoPT: 7, alvoPNT: 3, alimentadores: [al(), al()] };
    expect(balancoSubestacao(s).lTotal).toBe(2500 + 100 - 2000 - 40);
  });
  it("regulatory method overrides losses with PRORET targets and shows exposure", () => {
    const m = aplicarMetodologia({ entradaLiquida: 1000, lTotal: 170, lTecnica: 100, lNT: 70 }, "regulatorio", 7, 3);
    expect(m.pt).toBe(70);
    expect(m.pnt).toBe(30);
    expect(m.exposicao).toBe(70);
  });
});
