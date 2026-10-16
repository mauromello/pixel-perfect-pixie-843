import { describe, expect, it } from "vitest";
import { projetarMes, sensibilidade, type Params } from "@/lib/sensibilidade";

const p: Params = { basePt: 7, basePnt: 5, horizonte: 12, consumo: 0, gd: 80, gc: 0, fiscal: 10, temperatura: 0, tarifa: 0, pib: 0 };

describe("análise de sensibilidade", () => {
  it("mais fiscalização reduz a PNT projetada", () => {
    expect(projetarMes({ ...p, fiscal: 50 }, 12).pnt).toBeLessThan(projetarMes(p, 12).pnt);
  });
  it("calor eleva a PT projetada", () => {
    expect(projetarMes({ ...p, temperatura: 3 }, 12).pt).toBeGreaterThan(projetarMes(p, 12).pt);
  });
  it("ranking vem ordenado pela amplitude e cobre as 7 variáveis", () => {
    const r = sensibilidade(p);
    expect(r).toHaveLength(7);
    for (let i = 1; i < r.length; i++) expect(r[i - 1]!.amplitude).toBeGreaterThanOrEqual(r[i]!.amplitude);
  });
});

describe("todos os controles influem na projeção", () => {
  const faixa: Record<string, [number, number]> = { consumo: [-20, 20], gd: [0, 400], gc: [0, 300], fiscal: [0, 100], temperatura: [-5, 5], tarifa: [-10, 30], pib: [-5, 5] };
  for (const [k, [lo, hi]] of Object.entries(faixa)) {
    it(`${k} altera PT+PNT mesmo no horizonte de 3 meses`, () => {
      const a = projetarMes({ ...p, horizonte: 3, [k]: lo }, 3), b = projetarMes({ ...p, horizonte: 3, [k]: hi }, 3);
      expect(Math.abs(b.pt + b.pnt - a.pt - a.pnt)).toBeGreaterThan(0.1);
    });
  }
});
