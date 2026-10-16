import { describe, expect, it } from "vitest";
import { gapRegulatorio } from "@/lib/metodologia";

describe("gap regulatório", () => {
  it("exposição = excedente acima da meta × tarifa", () => {
    const g = gapRegulatorio(1000, 150, 10, 300);
    expect(g.meta).toBe(100);
    expect(g.gapMWh).toBe(50);
    expect(g.exposicao).toBe(15000);
    expect(g.gapPP).toBeCloseTo(5);
  });
  it("sem exposição quando abaixo da meta", () => {
    expect(gapRegulatorio(1000, 80, 10, 300).exposicao).toBe(0);
  });
});
