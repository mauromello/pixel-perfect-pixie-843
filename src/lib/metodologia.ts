// Metodologia e Cálculo (Anexo II itens 1, 2, 4, 8, 10). Pura e testada.
import { balancoAlimentador, perdaTecnica, type Alimentador, type Subestacao } from "./calculationEngine";

export type Motor = "analitico" | "parametrizado" | "regulatorio";
export const MOTORES: { id: Motor; nome: string; desc: string }[] = [
  { id: "analitico", nome: "A — Analítico (PRODIST Módulo 7)", desc: "MT: 3·R·I²·L·Δt; BT: (P0 + Pcu·FC²)·Δt; AT: sobra da SE" },
  { id: "parametrizado", nome: "B — Parametrizado (% informado)", desc: "PT = Entrada líquida × % informado por nível" },
  { id: "regulatorio", nome: "C — Regulatório / IPTD (PRORET 2.6)", desc: "PT e PNT = Entrada líquida × metas homologadas" },
];

/** Perda técnica de um alimentador segundo o motor escolhido (MWh). */
export function perdaTecnicaMotor(f: Alimentador, motor: Motor, pctManual: number, alvoPT: number): number {
  const b = balancoAlimentador(f);
  if (motor === "analitico") return perdaTecnica(f).total;
  const pct = motor === "parametrizado" ? pctManual : alvoPT;
  return (b.entradaLiquida * pct) / 100;
}

/** Sub-balanço geoelétrico: soma dos alimentadores selecionados; fluxos entre membros se compensam. */
export function subBalanco(ses: Subestacao[], ids: string[], motor: Motor, pctManual: number) {
  let entrada = 0, fornecida = 0, pt = 0, fronteiraExterna = 0, fronteiraInterna = 0;
  for (const s of ses) for (const f of s.alimentadores) {
    if (!ids.includes(f.id)) continue;
    const b = balancoAlimentador(f);
    entrada += f.entradaDisjuntor + b.geracaoEmbutida;
    fornecida += b.fornecida.total;
    pt += perdaTecnicaMotor(f, motor, pctManual, s.alvoPT);
    // metade das exportações de fronteira é considerada para alimentadores vizinhos da mesma SE (interna)
    const vizinhoDentro = s.alimentadores.some((o) => o.id !== f.id && ids.includes(o.id));
    if (vizinhoDentro) fronteiraInterna += f.exportacaoFronteira; else fronteiraExterna += f.exportacaoFronteira;
  }
  const liquida = entrada - fronteiraExterna;
  const total = liquida - fornecida;
  const estanqueidade = entrada > 0 ? 100 * (1 - fronteiraExterna / entrada) : 100;
  return { entrada, fronteiraExterna, fronteiraInterna, liquida, fornecida, total, pt, pnt: total - pt, pct: liquida > 0 ? (100 * total) / liquida : 0, estanqueidade };
}

/** Gap regulatório e exposição tarifária (R$) — perda acima da meta não é repassada (Parcela A). */
export function gapRegulatorio(entrada: number, perdaReal: number, alvoPct: number, tarifa: number) {
  const meta = (entrada * alvoPct) / 100;
  const gapMWh = perdaReal - meta;
  const realPct = entrada > 0 ? (100 * perdaReal) / entrada : 0;
  return { meta, gapMWh, gapPP: realPct - alvoPct, realPct, exposicao: Math.max(0, gapMWh) * tarifa };
}

export function gapPorSE(ses: Subestacao[], tarifa: number) {
  return ses.map((s) => {
    let ent = 0, perda = 0;
    for (const f of s.alimentadores) { const b = balancoAlimentador(f); ent += b.entradaLiquida; perda += b.lTotal; }
    return { id: s.id, nome: s.nome, regional: s.regional, entrada: ent, perda, ...gapRegulatorio(ent, perda, s.alvoPT + s.alvoPNT, tarifa) };
  }).sort((a, b) => b.exposicao - a.exposicao);
}

export const CAMADAS = ["Raw (bruta)", "Coletada", "Validada", "Ajustada", "CCEE", "Faturada"] as const;
export type Severidade = "Alta" | "Média" | "Baixa";
export type Achado = { regra: string; elemento: string; descricao: string; severidade: Severidade };

/** 8 regras de auditoria de medição aplicadas ao modelo de rede. */
export function auditar(ses: Subestacao[]): Achado[] {
  const out: Achado[] = [];
  for (const s of ses) for (const f of s.alimentadores) {
    const b = balancoAlimentador(f);
    const el = `${s.nome} / ${f.cod}`;
    const pct = b.entradaLiquida > 0 ? (100 * b.lTotal) / b.entradaLiquida : 0;
    if (f.entradaDisjuntor <= 0) out.push({ regra: "1. Completude de fronteira", elemento: el, descricao: "Sem medição no disjuntor", severidade: "Alta" });
    if (pct < 0) out.push({ regra: "2. Alinhamento temporal", elemento: el, descricao: "Fornecida > injetada (faturamento fora do ciclo)", severidade: "Alta" });
    if (f.trafos.some((t) => t.tensaoPrimKV !== f.tensaoKV)) out.push({ regra: "3. Consistência topológica", elemento: el, descricao: "Trafo com tensão primária ≠ alimentador", severidade: "Média" });
    if (f.trafos.some((t) => t.clientes.some((c) => c.tipo === "gd" && c.exportacao > 0 && c.importacao === 0))) out.push({ regra: "4. Sentido de fluxo GD", elemento: el, descricao: "GD sem registrador de importação", severidade: "Baixa" });
    if (pct > 35) out.push({ regra: "5. Multiplicadores TC/TP", elemento: el, descricao: `Perda ${pct.toFixed(1)}% sugere fator de multiplicação incorreto`, severidade: "Alta" });
    if (f.trafos.some((t) => t.clientes.some((c) => c.tipo === "livre" && c.importacao <= 0))) out.push({ regra: "6. Integração ACL", elemento: el, descricao: "Consumidor livre sem medição CCEE", severidade: "Média" });
    if (b.geracaoEmbutida > 0 && b.geracaoEmbutida > f.entradaDisjuntor) out.push({ regra: "7. Não-compensação de GD", elemento: el, descricao: "Exportação GD superior à entrada (verificar fluxo reverso)", severidade: "Média" });
    if (pct > 20 && pct <= 35) out.push({ regra: "8. Degrau histórico", elemento: el, descricao: `Perda ${pct.toFixed(1)}% fora da faixa típica`, severidade: "Baixa" });
  }
  return out;
}

/** Saúde por camada: % de alimentadores sem achados graves que alcançam a camada. */
export function saudeCamadas(ses: Subestacao[]) {
  const n = ses.reduce((x, s) => x + s.alimentadores.length, 0) || 1;
  const ach = auditar(ses);
  const altas = new Set(ach.filter((a) => a.severidade === "Alta").map((a) => a.elemento)).size;
  const medias = new Set(ach.filter((a) => a.severidade === "Média").map((a) => a.elemento)).size;
  const quedas = [0, 0, altas, altas + medias * 0.5, altas + medias * 0.5, altas + medias];
  return CAMADAS.map((c, i) => ({ camada: c, pct: Math.max(0, 100 * (1 - (quedas[i] ?? 0) / n)) }));
}
