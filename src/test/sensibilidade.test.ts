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
