import { balancoAlimentador, type Alimentador, type Chave, type Subestacao, type Trafo } from "./calculationEngine";

/** Estado operacional derivado do modelo de rede (convenção COS: vermelho = fechado/energizado, verde = aberto). */
export const HORAS_MES = 730;

/** Trechos desenergizados: chave aberta (não-interligação) corta jusante. Disjuntor/religador corta o próprio trecho. */
export function trechosDesenergizados(a: Alimentador, chaves: Chave[]): Set<string> {
  const off = new Set<string>();
  let corte = Infinity;
  for (const c of chaves) {
    if (!c.aberta || c.alimentadorBId || c.alimentadorId !== a.id) continue;
    const i = a.segmentos.findIndex((g) => g.id === c.segmentoId);
    if (i < 0) continue;
    corte = Math.min(corte, c.tipo === "disjuntor" || c.tipo === "religador" ? i : i + 1);
  }
  a.segmentos.forEach((g, i) => { if (i >= corte) off.add(g.id); });
  return off;
}

/** Carregamento S/Snominal: demanda média dos clientes (MWh/mês → kW) sobre kVA. */
export function carregamentoTrafo(t: Trafo): number {
  if (!t.srated) return 0;
  const kw = t.clientes.reduce((s, c) => s + c.importacao, 0) * 1000 / HORAS_MES;
  return kw / t.srated;
}

export function sobrecargaAlimentador(a: Alimentador): boolean {
  return a.ampacidade > 0 && a.condutor.corrente > a.ampacidade;
}

/** Perda total dos alimentadores (% da injeção) acima da meta PRORET PT+PNT. */
export function alertaRegulatorio(s: Subestacao): boolean {
  const inj = s.alimentadores.reduce((x, a) => x + a.entradaDisjuntor, 0);
  if (inj <= 0) return false;
  const perda = s.alimentadores.reduce((x, a) => x + balancoAlimentador(a).lTotal, 0);
  return (perda / inj) * 100 > s.alvoPT + s.alvoPNT;
}
