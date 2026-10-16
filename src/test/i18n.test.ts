import { describe, expect, it } from "vitest";
import { traduzir } from "@/lib/i18n";

describe("i18n", () => {
  it("GC is Conventional Generation in both languages", () => {
    expect(traduzir("pt-BR", "Geração Convencional")).toBe("Geração Convencional");
    expect(traduzir("en-US", "Geração Convencional")).toBe("Conventional Generation");
  });
  it("falls back to Portuguese when missing", () => {
    expect(traduzir("en-US", "texto sem tradução")).toBe("texto sem tradução");
  });
});
