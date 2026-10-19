import { describe, expect, it } from "vitest";
import { useRede } from "@/lib/network-store";
import { COLUNAS_DICIONARIO, DICIONARIO_SEED, exportarDicionarioCSV, filtrarDicionario } from "@/lib/dicionarioSeed";

function cobrir(entidade: string, objetos: object[]) {
  expect(objetos.length).toBeGreaterThan(0);
  const documentados = new Set(DICIONARIO_SEED.filter(r => r.entidade === entidade).map(r => r.variavel));
  for (const objeto of objetos) for (const campo of Object.keys(objeto)) expect(documentados.has(campo), `${entidade}.${campo} não documentado`).toBe(true);
}
describe("dicionário de extrações", () => {
  const ses = useRede.getState().subestacoes;
  const feeders = ses.flatMap(s => s.alimentadores);
  const trafos = feeders.flatMap(f => f.trafos);
  it("documenta todas as chaves das SEs da rede demo", () => cobrir("Subestacao", ses));
  it("documenta todas as chaves dos alimentadores da rede demo", () => cobrir("Alimentador", feeders));
  it("documenta todas as chaves dos trafos da rede demo", () => cobrir("Trafo", trafos));
  it("documenta todas as chaves das instalações da rede demo", () => {
    const clientes = trafos.flatMap(t => t.clientes);
    cobrir("Instalacao", clientes); cobrir("Cliente", clientes);
  });
  it("documenta todas as chaves das chaves operacionais da rede demo", () => cobrir("Chave", useRede.getState().chaves));
  it("documenta condutores, trechos e medidores de fronteira", () => {
    cobrir("Condutor", feeders.map(f => f.condutor));
    cobrir("Segmento", feeders.flatMap(f => f.segmentos));
    cobrir("MedidorFronteira", ses.flatMap(s => s.medidoresFronteira ?? []));
  });
  it("cobre campos opcionais e não confunde nomes fictícios com campos reais", () => {
    const campos = DICIONARIO_SEED.filter(r => r.entidade === "Alimentador");
    for (const k of ["parametrosPerda", "motorPT", "ptImportada"]) expect(campos.some(r => r.variavel === k && !r.obrigatoria)).toBe(true);
    expect(DICIONARIO_SEED.some(r => r.variavel === "energia_faturada_kwh")).toBe(false);
    expect(DICIONARIO_SEED.find(r => r.entidade === "MedidorFronteira" && r.variavel === "energiaMWh")?.unidade).toBe("MWh");
  });
  it("não oculta entidades ausentes nem anuncia integrações ativas", () => {
    for (const ent of ["TrafoATMT", "ClimaDiario", "UsinaGC"]) expect(DICIONARIO_SEED.find(r => r.entidade === ent)?.tipo).toBe("ausente");
    expect(DICIONARIO_SEED.find(r => r.entidade === "Medidor" && r.variavel === "numero")?.tipo).toBe("string");
  });
  it("cada par entidade/variável é único", () => {
    expect(new Set(DICIONARIO_SEED.map(r => `${r.entidade}.${r.variavel}`)).size).toBe(DICIONARIO_SEED.length);
  });
  it("filtro combina grupo e busca sem diferenciar acentos", () => {
    const rows = filtrarDicionario(DICIONARIO_SEED, "Inventário geoelétrico", "resistencia");
    expect(rows.map(r => r.variavel)).toEqual(["r"]);
  });
  it("CSV exporta as 12 colunas, escapa aspas e impede fórmulas", () => {
    const row = DICIONARIO_SEED[0]; if (!row) throw new Error("seed");
    const csv = exportarDicionarioCSV([{ ...row, descricao: '=HYPERLINK("x");' }]);
    expect(csv.split("\r\n")[0]).toBe('\uFEFF' + COLUNAS_DICIONARIO.join(";"));
    expect(csv).toContain('"\'=HYPERLINK(""x"");"');
  });
});