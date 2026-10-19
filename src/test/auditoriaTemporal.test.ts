import { describe, it, expect } from "vitest";
import { auditar } from "@/lib/metodologia";
import { auditarContexto } from "@/lib/auditoriaTemporal";
import { mesesAnteriores, PARAMETROS_CRITICAS, gerarSerieDemo, validarParametroCritica, type LeituraMensal } from "@/lib/historico";
import { useRede } from "@/lib/network-store";
import type { Subestacao } from "@/lib/calculationEngine";

const competencia = "2026-09-01";
function serie(): LeituraMensal[] {
  return mesesAnteriores(competencia, 36).reverse().map(m => ({ elemento_id: "f", competencia: m, energia_injetada: 100, consumo_mwh: 80, carga_kva: 10, leitura_completa: true, demonstracao: true }));
}
const ctx = (s: LeituraMensal[]) => ({ serie: s, competencia, parametros: PARAMETROS_CRITICAS, historicoDisponivel: true });
function rede(): Subestacao[] {
  const s = structuredClone(useRede.getState().subestacoes[0]);
  if (!s) throw new Error("fixture");
  s.alimentadores = s.alimentadores.slice(0, 1);
  const f = s.alimentadores[0]; if (!f) throw new Error("fixture");
  f.trafos = f.trafos.slice(0, 1); const t = f.trafos[0]; if (!t) throw new Error("fixture");
  t.classe = "Residencial"; t.srated = 100; t.clientes = t.clientes.slice(0, 1);
  const c = t.clientes[0]; if (!c) throw new Error("fixture"); c.cargaKva = 60;
  return [s];
}
function fixture() { const ses = rede(); const trafo = ses[0]?.alimentadores[0]?.trafos[0]; if (!trafo) throw new Error("fixture"); return { ses, trafo }; }
describe("críticas históricas e consistência ET-07", () => {
  it("variação >30% usa exatamente os 12 meses anteriores e preserva os valores", () => {
    const s = serie(); const atual = s.at(-1); if (!atual) throw new Error("fixture"); atual.energia_injetada = 140;
    const a = auditarContexto([], ctx(s)).find(a => a.regra === "variacao_historica");
    expect(a).toMatchObject({ elementoId: "f", competencia, valorMedido: 140, valorReferencia: 100, variacaoHistorica: 40 });
    atual.energia_injetada = 130; expect(auditarContexto([], ctx(s)).some(a => a.regra === "variacao_historica")).toBe(false);
    atual.carga_kva = 14; expect(auditarContexto([], ctx(s)).find(a => a.regra === "variacao_historica")?.valorReferencia).toBe(10);
  });
  it("consumo zerado exige N=3 meses consecutivos, não dois", () => {
    const s = serie(); for (const r of s.slice(-3)) r.consumo_mwh = 0;
    expect(auditarContexto([], ctx(s)).find(a => a.regra === "consumo_zero")?.valorMedido).toBe(3);
    const r = s.at(-3); if (r) r.consumo_mwh = 80;
    expect(auditarContexto([], ctx(s)).some(a => a.regra === "consumo_zero")).toBe(false);
  });
  it("lacuna detecta mês ausente e leitura incompleta, sem confundir zero válido", () => {
    const s = serie(); s.pop();
    expect(auditarContexto([], ctx(s)).find(a => a.regra === "lacuna_leitura")?.competencia).toBe(competencia);
    const completo = serie(); const r = completo.at(-1); if (!r) throw new Error("fixture"); r.leitura_completa = false;
    expect(auditarContexto([], ctx(completo)).some(a => a.regra === "lacuna_leitura")).toBe(true);
    r.leitura_completa = true; r.consumo_mwh = 0;
    expect(auditarContexto([], ctx(completo)).some(a => a.regra === "lacuna_leitura")).toBe(false);
  });
  it("degrau exige 3 meses no mesmo sentido contra média pré-degrau", () => {
    const s = serie(); for (const r of s.slice(-3)) r.energia_injetada = 150;
    expect(auditarContexto([], ctx(s)).find(a => a.regra === "degrau")).toMatchObject({ valorMedido: 150, valorReferencia: 100 });
    const r = s.at(-3); if (r) r.energia_injetada = 100;
    expect(auditarContexto([], ctx(s)).some(a => a.regra === "degrau")).toBe(false);
  });
  it("quantidade de instalações respeita faixa da classe 1–80 residencial", () => {
    const { ses, trafo } = fixture(); trafo.clientes = [];
    expect(auditarContexto(ses, { ...ctx([]), historicoDisponivel: false }).find(a => a.regra === "instalacoes_trafo")).toMatchObject({ valorMedido: 0, valorReferencia: 1 });
  });
  it("carga associada compara soma das instalações com 100kVA × 0,6", () => {
    const { ses, trafo } = fixture(); const c = trafo.clientes[0]; if (!c) throw new Error("fixture"); c.cargaKva = 120;
    expect(auditarContexto(ses, { ...ctx([]), historicoDisponivel: false }).find(a => a.regra === "carga_associada")).toMatchObject({ valorMedido: 120, valorReferencia: 60 });
  });
  it("instalação sem trafo detecta referência ausente e inválida", () => {
    const { ses, trafo } = fixture(); const c = trafo.clientes[0]; if (!c) throw new Error("fixture"); c.trafoId = null;
    expect(auditarContexto(ses, { ...ctx([]), historicoDisponivel: false }).some(a => a.regra === "instalacao_sem_trafo")).toBe(true);
    c.trafoId = "inexistente"; expect(auditarContexto(ses, { ...ctx([]), historicoDisponivel: false }).some(a => a.regra === "instalacao_sem_trafo")).toBe(true);
  });
  it("instalação sem medidor detecta ausência sem usar medidor de fronteira", () => {
    const { ses, trafo } = fixture(); const c = trafo.clientes[0]; if (!c) throw new Error("fixture"); c.medidor = null;
    expect(auditar(ses, { ...ctx([]), historicoDisponivel: false }).find(a => a.regra === "instalacao_sem_medidor")?.elementoId).toBe(c.id);
  });
  it("limiares exigem ciclos inteiros, degrau >=3 e fator em (0,1]", () => {
    expect(validarParametroCritica({ regra: "degrau", parametro: "meses", valor: 2 }, PARAMETROS_CRITICAS)).toBe(false);
    expect(validarParametroCritica({ regra: "consumo_zero", parametro: "ciclos", valor: 2.5 }, PARAMETROS_CRITICAS)).toBe(false);
    expect(validarParametroCritica({ regra: "carga_associada", parametro: "Residencial.fc", valor: 1.1 }, PARAMETROS_CRITICAS)).toBe(false);
  });
  it("série demo contém 36 meses por elemento e é determinística", () => {
    const ses = rede(); const a = gerarSerieDemo(ses, []); expect(a).toEqual(gerarSerieDemo(ses, []));
    for (const id of new Set(a.map(r => r.elemento_id))) expect(a.filter(r => r.elemento_id === id)).toHaveLength(36);
    expect(a[0]?.competencia).toBe("2023-10-01"); expect(a.at(-1)?.competencia).toBe("2026-09-01");
  });
});