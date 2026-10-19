import type { Subestacao, Chave, Cliente } from "./calculationEngine";
import type { Tables } from "@/integrations/supabase/types";

export type LeituraMensal = Tables<"serie_mensal">;
export type ParametroCritica = Tables<"criticas_parametros">;
export type NoRede = { id: string; nome: string; tipo: string; filhos?: NoRede[] };
export const PARAMETROS_CRITICAS: ParametroCritica[] = [
  { regra: "variacao_historica", parametro: "percentual", valor: 30 },
  { regra: "consumo_zero", parametro: "ciclos", valor: 3 },
  { regra: "degrau", parametro: "percentual", valor: 30 },
  { regra: "degrau", parametro: "meses", valor: 3 },
  { regra: "carga_associada", parametro: "percentual", valor: 50 },
  ...["Residencial", "Comercial", "Rural", "Poder Público", "Industrial BT"].flatMap(classe => [
    { regra: "instalacoes_trafo", parametro: `${classe}.min`, valor: 1 },
    { regra: "instalacoes_trafo", parametro: `${classe}.max`, valor: classe === "Residencial" ? 80 : classe === "Rural" ? 20 : 40 },
    { regra: "carga_associada", parametro: `${classe}.fc`, valor: 0.6 },
  ]),
];
export function parametroCritica(ps: ParametroCritica[], regra: string, parametro: string): number | undefined {
  return ps.find(p => p.regra === regra && p.parametro === parametro)?.valor;
}
export function validarParametroCritica(p: ParametroCritica, ps: ParametroCritica[]): boolean {
  if (!Number.isFinite(p.valor) || p.valor < 0 || !PARAMETROS_CRITICAS.some(x => x.regra === p.regra && x.parametro === p.parametro)) return false;
  if (p.parametro === "ciclos" || p.parametro === "meses" || /\.(min|max)$/.test(p.parametro)) {
    if (!Number.isInteger(p.valor) || (p.parametro === "meses" && p.valor < 3) || (p.parametro === "ciclos" && p.valor < 1)) return false;
  }
  if (p.parametro.endsWith(".fc") && (p.valor <= 0 || p.valor > 1)) return false;
  if (/\.(min|max)$/.test(p.parametro)) {
    const base = p.parametro.replace(/\.(min|max)$/, "");
    const outro = parametroCritica(ps, p.regra, `${base}.${p.parametro.endsWith(".min") ? "max" : "min"}`);
    if (outro !== undefined && (p.parametro.endsWith(".min") ? p.valor > outro : p.valor < outro)) return false;
  }
  return true;
}
export function mesesAnteriores(competencia: string, quantidade: number): string[] {
  const [ano, mes] = competencia.slice(0, 7).split("-").map(Number);
  if (ano === undefined || mes === undefined || !Number.isInteger(ano) || mes < 1 || mes > 12) return [];
  return Array.from({ length: quantidade }, (_, i) => {
    const indice = ano * 12 + mes - 1 - i;
    return `${Math.floor(indice / 12)}-${String(indice % 12 + 1).padStart(2, "0")}-01`;
  });
}
export function variacaoHistorica(serie: LeituraMensal[], elemento: string, competencia: string, campo: "energia_injetada" | "carga_kva" | "consumo_mwh"): { medido: number; referencia: number; percentual: number | null } | null {
  const anteriores = mesesAnteriores(competencia, 13).slice(1);
  const rows = serie.filter(r => r.elemento_id === elemento);
  const atual = rows.find(r => r.competencia === competencia);
  const valores = anteriores.map(m => rows.find(r => r.competencia === m)).map(r => r?.leitura_completa ? r[campo] : null);
  const medido = atual?.[campo];
  if (!atual?.leitura_completa || medido == null || !Number.isFinite(medido) || valores.length !== 12 || valores.some(v => v == null || !Number.isFinite(v))) return null;
  const referencia = valores.reduce<number>((s, v) => s + (v ?? 0), 0) / 12;
  return { medido, referencia, percentual: referencia === 0 ? medido === 0 ? 0 : null : 100 * (medido - referencia) / referencia };
}
/** Live hierarchy, not the unrelated mock-data tree. */
export function arvoreRede(ses: Subestacao[], chaves: Chave[] = []): NoRede {
  return { id: "root", nome: "Distribuidora MG", tipo: "Distribuidora", filhos: [...new Set(ses.map(s => s.regional))].map(regional => ({
    id: `regional:${regional}`, nome: regional, tipo: "Regional", filhos: [...new Set(ses.filter(s => s.regional === regional).map(s => s.municipio))].map(municipio => ({
      id: `municipio:${regional}:${municipio}`, nome: municipio, tipo: "Município", filhos: ses.filter(s => s.regional === regional && s.municipio === municipio).map(s => ({
        id: s.id, nome: s.nome, tipo: "SE", filhos: s.alimentadores.map(f => ({ id: f.id, nome: f.cod, tipo: "Alimentador", filhos: [
          ...chaves.filter(c => c.alimentadorId === f.id).map(c => ({ id: c.id, nome: c.cod, tipo: c.tipo === "religador" ? "Religador" : "Chave" })),
          ...f.trafos.map(t => ({ id: t.id, nome: t.nome, tipo: "Trafo", filhos: t.clientes.map(c => ({ id: c.id, nome: c.nome, tipo: "Instalação", filhos: c.medidor ? [{ id: c.medidor.id, nome: c.medidor.numero, tipo: "Medidor" }] : [] })) })),
        ] })),
      })),
    })),
  })) };
}
export function idsNo(no: NoRede): string[] { return [no.id, ...(no.filhos ?? []).flatMap(idsNo)]; }
export function encontrarNo(no: NoRede, id: string): NoRede | undefined {
  if (no.id === id) return no;
  for (const filho of no.filhos ?? []) { const r = encontrarNo(filho, id); if (r) return r; }
  return undefined;
}
/** Reconcile parent IDs when switching moves a transformer; never invent a missing meter. */
export function vincularInstalacoes(ses: Subestacao[]): Subestacao[] {
  return ses.map(s => ({ ...s, alimentadores: s.alimentadores.map(f => ({ ...f, trafos: f.trafos.map(t => ({ ...t, clientes: t.clientes.map(c => ({ ...c, trafoId: c.trafoId === undefined ? t.id : c.trafoId })) })) })) }));
}
export function instalacoesRede(ses: Subestacao[]): Cliente[] { return ses.flatMap(s => s.alimentadores.flatMap(f => f.trafos.flatMap(t => t.clientes))); }
/** Deterministic fictitious monthly readings. No random, clock, or I/O. Last period is Sep 2026. */
export function gerarSerieDemo(ses: Subestacao[], chaves: Chave[]): LeituraMensal[] {
  const elementos: { id: string; energia: number; consumo: number; carga: number }[] = [];
  for (const s of ses) {
    const consumoSE = s.alimentadores.reduce((v, f) => v + f.trafos.reduce((n, t) => n + t.clientes.reduce((a, c) => a + c.importacao, 0), 0), 0);
    elementos.push({ id: s.id, energia: s.entradaAT, consumo: consumoSE, carga: consumoSE * 1000 / 730 / 0.92 });
    for (const f of s.alimentadores) {
      const consumo = f.trafos.reduce((v, t) => v + t.clientes.reduce((a, c) => a + c.importacao, 0), 0);
      elementos.push({ id: f.id, energia: f.entradaDisjuntor, consumo, carga: consumo * 1000 / 730 / 0.92 });
      for (const t of f.trafos) {
        const ct = t.clientes.reduce((v, c) => v + c.importacao, 0);
        elementos.push({ id: t.id, energia: ct + (t.p0 + t.pcu * 0.36) * 730 / 1000, consumo: ct, carga: ct * 1000 / 730 / 0.92 });
        for (const c of t.clientes) {
          const carga = c.cargaKva ?? c.importacao * 1000 / 730 / 0.92;
          elementos.push({ id: c.id, energia: c.importacao, consumo: c.importacao, carga });
          if (c.medidor) elementos.push({ id: c.medidor.id, energia: c.importacao, consumo: c.importacao, carga });
        }
      }
      for (const c of chaves.filter(c => c.alimentadorId === f.id)) {
        const inicio = f.segmentos.findIndex(sg => sg.id === c.segmentoId);
        const trechos = new Set(f.segmentos.slice(Math.max(0, inicio)).map(sg => sg.id));
        const consumoJ = f.trafos.filter(t => trechos.has(t.segmentoId)).reduce((v, t) => v + t.clientes.reduce((a, c) => a + c.importacao, 0), 0);
        elementos.push({ id: c.id, energia: c.aberta ? 0 : consumoJ, consumo: c.aberta ? 0 : consumoJ, carga: c.aberta ? 0 : consumoJ * 1000 / 730 / 0.92 });
      }
    }
    for (const m of s.medidoresFronteira ?? []) elementos.push({ id: m.id, energia: m.energiaMWh, consumo: m.energiaMWh, carga: m.energiaMWh * 1000 / 730 / 0.92 });
  }
  const meses = mesesAnteriores("2026-09-01", 36).reverse();
  return elementos.flatMap((e, index) => meses.map((competencia, i) => {
    const fator = 0.95 + 0.06 * Math.sin((i % 12) * Math.PI / 6) + i * 0.001;
    const tipo = index % 29;
    const anomalia = tipo === 0 && i === 35 ? 1.65 : tipo === 3 && i >= 33 ? 1.6 : 1;
    const lacuna = tipo === 2 && i === 35;
    return { elemento_id: e.id, competencia, energia_injetada: lacuna ? null : e.energia * fator * anomalia,
      consumo_mwh: lacuna ? null : tipo === 1 && i >= 33 ? 0 : e.consumo * fator,
      carga_kva: lacuna ? null : e.carga * fator * anomalia, leitura_completa: !lacuna, demonstracao: true };
  }));
}