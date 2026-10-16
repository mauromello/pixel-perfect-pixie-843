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
  it("translates screens beyond forecast", () => {
    expect(traduzir("en-US", "Perda técnica")).toBe("Technical loss");
    expect(traduzir("en-US", "Exportar CIM-XML")).toBe("Export CIM-XML");
  });
  it("keeps numbers in templated texts", () => {
    expect(traduzir("en-US", "Ordem de inspeção gerada: 9 alvos com suspeita de by-pass")).toBe("Inspection order generated: 9 targets with suspected bypass");
  });
  it("translates composite labels piece by piece", () => {
    expect(traduzir("en-US", "Alimentador · Sobrecarga")).toBe("Feeder · Overload");
  });
});
