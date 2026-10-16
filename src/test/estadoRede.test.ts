import { describe, expect, it } from "vitest";
import { trechosDesenergizados } from "@/lib/estadoRede";
import type { Alimentador, Chave } from "@/lib/calculationEngine";

const a = { id: "A", segmentos: [{ id: "s0" }, { id: "s1" }, { id: "s2" }] } as unknown as Alimentador;
const ch = (p: Partial<Chave>): Chave => ({ id: "c", cod: "c", tipo: "seccionadora", lat: 0, lng: 0, normalAberta: false, aberta: true, alimentadorId: "A", segmentoId: "s1", ...p });

describe("estado da rede", () => {
  it("seccionadora aberta desenergiza só a jusante", () => {
    expect([...trechosDesenergizados(a, [ch({})])]).toEqual(["s2"]);
  });
  it("disjuntor aberto no trecho 0 desenergiza todo o alimentador", () => {
    expect(trechosDesenergizados(a, [ch({ tipo: "disjuntor", segmentoId: "s0" })]).size).toBe(3);
  });
  it("chave de interligação aberta não desenergiza nada", () => {
    expect(trechosDesenergizados(a, [ch({ alimentadorBId: "B" })]).size).toBe(0);
  });
});
