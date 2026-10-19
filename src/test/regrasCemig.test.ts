import { describe, expect, it } from "vitest";
import { aplicarRegrasCemig, energiaCCEE, limitesMes, projetarCativoA, projetarGD, projetarGrupoB, projetarIP, registrarVersaoCCEE, type EntradaRegras, type MedicaoCCEE } from "@/lib/regrasCemig";
import { balancoAlimentador } from "@/lib/calculationEngine";
import { useRede } from "@/lib/network-store";
const entrada = (): EntradaRegras => ({ competencia: "2026-09", grupoA: [{ classe: "A4", cativoAnterior: 100, livreAnterior: 50, livreAtual: 60, cativoAtual: 95, gdConsumoAnterior: 31, gdInjecaoAnterior: 62, gdConsumoAtual: 1, gdInjecaoAtual: 2, crescimentoGD: 10 }], grupoB: [{ classe: "Residencial", energiaAtual: 100, consumidoresAquisicao: 10, consumidoresAnterior: 12, crescimentoConsumidores: 2 }], ipAtual: 0, cargaIP: 10, horasIP: 360, faturas: [], demonstracao: true });
const medicao = (p: Partial<MedicaoCCEE> = {}): MedicaoCCEE => ({ id: "r", ponto: "p", versao: 1, inicio: "2026-08-16T00:00:00Z", fim: "2026-09-16T00:00:00Z", energia: 744, recebidoEm: "2026-10-01T00:00:00Z", ...p });
describe("ET-07 4.1.1.2", () => {
  it("captive A uses previous captive/free ratio times current measured free consumption", () => {
    expect(projetarCativoA(100, 50, 60)).toBe(120); expect(projetarCativoA(100, 0, 60)).toBeNull();
  });
  it("GD consumption/injection stay separate and use month hours and 12-month growth", () => {
    expect(projetarGD(31, "2026-09", 10)).toBeCloseTo(33);
    const r = aplicarRegrasCemig(entrada()); expect(r.gdImport).toBeCloseTo(33); expect(r.gdExport).toBeCloseTo(66);
    expect(r.fornecida).toBeCloseTo(120 + 60 + 33 + 140 + 3.6);
  });
  it("B projects class mean times previous consumers plus 12-month absolute growth", () => {
    expect(projetarGrupoB(100, 10, 12, 2)).toBe(140); expect(projetarGrupoB(100, 0, 12, 2)).toBeNull();
  });
  it("IP uses installed kW times actual month lighting hours, converted to MWh", () => {
    expect(projetarIP(10, 360, "2026-09")).toBe(3.6); expect(projetarIP(10, 721, "2026-09")).toBeNull();
    expect(limitesMes("2024-02").horas).toBe(696);
  });
  it("fraud and recovery apply only to their reference month", () => {
    const e = entrada(); const base = aplicarRegrasCemig(e).fornecida ?? 0;
    e.faturas = [{ id: "1", tipo: "fraude", competencia: "2026-09", energia: 7 }, { id: "2", tipo: "recuperacao", competencia: "2026-09", energia: 3 }, { id: "3", tipo: "fraude", competencia: "2026-08", energia: 90 }];
    expect(aplicarRegrasCemig(e).fornecida).toBeCloseTo(base + 10);
  });
  it("CCEE crossing months allocates exact intersecting hours", () => {
    const r = energiaCCEE([medicao()], "p", "2026-09");
    expect(r.energia).toBe(360); expect(r.horas).toBe(360); expect(r.estimado).toBe(true);
    expect(energiaCCEE([medicao()], "p", "2026-09", true).energia).toBe(720);
  });
  it("missing current CCEE uses previous month marked estimated, never invented zero", () => {
    const r = energiaCCEE([medicao({ inicio: "2026-08-01T00:00:00Z", fim: "2026-09-01T00:00:00Z" })], "p", "2026-09");
    expect(r.energia).toBe(744); expect(r.origem).toBe("mes_anterior"); expect(r.estimado).toBe(true);
    expect(energiaCCEE([], "p", "2026-09").energia).toBeNull();
  });
  it("recounting replaces the old energy and retains both immutable versions", () => {
    const v1 = medicao(), v2 = medicao({ versao: 2, energia: 1488 });
    const ledger = registrarVersaoCCEE(registrarVersaoCCEE([], v1), v2);
    expect(ledger).toHaveLength(2); expect(ledger[0]?.energia).toBe(744);
    expect(energiaCCEE(ledger, "p", "2026-09").energia).toBe(720);
    expect(energiaCCEE(ledger, "p", "2026-09").versoes).toEqual(["r:v2"]);
    expect(() => registrarVersaoCCEE(ledger, v1)).toThrow();
  });
  it("overlapping independent CCEE records fail instead of double counting", () => {
    expect(() => energiaCCEE([medicao(), medicao({ id: "other" })], "p", "2026-09")).toThrow();
  });
  it("balance uses post-rule supplied energy and keeps injected GD separate", () => {
    useRede.getState().restaurarDemo();
    const f = useRede.getState().subestacoes[0]?.alimentadores[0]; if (!f) throw new Error("Demo feeder missing");
    const e = entrada(); const r = aplicarRegrasCemig(e);
    useRede.getState().aplicarMercado(f.id, e, { entrada: 1000, fronteira: 5 });
    const atual = useRede.getState().subestacoes[0]?.alimentadores[0]; if (!atual) throw new Error("Demo feeder missing");
    const b = balancoAlimentador(atual);
    expect(b.fornecida.total).toBeCloseTo((r.fornecida ?? 0) + f.usoInterno);
    expect(b.entradaLiquida).toBeCloseTo(1000 + r.gdExport - 5);
    expect(b.lTotal).toBeCloseTo(b.entradaLiquida - b.fornecida.total);
    useRede.getState().setCompetencia("2026-08");
    expect(useRede.getState().subestacoes[0]?.alimentadores[0]?.regrasCompetencia).toBeUndefined();
    useRede.getState().setCompetencia("2026-09");
    expect(useRede.getState().subestacoes[0]?.alimentadores[0]?.regrasCompetencia?.fornecida).toBe(r.fornecida);
    useRede.getState().restaurarDemo();
  });
});