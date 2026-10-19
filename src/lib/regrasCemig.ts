/** ET-07 4.1.1.2. Pure monthly market rules. All energy in MWh, installed load in kW. */
export type FaturaAjuste = { id: string; competencia: string; energia: number; tipo: "fraude" | "recuperacao" };
export type MedicaoCCEE = { id: string; ponto: string; versao: number; inicio: string; fim: string; energia: number; recebidoEm: string };
export type ResultadoCCEE = { energia: number | null; estimado: boolean; horas: number; versoes: string[]; origem: "medido" | "mes_anterior" | "ausente" };
export type MercadoA = { classe: "A2" | "A3" | "A3a" | "A4" | "AS"; cativoAnterior: number; livreAnterior: number; livreAtual: number; cativoAtual: number; gdConsumoAnterior: number; gdInjecaoAnterior: number; gdConsumoAtual: number; gdInjecaoAtual: number; crescimentoGD: number };
export type MercadoB = { classe: string; energiaAtual: number; consumidoresAquisicao: number; consumidoresAnterior: number; crescimentoConsumidores: number };
export type EntradaRegras = { competencia: string; grupoA: MercadoA[]; grupoB: MercadoB[]; ipAtual: number; cargaIP: number; horasIP: number; faturas: FaturaAjuste[]; demonstracao: boolean };
export type SegmentoRegra = { segmento: string; regra: "cativo_a" | "livre_a" | "gd_consumo" | "gd_injecao" | "grupo_b" | "ip" | "fraude" | "recuperacao"; antes: number; depois: number | null; erro?: string };
export type ResultadoRegras = { competencia: string; segmentos: SegmentoRegra[]; fornecida: number | null; cativos: number; livres: number; gdImport: number; gdExport: number; iluminacao: number; ajustes: number; demonstracao: boolean };

export function limitesMes(competencia: string): { inicio: number; fim: number; horas: number; anterior: string } {
  if (!/^\d{4}-\d{2}(-01)?$/.test(competencia)) throw new Error("Competência inválida.");
  const ano = Number(competencia.slice(0, 4)), mes = Number(competencia.slice(5, 7));
  if (mes < 1 || mes > 12) throw new Error("Competência inválida.");
  const inicio = Date.UTC(ano, mes - 1, 1), fim = Date.UTC(ano, mes, 1);
  return { inicio, fim, horas: (fim - inicio) / 3600000, anterior: new Date(Date.UTC(ano, mes - 2, 1)).toISOString().slice(0, 7) };
}
function naoNegativos(...valores: number[]) { return valores.every(v => Number.isFinite(v) && v >= 0); }
export function projetarCativoA(cativoAnterior: number, livreAnterior: number, livreAtual: number): number | null {
  return naoNegativos(cativoAnterior, livreAnterior, livreAtual) && livreAnterior > 0 ? cativoAnterior / livreAnterior * livreAtual : null;
}
export function projetarGD(anterior: number, competencia: string, crescimentoPercentual: number): number | null {
  const mes = limitesMes(competencia);
  return naoNegativos(anterior) && Number.isFinite(crescimentoPercentual) && crescimentoPercentual >= -100 ? anterior / limitesMes(mes.anterior).horas * mes.horas * (1 + crescimentoPercentual / 100) : null;
}
export function projetarGrupoB(energia: number, consumidoresAquisicao: number, consumidoresAnterior: number, crescimentoConsumidores: number): number | null {
  return naoNegativos(energia, consumidoresAquisicao, consumidoresAnterior) && Number.isInteger(consumidoresAquisicao) && Number.isInteger(consumidoresAnterior) && consumidoresAquisicao > 0 && Number.isFinite(crescimentoConsumidores) && consumidoresAnterior + crescimentoConsumidores >= 0 ? energia / consumidoresAquisicao * (consumidoresAnterior + crescimentoConsumidores) : null;
}
export function projetarIP(cargaKW: number, horas: number, competencia: string): number | null {
  return naoNegativos(cargaKW, horas) && horas <= limitesMes(competencia).horas ? cargaKW * horas / 1000 : null;
}
/** Recounting replaces an ID's active revision, retaining the complete immutable revision ledger. */
export function registrarVersaoCCEE(historico: MedicaoCCEE[], nova: MedicaoCCEE): MedicaoCCEE[] {
  if (!nova.id.trim() || !nova.ponto.trim() || !Number.isInteger(nova.versao) || nova.versao < 1 || !naoNegativos(nova.energia) || !Number.isFinite(Date.parse(nova.inicio)) || !Number.isFinite(Date.parse(nova.fim)) || Date.parse(nova.fim) <= Date.parse(nova.inicio) || !Number.isFinite(Date.parse(nova.recebidoEm))) throw new Error("Medição CCEE inválida.");
  const existentes = historico.filter(r => r.id === nova.id);
  if (existentes.some(r => r.versao >= nova.versao)) throw new Error("A versão CCEE deve ser maior que a anterior.");
  if (existentes.some(r => r.ponto !== nova.ponto)) throw new Error("O ponto CCEE não pode mudar entre versões.");
  return [...historico, { ...nova }];
}
export function energiaCCEE(historico: MedicaoCCEE[], ponto: string, competencia: string, projetarParcial = false, permitirAnterior = true): ResultadoCCEE {
  const mes = limitesMes(competencia);
  const ativos = new Map<string, MedicaoCCEE>();
  for (const r of historico.filter(r => r.ponto === ponto)) if ((ativos.get(r.id)?.versao ?? 0) < r.versao) ativos.set(r.id, r);
  const periodos = [...ativos.values()].map(r => ({ r, inicio: Math.max(mes.inicio, Date.parse(r.inicio)), fim: Math.min(mes.fim, Date.parse(r.fim)) })).filter(p => p.fim > p.inicio).sort((a, b) => a.inicio - b.inicio);
  if (!periodos.length) {
    if (permitirAnterior) {
      const anterior = energiaCCEE(historico, ponto, mes.anterior, projetarParcial, false);
      if (anterior.energia !== null) return { ...anterior, estimado: true, origem: "mes_anterior" };
    }
    return { energia: null, estimado: false, horas: 0, versoes: [], origem: "ausente" };
  }
  let energia = 0, horas = 0, fimAnterior = mes.inicio;
  for (const { r, inicio, fim } of periodos) {
    if (inicio < fimAnterior) throw new Error("Períodos CCEE sobrepostos no mesmo ponto.");
    energia += r.energia * (fim - inicio) / (Date.parse(r.fim) - Date.parse(r.inicio));
    horas += (fim - inicio) / 3600000; fimAnterior = fim;
  }
  return { energia: projetarParcial ? energia * mes.horas / horas : energia, estimado: horas < mes.horas, horas, versoes: periodos.map(p => `${p.r.id}:v${p.r.versao}`), origem: "medido" };
}
export function aplicarRegrasCemig(e: EntradaRegras): ResultadoRegras {
  limitesMes(e.competencia);
  const segmentos: SegmentoRegra[] = [];
  const linha = (segmento: string, regra: SegmentoRegra["regra"], antes: number, depois: number | null) => segmentos.push({ segmento, regra, antes, depois, ...(depois === null || !naoNegativos(antes) ? { erro: "Parâmetros inválidos ou referência ausente." } : {}) });
  for (const a of e.grupoA) {
    linha(a.classe, "cativo_a", a.cativoAtual, projetarCativoA(a.cativoAnterior, a.livreAnterior, a.livreAtual));
    linha(a.classe, "livre_a", a.livreAtual, naoNegativos(a.livreAtual) ? a.livreAtual : null);
    linha(a.classe, "gd_consumo", a.gdConsumoAtual, projetarGD(a.gdConsumoAnterior, e.competencia, a.crescimentoGD));
    linha(a.classe, "gd_injecao", a.gdInjecaoAtual, projetarGD(a.gdInjecaoAnterior, e.competencia, a.crescimentoGD));
  }
  for (const b of e.grupoB) linha(b.classe, "grupo_b", b.energiaAtual, projetarGrupoB(b.energiaAtual, b.consumidoresAquisicao, b.consumidoresAnterior, b.crescimentoConsumidores));
  linha("IP", "ip", e.ipAtual, projetarIP(e.cargaIP, e.horasIP, e.competencia));
  for (const tipo of ["fraude", "recuperacao"] as const) {
    const faturas = e.faturas.filter(f => f.tipo === tipo && f.competencia.slice(0, 7) === e.competencia.slice(0, 7));
    linha(tipo, tipo, 0, faturas.every(f => naoNegativos(f.energia)) && new Set(faturas.map(f => f.id)).size === faturas.length ? faturas.reduce((n, f) => n + f.energia, 0) : null);
  }
  const soma = (...regras: SegmentoRegra["regra"][]) => segmentos.filter(s => regras.includes(s.regra)).reduce((n, s) => n + (s.depois ?? 0), 0);
  const cativos = soma("cativo_a", "grupo_b"), livres = soma("livre_a"), gdImport = soma("gd_consumo"), gdExport = soma("gd_injecao"), iluminacao = soma("ip"), ajustes = soma("fraude", "recuperacao");
  const duplicados = new Set(e.grupoA.map(a => a.classe)).size !== e.grupoA.length || new Set(e.grupoB.map(b => b.classe.trim())).size !== e.grupoB.length;
  if (duplicados) segmentos.push({ segmento: "mercado", regra: "grupo_b", antes: 0, depois: null, erro: "Classes duplicadas não são permitidas." });
  return { competencia: e.competencia.slice(0, 7), segmentos, fornecida: segmentos.some(s => s.erro) ? null : cativos + livres + gdImport + iluminacao + ajustes, cativos, livres, gdImport, gdExport, iluminacao, ajustes, demonstracao: e.demonstracao };
}