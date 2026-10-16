import { describe, expect, it } from "vitest";
import { classificar, curvaCarga, curvaPR, rankingAlvos, scoreAlvo } from "@/lib/analytics";
import type { IndicadorTrafo } from "@/lib/tematicos";

const ind = (o: Partial<IndicadorTrafo>): IndicadorTrafo => ({ id: "t", nome: "T", alimentador: "A", lat: 0, lng: 0, pt: 0, pnt: 10, inadimplencia: 0, fraude: 0, clandestina: 0, impedimento: 0, tecnologia: null, clientes: 1, ...o });

describe("analytics", () => {
  it("score máximo é 1", () => expect(scoreAlvo(ind({ fraude: 10, clandestina: 6, inadimplencia: 16 }))).toBe(1));
  it("clandestina dominante recomenda BTzero", () => expect(classificar(ind({ clandestina: 6 })).acao).toBe("Blindagem de rede (BTzero)"));
  it("ranking filtra pelo score mínimo 0,7", () => {
    expect(rankingAlvos([ind({ id: "a", fraude: 10, clandestina: 6 }), ind({ id: "b", fraude: 3 })]).map((a) => a.id)).toEqual(["a"]);
  });
  it("recall cai com limiar maior", () => {
    const alvos = Array.from({ length: 50 }, (_, i) => classificar(ind({ id: "x" + i, fraude: i % 10, clandestina: i % 6 })));
    const c = curvaPR(alvos);
    expect(c[0]!.recall).toBeGreaterThanOrEqual(c[c.length - 1]!.recall);
  });
  it("curva de carga tem 24 horas", () => expect(curvaCarga("k", 10)).toHaveLength(24));
});
