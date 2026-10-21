import { balancoAlimentador, balancoNo, type Metodologia, type Subestacao } from "./calculationEngine";

/** Rotas que o Copilot pode sugerir como ação rápida. */
export const ROTAS_ACAO = ["/", "/manobras", "/metodologia", "/rede", "/projecao", "/mapas", "/ia", "/guia"] as const;

export type AcaoCopilot = { rota: string; rotulo: string };

const RE_ACAO = /\[\[acao:([^|\]]+)\|([^\]]+)\]\]/g;

/** Extrai cartões de ação `[[acao:/rota|Rótulo]]`, aceitando só rotas permitidas, e devolve o texto limpo. */
export function extrairAcoes(texto: string): { texto: string; acoes: AcaoCopilot[] } {
  const acoes: AcaoCopilot[] = [];
  const limpo = texto.replace(RE_ACAO, (_, rota: string, rotulo: string) => {
    const r = rota.trim();
    const base = r.split("?")[0]!;
    if ((ROTAS_ACAO as readonly string[]).includes(base) && !acoes.some((a) => a.rota === r)) acoes.push({ rota: r, rotulo: rotulo.trim() });
    return "";
  });
  return { texto: limpo.replace(/\n{3,}/g, "\n\n").trim(), acoes };
}

const f1 = (n: number) => (Math.round(n * 10) / 10).toString();

/** Snapshot textual do estado da rede para fundamentar as respostas. */
export function contextoCopilot(ses: Subestacao[], competencia: string, metodologia: Metodologia, rota: string): string {
  const g = balancoNo(ses, ["root"], metodologia);
  const pct = (v: number, base: number) => (base > 0 ? f1((v / base) * 100) : "0");
  const alims = ses.flatMap((s) => s.alimentadores.map((a) => {
    const b = balancoAlimentador(a);
    return { cod: a.cod, se: s.nome, entrada: b.entradaLiquida, pt: b.lTecnica, pnt: b.lNT };
  }));
  const top = [...alims].sort((a, b) => b.pnt / (b.entrada || 1) - a.pnt / (a.entrada || 1)).slice(0, 8);
  return [
    `Tela atual: ${rota}. Competência: ${competencia}. Metodologia: ${metodologia}.`,
    `Rede: ${ses.length} subestações, ${alims.length} alimentadores.`,
    `Distribuidora: injetada ${f1(g.injetada)} MWh, faturada ${f1(g.faturada)} MWh, PT ${f1(g.pt)} MWh (${pct(g.pt, g.injetada)}%), PNT ${f1(g.pnt)} MWh (${pct(g.pnt, g.injetada)}%), perda AT ${f1(g.perdaAT)} MWh.`,
    "Alimentadores com maior PNT%:",
    ...top.map((a) => `- ${a.cod} (${a.se}): entrada ${f1(a.entrada)} MWh, PT ${pct(a.pt, a.entrada)}%, PNT ${pct(a.pnt, a.entrada)}%`),
    "Dados de demonstração (fictícios).",
  ].join("\n");
}

export const INSTRUCOES_COPILOT = `Você é o Copilot Técnico do PerdaZero, engenheiro especialista em balanço energético e perdas de distribuição (ET-07 CEMIG item 4.1.1.2, PRODIST Módulo 7, PRORET Submódulo 2.6).
Regras:
- Responda no idioma da pergunta, de forma objetiva, usando apenas os números do CONTEXTO; se faltar dado, diga que não está disponível. Nunca invente medições.
- Equações do sistema: L_total = E_entrada_líquida − E_fornecida; PNT = L_total − PT; PT MT = 3·I²·R·L·730h·Fd·Fp, Fd=1/3, Fp=0,2·FC+0,8·FC², FC=0,6; motor D usa PT importada PERTEC PLUS.
- Regras CEMIG: cativo A por regra de três com mercado livre; GD A injeção/consumo separados; grupo B por consumidores×consumo médio; IP por carga×horas; CCEE rateio por horas, mês anterior como estimado, recontabilização versionada. Premissas pendentes de validação PC/PM.
- Lembre que os dados são de demonstração.
- Ao final, sugira até 3 ações no formato exato [[acao:/rota|Rótulo]] usando só: / (balanço), /manobras, /metodologia, /rede, /projecao, /mapas, /ia, /guia.`;
