import { describe, expect, it } from "vitest";
import { gapRegulatorio, subBalanco, validarElementosArea, type ElementosArea } from "@/lib/metodologia";
import { balancoAlimentador, type Alimentador, type Chave, type Subestacao } from "@/lib/calculationEngine";

describe("gap regulatório", () => {
  it("exposição = excedente acima da meta × tarifa", () => {
    const g = gapRegulatorio(1000, 150, 10, 300);
    expect(g.meta).toBe(100);
    expect(g.gapMWh).toBe(50);
    expect(g.exposicao).toBe(15000);
    expect(g.gapPP).toBeCloseTo(5);
  });
  it("sem exposição quando abaixo da meta", () => {
    expect(gapRegulatorio(1000, 80, 10, 300).exposicao).toBe(0);
  });
});

function rede(): Subestacao[] {
  const f: Alimentador = { id: "a", cod: "A", entradaDisjuntor: 1000, exportacaoFronteira: 50, usoInterno: 10, iluminacaoPublica: 20, tensaoKV: 13.8, ampacidade: 400, cor: "x", condutor: { r: 0, comprimento: 2, corrente: 0 }, segmentos: [{ id: "s1", cod: "S1", coords: [], comprimento: 1 }, { id: "s2", cod: "S2", coords: [], comprimento: 1 }], trafos: [0, 1].map(i => ({ id: `t${i + 1}`, nome: `T${i + 1}`, segmentoId: `s${i + 1}`, p0: 1, pcu: 0, srated: 100, lat: 0, lng: 0, tensaoPrimKV: 13.8, tensaoSecV: 220, clientes: [{ id: `c${i}`, nome: "C", tipo: "cativo", importacao: 300, exportacao: 0 }] })) };
  return [{ id: "se", nome: "SE", regional: "", municipio: "", lat: 0, lng: 0, tensaoATkV: 138, tensaoMTkV: 13.8, entradaAT: 2000, geracaoLocal: 0, servicoAuxiliar: 0, alvoPT: 7, alvoPNT: 3, alimentadores: [f, { ...f, id: "b", cod: "B", trafos: [], segmentos: [] }] }];
}
const area = (p: Partial<ElementosArea> = {}): ElementosArea => ({ alimentadores: ["a"], medidoresFronteira: [], chavesCorte: [], ...p });
const cut: Chave = { id: "cut", cod: "CUT", tipo: "seccionadora", lat: 0, lng: 0, normalAberta: false, aberta: false, alimentadorId: "a", segmentoId: "s2" };

describe("sub-balanços geoelétricos", () => {
  it("alimentadores preservam o balanço salvo a antiga regra dos vizinhos", () => {
    const ses = rede();
    const sb = subBalanco(ses, area({ alimentadores: ["a", "b"] }), "analitico", 7);
    const expected = ses[0]?.alimentadores.reduce((n,f) => n + balancoAlimentador(f).lTotal, 0);
    expect(sb.total).toBe(expected);
    expect(sb.fronteiraExterna).toBe(100);
    expect(sb.fronteiraInterna).toBe(0);
  });
  it("trafo excluído vira saída com consumo e perdas e não contribui à energia fornecida", () => {
    const sb = subBalanco(rede(), area({ trafos: ["t1"] }), "analitico", 7);
    expect(sb.fornecida).toBe(330);
    expect(sb.fronteiraExterna).toBeCloseTo(350.73);
    expect(sb.pt).toBeCloseTo(0.73);
    expect(sb.fronteira.find(e => e.id === "trafo-t2")?.fluxo).toBeCloseTo(300.73);
  });
  it("chave de corte separa o trecho e o trafo a jusante sem alterar a rede", () => {
    const ses = rede(); const before = JSON.stringify(ses);
    const sb = subBalanco(ses, area({ chavesCorte: ["cut"] }), "analitico", 7, [cut]);
    expect(sb.fornecida).toBe(330);
    expect(sb.pt).toBeCloseTo(0.73);
    expect(sb.fronteira.find(e => e.id === "cut")?.fluxo).toBeCloseTo(300.73);
    expect(sb.fronteiraExterna).toBeCloseTo(350.73);
    expect(JSON.stringify(ses)).toBe(before);
  });
  it("somente fluxo com ambos os extremos internos é compensado", () => {
    const ses = rede(); const se = ses[0]; if (!se) throw new Error("fixture");
    se.medidoresFronteira = [{ id: "m", nome: "M", origemId: "a", destinoId: "b", energiaMWh: 50, reversaMWh: 0, fonte: "medida" }];
    const one = subBalanco(ses, area({ medidoresFronteira: ["m"] }), "analitico", 7);
    expect(one.fronteiraExterna).toBe(50); expect(one.fronteiraInterna).toBe(0);
    const both = subBalanco(ses, area({ alimentadores: ["a", "b"], medidoresFronteira: ["m"] }), "analitico", 7);
    expect(both.fronteiraExterna).toBe(50); expect(both.fronteiraInterna).toBe(50);
    expect(both.entrada).toBe(1950);
  });
  it("medidor no corte substitui estimativa sem duplicar consumo de trafos", () => {
    const ses = rede(); const se = ses[0]; if (!se) throw new Error("fixture");
    se.medidoresFronteira = [{ id: "mc", nome: "MC", origemId: "s1", destinoId: "s2", energiaMWh: 320, reversaMWh: 10, fonte: "medida" }];
    const sb = subBalanco(ses, area({ chavesCorte: ["cut"], medidoresFronteira: ["mc"] }), "analitico", 7, [cut]);
    expect(sb.fronteiraExterna).toBe(360);
    expect(sb.fronteira.filter(e => e.id === "cut")).toHaveLength(0);
  });
  it("área apenas com trafo soma consumo e perdas sem duplicar GD", () => {
    const sb = subBalanco(rede(), area({ alimentadores: [], trafos: ["t1"] }), "analitico", 7);
    expect(sb.entrada).toBeCloseTo(300.73); expect(sb.fornecida).toBe(300); expect(sb.total).toBeCloseTo(0.73);
  });
  it("área salva inválida é rejeitada", () => {
    expect(validarElementosArea({ alimentadores: [123], trafos: [], medidoresFronteira: [], chavesCorte: [] })).toBeNull();
    expect(validarElementosArea(area())).toEqual(area());
  });
  it("leitura externa prevalece sobre exportação agregada antiga", () => {
    const ses = rede(); const se = ses[0]; if (!se) throw new Error("fixture");
    se.medidoresFronteira = [{ id: "m", nome: "M", origemId: "a", destinoId: "exterior", energiaMWh: 123.45, reversaMWh: 10, fonte: "medida" }];
    const sb = subBalanco(ses, area({ medidoresFronteira: ["m"] }), "analitico", 7);
    expect(sb.fronteiraExterna).toBeCloseTo(113.45);
  });
});
