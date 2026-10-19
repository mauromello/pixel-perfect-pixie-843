// Metodologia e Cálculo (Anexo II itens 1, 2, 4, 8, 10). Pura e testada.
import { balancoAlimentador, perdaTecnica, perdaTecnicaAnalitica, perdaTecnicaTrafo, type Chave, type Alimentador, type Subestacao } from "./calculationEngine";

export type Motor = "analitico" | "parametrizado" | "regulatorio" | "importado";
export const MOTORES: { id: Motor; nome: string; desc: string }[] = [
  { id: "analitico", nome: "A — Analítico (PRODIST Módulo 7)", desc: "MT: 3·R·I²·L·Δt·Fd·Fp; Fp = a·FC + (1−a)·FC²; BT: (P0 + Pcu·FC²)·Δt; AT: sobra da SE" },
  { id: "parametrizado", nome: "B — Parametrizado (% informado)", desc: "PT = Entrada líquida × % informado por nível" },
  { id: "regulatorio", nome: "C — Regulatório / IPTD (PRORET 2.6)", desc: "PT e PNT = Entrada líquida × metas homologadas" },
  { id: "importado", nome: "D — PT importada (PERTEC PLUS)", desc: "PT = CSV por alimentador; sem linha: motor analítico" },
];

/** Perda técnica de um alimentador segundo o motor escolhido (MWh). */
export function perdaTecnicaMotor(f: Alimentador, motor: Motor, pctManual: number, alvoPT: number): number {
  const b = balancoAlimentador(f);
  if (motor === "analitico") return perdaTecnicaAnalitica(f).total;
  if (motor === "importado") return perdaTecnica({ ...f, motorPT: "importado" }).total;
  const pct = motor === "parametrizado" ? pctManual : alvoPT;
  return (b.entradaLiquida * pct) / 100;
}

/** Strict semicolon CSV; reject ambiguous or invalid rows before changing the model. */
export function importarPertecCSV(texto: string, codigos: string[]) {
  const linhas = texto.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  if (linhas[0]?.trim() !== "cod_alimentador;pt_mwh") throw new Error("Cabeçalho esperado: cod_alimentador;pt_mwh.");
  const valores: Record<string, number> = {};
  const desconhecidos: string[] = [];
  const vistos = new Set<string>();
  for (const linha of linhas.slice(1)) {
    if (!linha.trim()) continue;
    const campos = linha.split(";").map(c => c.trim());
    const cod = campos[0]; const raw = campos[1];
    if (campos.length !== 2 || !cod || !raw || !/^\d+(?:[.,]\d+)?$/.test(raw)) throw new Error("CSV inválido: informe código e PT não negativa em MWh.");
    const pt = Number(raw.replace(",", "."));
    if (!Number.isFinite(pt) || vistos.has(cod)) throw new Error("CSV inválido: valor não finito ou código duplicado.");
    vistos.add(cod);
    if (codigos.includes(cod)) valores[cod] = pt; else desconhecidos.push(cod);
  }
  if (!Object.keys(valores).length) throw new Error("Nenhum alimentador do arquivo existe no modelo.");
  return { valores, desconhecidos };
}

export type ElementosArea = {
  alimentadores: string[];
  /** Ausente: inclui todos os trafos dos alimentadores. Lista explícita: somente estes trafos. */
  trafos?: string[];
  medidoresFronteira: string[];
  chavesCorte: string[];
};
export type ElementoFronteira = { id: string; nome: string; origemId: string; destinoId: string; fluxo: number; tipo: "interno" | "entrada" | "saida"; fonte: "medida" | "estimada" };

/** Rede radial: corte na chave remove seu trecho e os seguintes, sem executar manobra. */
export function subBalanco(ses: Subestacao[], area: ElementosArea, motor: Motor, pctManual: number, chaves: Chave[] = []) {
  const dentro = new Set<string>();
  const fronteira: ElementoFronteira[] = [];
  const alertas: string[] = [];
  const medidores = ses.flatMap(s => s.medidoresFronteira ?? []);
  const selecionados = medidores.filter(m => area.medidoresFronteira.includes(m.id));
  const ativos = selecionados.filter(m => Number.isFinite(m.energiaMWh) && Number.isFinite(m.reversaMWh) && m.energiaMWh >= 0 && m.reversaMWh >= 0 && m.origemId !== m.destinoId);
  selecionados.filter(m => !ativos.includes(m)).forEach(m => alertas.push(`Leitura inválida: ${m.nome}`));
  let entrada = 0, fornecida = 0, pt = 0;
  const calculo = (f: Alimentador) => motor === "importado" ? perdaTecnica({ ...f, motorPT: "importado" }) : perdaTecnicaAnalitica(f);
  const perdasTrafo = (t: Alimentador["trafos"][number]) => {
    const f = ses.flatMap(s => s.alimentadores).find(f => f.trafos.some(tr => tr.id === t.id));
    if (!f) return perdaTecnicaTrafo(t);
    const a = perdaTecnicaAnalitica(f);
    const escala = motor === "importado" && a.total > 0 ? calculo(f).total / a.total : 1;
    return perdaTecnicaTrafo(t, f.parametrosPerda?.fc) * escala;
  };
  const consumo = (t: Alimentador["trafos"][number]) => t.clientes.reduce((n,c) => n + c.importacao, 0);
  const geracao = (t: Alimentador["trafos"][number]) => t.clientes.reduce((n,c) => n + (c.tipo === "gd" ? c.exportacao : 0), 0);
  const cuts = new Map<string, number>();
  for (const s of ses) for (const f of s.alimentadores) {
    const indices = chaves.filter(c => area.chavesCorte.includes(c.id) && c.alimentadorId === f.id && !c.alimentadorBId).map(c => f.segmentos.findIndex(g => g.id === c.segmentoId)).filter(i => i >= 0);
    cuts.set(f.id, indices.length ? Math.min(...indices) : f.segmentos.length);
    if (area.alimentadores.includes(f.id)) {
      dentro.add(f.id);
      f.segmentos.slice(0, cuts.get(f.id)).forEach(g => dentro.add(g.id));
    }
    for (const t of f.trafos) {
      const selecionado = area.trafos === undefined ? area.alimentadores.includes(f.id) : area.trafos.includes(t.id);
      const idx = f.segmentos.findIndex(g => g.id === t.segmentoId);
      const cortado = area.alimentadores.includes(f.id) && idx >= (cuts.get(f.id) ?? f.segmentos.length) && idx >= 0;
      if (selecionado && !cortado) dentro.add(t.id);
    }
  }
  const adicionar = (id: string, nome: string, origemId: string, destinoId: string, fluxo: number, fonte: "medida" | "estimada") => {
    const a = dentro.has(origemId), b = dentro.has(destinoId);
    if (!a && !b) return;
    fronteira.push({ id, nome, origemId, destinoId, fluxo, fonte, tipo: a && b ? "interno" : a ? "saida" : "entrada" });
  };
  for (const s of ses) for (const f of s.alimentadores) {
    const full = dentro.has(f.id);
    const mantidos = f.trafos.filter(t => dentro.has(t.id));
    if (full) {
      entrada += f.entradaDisjuntor;
      fornecida += f.usoInterno + f.iluminacaoPublica;
      const totalL = f.segmentos.reduce((n,g) => n + g.comprimento, 0);
      const keepL = f.segmentos.filter(g => dentro.has(g.id)).reduce((n,g) => n + g.comprimento, 0);
      const proporcao = totalL > 0 ? keepL / totalL : 1;
      let tec = calculo(f).condutor * proporcao;
      const corte = cuts.get(f.id) ?? f.segmentos.length;
      const sgCorte = f.segmentos[corte];
      const jusante = new Set(f.segmentos.slice(corte).map(g => g.id));
      const removidos = f.trafos.filter(t => !dentro.has(t.id));
      for (const t of removidos) {
        if (jusante.has(t.segmentoId)) continue;
        const cobertura = ativos.some(m => m.origemId === t.id || m.destinoId === t.id);
        if (!cobertura) adicionar(`trafo-${t.id}`, t.nome, f.id, t.id, consumo(t) + perdasTrafo(t) - geracao(t), "estimada");
      }
      if (corte < f.segmentos.length) {
        const c = chaves.find(c => area.chavesCorte.includes(c.id) && c.alimentadorId === f.id && c.segmentoId === f.segmentos[corte]?.id);
        const sg = sgCorte;
        const perdaRemovida = calculo(f).condutor * (1 - proporcao);
        const leituraCorte = sg ? ativos.some(m => m.origemId === sg.id || m.destinoId === sg.id) : false;
        if (sg && c && !leituraCorte) {
          const fluxo = removidos.filter(t => jusante.has(t.segmentoId)).reduce((n,t) => n + consumo(t) + perdasTrafo(t) - geracao(t), 0) + perdaRemovida;
          adicionar(c.id, c.cod, f.id, sg.id, fluxo, "estimada");
        }
      }
      tec += mantidos.reduce((n,t) => n + perdasTrafo(t), 0);
      const gd = mantidos.reduce((n,t) => n + geracao(t), 0);
      const entradasExternas = ativos.filter(m => !dentro.has(m.origemId) && m.destinoId === f.id).reduce((n,m) => n + m.energiaMWh - m.reversaMWh, 0);
      const temExportacaoMedida = ativos.some(m => m.origemId === f.id && !f.trafos.some(t => t.id === m.destinoId) && !f.segmentos.some(g => g.id === m.destinoId));
      if (!temExportacaoMedida && f.exportacaoFronteira !== 0) adicionar(`residual-${f.id}`, f.cod, f.id, "exterior", f.exportacaoFronteira, "estimada");
      if (motor === "analitico" || motor === "importado") pt += tec;
      else {
        const saidaArea = removidos.reduce((n,t) => n + consumo(t) + perdasTrafo(t) - geracao(t), 0) + calculo(f).condutor * (1 - proporcao);
        pt += (f.entradaDisjuntor + gd + entradasExternas - f.exportacaoFronteira - saidaArea) * (motor === "parametrizado" ? pctManual : s.alvoPT) / 100;
      }
    }
    for (const t of mantidos) {
      entrada += geracao(t);
      fornecida += consumo(t);
      if (!full) {
        const medido = ativos.some(m => m.destinoId === t.id || m.origemId === t.id);
        if (!medido) adicionar(`entrada-${t.id}`, t.nome, f.id, t.id, consumo(t) + perdasTrafo(t) - geracao(t), "estimada");
        pt += motor === "analitico" || motor === "importado" ? perdasTrafo(t) : (consumo(t) + perdasTrafo(t)) * (motor === "parametrizado" ? pctManual : s.alvoPT) / 100;
      }
    }
  }
  for (const m of ativos) {
    if (!Number.isFinite(m.energiaMWh) || !Number.isFinite(m.reversaMWh) || m.energiaMWh < 0 || m.reversaMWh < 0) { alertas.push(`Leitura inválida: ${m.nome}`); continue; }
    // A meter at a removed transformer is outside a cut area; the cut meter represents its boundary instead.
    const cortado = ses.some(s => s.alimentadores.some(f => dentro.has(f.id) && f.trafos.some(t => (t.id === m.origemId || t.id === m.destinoId) && f.segmentos.slice(cuts.get(f.id)).some(g => g.id === t.segmentoId))));
    if (!cortado) adicionar(m.id, m.nome, m.origemId, m.destinoId, m.energiaMWh - m.reversaMWh, m.fonte);
  }
  const externo = fronteira.filter(e => e.tipo !== "interno");
  const entradasFronteira = externo.filter(e => e.tipo === "entrada").reduce((n,e) => n + e.fluxo, 0);
  const fronteiraExterna = externo.filter(e => e.tipo === "saida").reduce((n,e) => n + e.fluxo, 0);
  entrada += entradasFronteira;
  const fronteiraInterna = fronteira.filter(e => e.tipo === "interno").reduce((n,e) => n + e.fluxo, 0);
  // Feeder breaker inputs already contain energy received from other selected feeders.
  // Remove that counted input when its measured outgoing flow is cancelled internally.
  const alimentadoresDentro = new Set(area.alimentadores);
  entrada -= fronteira.filter(e => e.tipo === "interno" && alimentadoresDentro.has(e.destinoId) && e.origemId !== e.destinoId).reduce((n,e) => n + e.fluxo, 0);
  const liquida = entrada - fronteiraExterna;
  if (motor === "parametrizado") pt = liquida * pctManual / 100;
  const total = liquida - fornecida;
  const estanqueidade = entrada > 0 ? Math.max(0, Math.min(100, 100 * (1 - Math.abs(fronteiraExterna) / entrada))) : 100;
  const estimadas = externo.filter(e => e.fonte === "estimada").length;
  if (estimadas) alertas.push("Fronteira com fluxos estimados; balanço não homologado.");
  const ids = new Set(ses.flatMap(s => s.alimentadores.flatMap(f => [f.id, ...f.trafos.map(t => t.id)])));
  if ([...area.alimentadores, ...(area.trafos ?? [])].some(id => !ids.has(id)) || area.medidoresFronteira.some(id => !medidores.some(m => m.id === id)) || area.chavesCorte.some(id => !chaves.some(c => c.id === id))) alertas.push("A área contém elementos ausentes no modelo atual.");
  return { entrada, fronteiraExterna, fronteiraInterna, liquida, fornecida, total, pt, pnt: total - pt, pct: liquida > 0 ? 100 * total / liquida : 0, estanqueidade, fronteira, alertas };
}

export function validarElementosArea(value: unknown): ElementosArea | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const lista = (x: unknown): x is string[] => Array.isArray(x) && x.every(i => typeof i === "string");
  if (!lista(v['alimentadores']) || !lista(v['medidoresFronteira']) || !lista(v['chavesCorte']) || (v['trafos'] !== undefined && !lista(v['trafos']))) return null;
  return { alimentadores: v['alimentadores'], ...(lista(v['trafos']) ? { trafos: v['trafos'] } : {}), medidoresFronteira: v['medidoresFronteira'], chavesCorte: v['chavesCorte'] };
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
