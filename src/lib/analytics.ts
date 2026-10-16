// Analytics & Modelos ML — derivado do modelo de rede (pure, tested).
import type { IndicadorTrafo } from "./tematicos";
import { semente } from "./tematicos";

export type Tipologia = "By-pass / desvio" | "Ligação clandestina" | "Medidor travado" | "Inadimplência recorrente";
export type Acao = "Inspeção em campo" | "Blindagem de rede (BTzero)" | "Troca por medição AMI" | "Ação comercial";

export type Alvo = IndicadorTrafo & { score: number; tipologia: Tipologia; acao: Acao; recuperavel: number };

const lim = (x: number) => Math.max(0, Math.min(1, x));

/** Score 0..1 = 0,5·fraude/10 + 0,3·clandestinas/6 + 0,2·inadimplência/16. */
export function scoreAlvo(i: IndicadorTrafo): number {
  return lim(0.5 * (i.fraude / 10) + 0.3 * (i.clandestina / 6) + 0.2 * (i.inadimplencia / 16));
}

export function classificar(i: IndicadorTrafo): Alvo {
  const score = scoreAlvo(i);
  const comp = { fraude: i.fraude / 10, clandestina: i.clandestina / 6, inad: i.inadimplencia / 16, imp: i.impedimento / 12 };
  const top = (Object.entries(comp) as [keyof typeof comp, number][]).sort((a, b) => b[1] - a[1])[0]![0];
  const tipologia: Tipologia = top === "fraude" ? "By-pass / desvio" : top === "clandestina" ? "Ligação clandestina" : top === "imp" ? "Medidor travado" : "Inadimplência recorrente";
  const acao: Acao = tipologia === "Ligação clandestina" ? "Blindagem de rede (BTzero)" : tipologia === "Medidor travado" ? "Troca por medição AMI" : tipologia === "Inadimplência recorrente" ? "Ação comercial" : "Inspeção em campo";
  return { ...i, score, tipologia, acao, recuperavel: i.pnt * score };
}

export function rankingAlvos(ind: IndicadorTrafo[], minScore = 0.7): Alvo[] {
  return ind.map(classificar).filter((a) => a.score >= minScore).sort((a, b) => b.score - a.score);
}

/** "Fraude confirmada" simulada de forma reprodutível: probabilidade igual ao score. */
export const confirmado = (a: Alvo) => semente(a.id + "f") < a.score;

/** Precisão/recall do modelo para cada limiar de score. */
export function curvaPR(alvos: Alvo[], limiares = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
  const positivos = alvos.filter(confirmado).length;
  return limiares.map((l) => {
    const sel = alvos.filter((a) => a.score >= l);
    const vp = sel.filter(confirmado).length;
    return { limiar: l, precisao: sel.length ? vp / sel.length : 0, recall: positivos ? vp / positivos : 0, selecionados: sel.length };
  });
}

/** Eficácia de campo por grupo (inspeções = alvos com score ≥ 0,5). */
export function eficaciaCampo(alvos: Alvo[], grupo: (a: Alvo) => string) {
  const m = new Map<string, { inspecoes: number; confirmadas: number; mwh: number }>();
  for (const a of alvos.filter((x) => x.score >= 0.5)) {
    const g = grupo(a);
    const r = m.get(g) ?? { inspecoes: 0, confirmadas: 0, mwh: 0 };
    r.inspecoes++;
    if (confirmado(a)) { r.confirmadas++; r.mwh += a.pnt; }
    m.set(g, r);
  }
  return [...m.entries()].map(([g, r]) => ({ grupo: g, ...r, assertividade: r.inspecoes ? r.confirmadas / r.inspecoes : 0 })).sort((a, b) => b.mwh - a.mwh);
}

/** Curva de carga 24 h prevista vs. real com bandas ±2σ/±3σ; marca anomalias |real−prev| > 2σ. */
export function curvaCarga(chave: string, base: number) {
  const sigma = base * 0.04;
  return Array.from({ length: 24 }, (_, h) => {
    const prev = base * (0.6 + 0.25 * Math.sin(((h - 6) / 24) * 2 * Math.PI) + (h >= 18 && h <= 21 ? 0.2 : 0));
    const ruido = (semente(chave + h) - 0.5) * 2 * sigma * 1.5;
    const pico = semente(chave + "a" + h) > 0.9 ? (semente(chave + "s" + h) > 0.5 ? 1 : -1) * sigma * 3.5 : 0;
    const real = prev + ruido + pico;
    return { h: `${String(h).padStart(2, "0")}h`, prev, real, b2: [prev - 2 * sigma, prev + 2 * sigma] as [number, number], b3: [prev - 3 * sigma, prev + 3 * sigma] as [number, number], anomalia: Math.abs(real - prev) > 2 * sigma, anom: Math.abs(real - prev) > 2 * sigma ? real : null };
  });
}
