import { describe, expect, it } from "vitest";
import { aplicarMetodologia, balancoAlimentador, balancoNo, serieBalancoNo } from "@/lib/calculationEngine";
import { arvoreRede, idsNo, gerarSerieDemo, mesesAnteriores } from "@/lib/historico";
import { useRede } from "@/lib/network-store";

describe("selected-node energy balance", () => {
  it("regional KPIs equal the sum of their feeders for both methodologies", () => {
    const { subestacoes, chaves } = useRede.getState();
    const regionais = arvoreRede(subestacoes, chaves).filhos ?? [];
    expect(regionais.length).toBeGreaterThan(0);
    for (const regional of regionais) for (const metodologia of ["fisico", "regulatorio"] as const) {
      const ses = subestacoes.filter(s => s.regional === regional.nome);
      const soma = ses.flatMap(s => s.alimentadores.map(f => {
        const b = balancoAlimentador(f);
        const m = aplicarMetodologia(b, metodologia, s.alvoPT, s.alvoPNT);
        return { injetada: b.entradaLiquida, faturada: b.fornecida.total, pt: m.pt, pnt: m.pnt };
      }));
      const kpi = balancoNo(subestacoes, idsNo(regional), metodologia);
      for (const chave of ["injetada", "faturada", "pt", "pnt"] as const) expect(kpi[chave]).toBeCloseTo(soma.reduce((n, b) => n + b[chave], 0), 8);
    }
  });
  it("manual 5% applies to selected-node input, including an explicit zero override", () => {
    const ses = useRede.getState().subestacoes;
    const b = balancoNo(ses, ["root"], "regulatorio", 5);
    expect(b.pt).toBeCloseTo(b.injetada * 0.05);
    expect(b.pnt).toBeCloseTo(b.injetada - b.faturada - b.pt);
    expect(balancoNo(ses, ["root"], "fisico", 0).pt).toBe(0);
  });
  it("history reads six persisted months; missing readings show only the current cycle", () => {
    const { subestacoes, chaves } = useRede.getState();
    const f = subestacoes[0]?.alimentadores[1];
    if (!f) throw new Error("Missing demo feeder");
    const b = balancoNo(subestacoes, [f.id], "fisico");
    const meses = mesesAnteriores("2026-08-01", 6).reverse();
    const rows = gerarSerieDemo(subestacoes, chaves).filter(r => r.elemento_id === f.id).map(r => ({ ...r, leitura_completa: true, energia_injetada: 100, consumo_mwh: 85 }));
    const h = serieBalancoNo(b, rows, meses, "fisico");
    expect(h.completa).toBe(true); expect(h.serie).toHaveLength(6);
    expect(h.serie[0]?.injetada).toBe(100); expect(h.serie[0]?.perdas).toBe(15);
    const regulatorio = serieBalancoNo(b, rows, meses, "regulatorio");
    expect(regulatorio.serie[0]?.perdas).toBeCloseTo((b.fontes[0]?.alvoPT ?? 0) + (b.fontes[0]?.alvoPNT ?? 0));
    const missing = serieBalancoNo(b, rows.filter(r => r.competencia !== meses[0]), meses, "fisico");
    expect(missing.completa).toBe(false); expect(missing.serie).toHaveLength(1); expect(missing.serie[0]?.injetada).toBe(b.injetada);
  });
  it("recloser descendants have real transformers, each installation appears once", () => {
    const { subestacoes, chaves } = useRede.getState();
    const tree = arvoreRede(subestacoes, chaves);
    const ids = idsNo(tree);
    for (const t of subestacoes.flatMap(s => s.alimentadores.flatMap(f => f.trafos))) {
      expect(ids.filter(id => id === t.id)).toHaveLength(1);
      for (const c of t.clientes) expect(ids.filter(id => id === c.id)).toHaveLength(1);
    }
  });
});