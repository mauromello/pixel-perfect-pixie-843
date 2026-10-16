// Projeção de perdas e análise de sensibilidade multivariada (Anexo II itens 11-13, 19 e 31). Puro.
export type Params = {
  basePt: number; basePnt: number; horizonte: number;
  consumo: number; gd: number; gc: number; fiscal: number; // %, MW, MW, %
  temperatura: number; tarifa: number; pib: number; // Δ°C, Δ% tarifa, Δ% PIB regional
};

/** PT/PNT (%) no mês i>0 do horizonte, sem sazonalidade. */
export function projetarMes(p: Params, i: number): { pt: number; pnt: number } {
  const f = i / 24;
  // GD reduz PT até ~150 MW e eleva com fluxo reverso; GC em AT alivia carregamento
  const efGd = p.gd <= 150 ? -p.gd * 0.004 : -0.6 + (p.gd - 150) * 0.006;
  // Calor eleva demanda e resistência dos condutores (+PT); tarifa alta e PIB baixo elevam PNT
  const pt = p.basePt + p.consumo * 0.06 * f + efGd * 2 * f - p.gc * 0.004 * f + p.temperatura * 0.08 * f + p.pib * 0.02 * f;
  const pnt = p.basePnt + i * 0.03 + p.consumo * 0.02 * f - (p.fiscal / 100) * i * 0.12 + p.tarifa * 0.05 * f - p.pib * 0.06 * f + p.temperatura * 0.02 * f;
  return { pt: Math.max(pt, 0), pnt: Math.max(pnt, 0) };
}

export const VARIAVEIS: { k: keyof Params; nome: string; delta: number; u: string }[] = [
  { k: "consumo", nome: "Variação de consumo", delta: 10, u: "%" },
  { k: "gd", nome: "Geração Distribuída", delta: 100, u: "MW" },
  { k: "gc", nome: "Geração Centralizada", delta: 100, u: "MW" },
  { k: "fiscal", nome: "Fiscalização", delta: 20, u: "%" },
  { k: "temperatura", nome: "Temperatura média", delta: 2, u: "°C" },
  { k: "tarifa", nome: "Reajuste tarifário", delta: 10, u: "%" },
  { k: "pib", nome: "PIB regional", delta: 3, u: "%" },
];

export type Impacto = { nome: string; delta: string; ptMenos: number; ptMais: number; pntMenos: number; pntMais: number; amplitude: number };

/** Para cada variável, Δ das perdas totais finais (p.p.) ao variar ±delta mantendo as demais; ordenado pela amplitude. */
export function sensibilidade(p: Params): Impacto[] {
  const base = projetarMes(p, p.horizonte);
  return VARIAVEIS.map((v) => {
    const menos = projetarMes({ ...p, [v.k]: (p[v.k] as number) - v.delta }, p.horizonte);
    const mais = projetarMes({ ...p, [v.k]: (p[v.k] as number) + v.delta }, p.horizonte);
    const r = (n: number) => Math.round(n * 1000) / 1000;
    const ptMenos = r(menos.pt - base.pt), ptMais = r(mais.pt - base.pt), pntMenos = r(menos.pnt - base.pnt), pntMais = r(mais.pnt - base.pnt);
    return { nome: v.nome, delta: `±${v.delta} ${v.u}`, ptMenos, ptMais, pntMenos, pntMais, amplitude: Math.abs(ptMais + pntMais - ptMenos - pntMenos) };
  }).sort((a, b) => b.amplitude - a.amplitude);
}
