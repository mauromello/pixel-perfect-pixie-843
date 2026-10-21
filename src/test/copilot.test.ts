import { describe, expect, it } from "vitest";
import { extrairAcoes } from "@/lib/copilot";

describe("extrairAcoes", () => {
  it("extrai ações de rotas permitidas e limpa o texto", () => {
    const r = extrairAcoes("PNT alta.\n[[acao:/mapas|Ver no mapa]] [[acao:/metodologia|Regras]]");
    expect(r.acoes).toEqual([{ rota: "/mapas", rotulo: "Ver no mapa" }, { rota: "/metodologia", rotulo: "Regras" }]);
    expect(r.texto).toBe("PNT alta.");
  });
  it("descarta rotas fora da lista", () => {
    expect(extrairAcoes("[[acao:/admin|Admin]] [[acao:https://x.com|X]]").acoes).toEqual([]);
  });
});
