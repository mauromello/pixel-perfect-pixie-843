import { describe, expect, it } from "vitest";
import { useRede } from "@/lib/network-store";
import { balancoAlimentador } from "@/lib/calculationEngine";
import { areasCriticas, indicadoresTrafos } from "@/lib/tematicos";

describe("mapas temáticos", () => {
  const a = useRede.getState().subestacoes[0]!.alimentadores[0]!;
  it("PNT rateada pelos trafos soma a PNT do alimentador", () => {
    const soma = indicadoresTrafos(a).reduce((s, i) => s + i.pnt, 0);
    expect(soma).toBeCloseTo(Math.max(0, balancoAlimentador(a).lNT), 6);
  });
  it("áreas críticas vêm ordenadas do maior para o menor", () => {
    const r = areasCriticas(indicadoresTrafos(a), "pnt", 3);
    for (let i = 1; i < r.length; i++) expect(r[i - 1]!.pnt).toBeGreaterThanOrEqual(r[i]!.pnt);
  });
});
