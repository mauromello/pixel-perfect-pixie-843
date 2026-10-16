import { describe, expect, it } from "vitest";
import { areaDoCaminho, podeAcessar } from "@/lib/permissoes";

describe("controle de acesso por perfil", () => {
  it("só administrador acessa a gestão de usuários", () => {
    expect(podeAcessar(["admin"], "admin")).toBe(true);
    expect(podeAcessar(["operador"], "admin")).toBe(false);
    expect(podeAcessar(["consulta"], "admin")).toBe(false);
  });
  it("consulta não acessa o modelo de rede", () => {
    expect(podeAcessar(["consulta"], "rede")).toBe(false);
    expect(podeAcessar(["operador"], "rede")).toBe(true);
  });
  it("todos acessam o balanço", () => {
    expect(podeAcessar(["consulta"], "balanco")).toBe(true);
  });
  it("mapeia caminhos para áreas", () => {
    expect(areaDoCaminho("/")).toBe("balanco");
    expect(areaDoCaminho("/admin")).toBe("admin");
  });
});

import { podeAcessar as pa2 } from "@/lib/permissoes";
import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("guia", () => {
  i2("todos os perfis acessam o guia", () => {
    for (const p of ["admin", "operador", "planejamento", "consulta"] as const) e2(pa2([p], "guia")).toBe(true);
  });
});
