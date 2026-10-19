import type { Subestacao, Chave } from "./calculationEngine";
import type { Achado } from "./metodologia";
import { PARAMETROS_CRITICAS, mesesAnteriores, parametroCritica, variacaoHistorica, type LeituraMensal, type ParametroCritica } from "./historico";

export type ContextoAuditoria = { serie: LeituraMensal[]; competencia: string; parametros: ParametroCritica[]; historicoDisponivel: boolean; chaves?: Chave[] };
export function auditarContexto(ses: Subestacao[], ctx: ContextoAuditoria): Achado[] {
  const out: Achado[] = [];
  const ps = ctx.parametros;
  const limite = (regra: string, parametro: string) => parametroCritica(ps, regra, parametro);
  const nomes = new Map<string, string>();
  for (const c of ctx.chaves ?? []) nomes.set(c.id, c.cod);
  const trafos = ses.flatMap(s => s.alimentadores.flatMap(f => f.trafos));
  for (const s of ses) {
    nomes.set(s.id, s.nome);
    for (const f of s.alimentadores) { nomes.set(f.id, f.cod); for (const t of f.trafos) { nomes.set(t.id, t.nome); for (const c of t.clientes) { nomes.set(c.id, c.nome); if (c.medidor) nomes.set(c.medidor.id, c.medidor.numero); } } }
    for (const m of s.medidoresFronteira ?? []) nomes.set(m.id, m.nome);
  }
  const push = (id: string, regra: string, descricao: string, medido: number | null, referencia: number | null, severidade: Achado["severidade"] = "Alta", variacao: number | null = null) => out.push({ elementoId: id, elemento: nomes.get(id) ?? id, regra, descricao, competencia: ctx.competencia, valorMedido: medido, valorReferencia: referencia, severidade, variacaoHistorica: variacao });
  if (ctx.historicoDisponivel) {
    const ids = new Set(ses.length ? nomes.keys() : ctx.serie.map(r => r.elemento_id));
    const porId = new Map<string, LeituraMensal[]>();
    for (const row of ctx.serie) { const rows = porId.get(row.elemento_id) ?? []; rows.push(row); porId.set(row.elemento_id, rows); }
    for (const id of ids) {
      const rows = porId.get(id) ?? [];
      const atual = rows.find(r => r.competencia === ctx.competencia);
      const x = limite("variacao_historica", "percentual");
      for (const campo of ["energia_injetada", "carga_kva"] as const) {
        const v = variacaoHistorica(rows, id, ctx.competencia, campo);
        if (v && x !== undefined && (v.referencia === 0 ? v.medido !== 0 : Math.abs(v.percentual ?? 0) > x)) push(id, "variacao_historica", campo === "energia_injetada" ? "Energia injetada fora da média dos 12 meses anteriores." : "Carga fora da média dos 12 meses anteriores.", v.medido, v.referencia, "Média", v.percentual);
      }
      const n = limite("consumo_zero", "ciclos");
      if (n !== undefined && mesesAnteriores(ctx.competencia, n).every(m => rows.some(r => r.competencia === m && r.leitura_completa && r.consumo_mwh === 0))) push(id, "consumo_zero", "Consumo zerado por ciclos consecutivos.", n, n, "Média", -100);
      const meses = mesesAnteriores(ctx.competencia, 13);
      const faltantes = meses.filter(m => !rows.some(r => r.competencia === m && r.leitura_completa && r.energia_injetada !== null && r.consumo_mwh !== null && r.carga_kva !== null));
      for (const m of faltantes) out.push({ elementoId: id, elemento: nomes.get(id) ?? id, regra: "lacuna_leitura", descricao: "Leitura mensal ausente ou incompleta.", competencia: m, valorMedido: 0, valorReferencia: 1, severidade: "Alta", variacaoHistorica: null });
      const d = limite("degrau", "percentual"); const duracao = limite("degrau", "meses");
      if (d !== undefined && duracao !== undefined && duracao >= 3) {
        const recentes = mesesAnteriores(ctx.competencia, duracao);
        const inicio = recentes.at(-1);
        if (inicio) for (const campo of ["energia_injetada", "carga_kva"] as const) {
          const base = variacaoHistorica(rows, id, inicio, campo);
          const vals = recentes.map(m => rows.find(r => r.competencia === m)).map(r => r?.leitura_completa ? r[campo] : null);
          if (!base || base.referencia <= 0 || vals.some(v => v === null || v === undefined)) continue;
          const desvios = vals.map(v => 100 * ((v ?? 0) - base.referencia) / base.referencia);
          if (desvios.every(v => v > d) || desvios.every(v => v < -d)) push(id, "degrau", "Mudança brusca persistente por pelo menos três meses.", atual?.[campo] ?? null, base.referencia, "Alta", desvios[0] ?? null);
        }
      }
    }
  }
  const idsTrafo = new Set(trafos.map(t => t.id));
  for (const t of trafos) {
    const classe = t.classe;
    const min = classe ? limite("instalacoes_trafo", `${classe}.min`) : undefined;
    const max = classe ? limite("instalacoes_trafo", `${classe}.max`) : undefined;
    if (min !== undefined && max !== undefined && (t.clientes.length < min || t.clientes.length > max)) push(t.id, "instalacoes_trafo", "Quantidade de instalações fora da faixa da classe.", t.clientes.length, t.clientes.length < min ? min : max);
    const fc = classe ? limite("carga_associada", `${classe}.fc`) : undefined;
    const tolerancia = limite("carga_associada", "percentual");
    const cargas = t.clientes.map(c => c.cargaKva);
    if (fc !== undefined && tolerancia !== undefined && cargas.every(v => v !== undefined && Number.isFinite(v))) {
      const esperada = t.srated * fc;
      const associada = cargas.reduce<number>((v, c) => v + (c ?? 0), 0);
      if (esperada > 0 && Math.abs(associada - esperada) / esperada * 100 > tolerancia) push(t.id, "carga_associada", "Carga associada diferente de kVA × fator de carga típico.", associada, esperada, "Média");
    }
    for (const c of t.clientes) {
      if (!c.trafoId || !idsTrafo.has(c.trafoId) || c.trafoId !== t.id) push(c.id, "instalacao_sem_trafo", "Instalação sem vínculo válido com o trafo.", 0, 1);
      if (!c.medidor?.id || !c.medidor.numero) push(c.id, "instalacao_sem_medidor", "Instalação sem medidor identificado.", 0, 1);
    }
  }
  return out;
}
export { PARAMETROS_CRITICAS };