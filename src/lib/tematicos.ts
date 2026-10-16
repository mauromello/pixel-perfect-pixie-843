// Mapas temáticos (Anexo II itens 30 e 33). Puro e determinístico: deriva indicadores
// por transformador a partir do modelo de rede único; atributos comerciais (fraude,
// inadimplência…) são simulados de forma estável até a integração com CCS/SAP.
import { balancoAlimentador, type Alimentador, type Subestacao, type Coord } from "@/lib/calculationEngine";
import { carregamentoTrafo, HORAS_MES } from "@/lib/estadoRede";

export type TemaId = "pt" | "pnt" | "inadimplencia" | "fraude" | "clandestina" | "impedimento";
export const TEMAS: { id: TemaId; nome: string; unidade: string; cor: string }[] = [
  { id: "pt", nome: "Perdas Técnicas (PT)", unidade: "MWh", cor: "#2563eb" },
  { id: "pnt", nome: "Perdas Não Técnicas (PNT)", unidade: "MWh", cor: "#dc2626" },
  { id: "inadimplencia", nome: "Inadimplência", unidade: "%", cor: "#9333ea" },
  { id: "fraude", nome: "Concentração de fraudes", unidade: "casos", cor: "#ea580c" },
  { id: "clandestina", nome: "Ligações clandestinas", unidade: "casos", cor: "#b91c1c" },
  { id: "impedimento", nome: "Impedimento de leitura", unidade: "%", cor: "#0891b2" },
];
export const TECNOLOGIAS = ["QMB", "BTzero", "AMI", "NB-IoT", "Remota"] as const;
export type Tecnologia = (typeof TECNOLOGIAS)[number];
export const COR_TEC: Record<Tecnologia, string> = { QMB: "#0d9488", BTzero: "#65a30d", AMI: "#7c3aed", "NB-IoT": "#db2777", Remota: "#475569" };

/** Hash estável 0..1 por texto (para atributos simulados reproduzíveis). */
export function semente(txt: string): number {
  let h = 2166136261;
  for (let i = 0; i < txt.length; i++) h = Math.imul(h ^ txt.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

export type IndicadorTrafo = {
  id: string; nome: string; alimentador: string; lat: number; lng: number;
  pt: number; pnt: number; inadimplencia: number; fraude: number; clandestina: number; impedimento: number;
  tecnologia: Tecnologia | null; clientes: number;
};

/** PT do trafo = (P0 + Pcu·FC²)·730 h; PNT do alimentador rateada pelo consumo de cada trafo. */
export function indicadoresTrafos(a: Alimentador): IndicadorTrafo[] {
  const pntAlim = Math.max(0, balancoAlimentador(a).lNT);
  const consumoTotal = a.trafos.reduce((s, t) => s + t.clientes.reduce((x, c) => x + c.importacao, 0), 0);
  return a.trafos.map((t) => {
    const consumo = t.clientes.reduce((x, c) => x + c.importacao, 0);
    const fc = carregamentoTrafo(t);
    const r = semente(t.id);
    const pnt = consumoTotal > 0 ? (pntAlim * consumo) / consumoTotal : a.trafos.length ? pntAlim / a.trafos.length : 0;
    const riscoPNT = consumo > 0 ? pnt / consumo : 0;
    return {
      id: t.id, nome: t.nome, alimentador: a.cod, lat: t.lat, lng: t.lng,
      pt: ((t.p0 + t.pcu * fc * fc) * HORAS_MES) / 1000,
      pnt,
      inadimplencia: Math.round((2 + r * 14) * 10) / 10,
      fraude: Math.round(r * 6 + riscoPNT * 40),
      clandestina: Math.round(semente(t.id + "c") * 4 + riscoPNT * 20),
      impedimento: Math.round(semente(t.id + "i") * 120) / 10,
      tecnologia: semente(t.id + "t") < 0.55 ? TECNOLOGIAS[Math.floor(semente(t.id + "k") * TECNOLOGIAS.length)] : null,
      clientes: t.clientes.length,
    };
  });
}

/** Ranking de áreas críticas: trafos ordenados pelo valor do tema (maior primeiro). */
export function areasCriticas(ind: IndicadorTrafo[], tema: TemaId, n = 5): IndicadorTrafo[] {
  return [...ind].sort((x, y) => y[tema] - x[tema]).slice(0, n);
}

/** Áreas de risco simuladas: hexágono em torno do trafo de maior PNT de cada subestação. */
export function areasRisco(ses: Subestacao[]): { nome: string; poly: Coord[] }[] {
  return ses.flatMap((s) => {
    const top = areasCriticas(s.alimentadores.flatMap(indicadoresTrafos), "pnt", 1)[0];
    if (!top) return [];
    const r = 0.012;
    const poly = Array.from({ length: 6 }, (_, i) => [top.lat + r * Math.sin((i * Math.PI) / 3), top.lng + r * 1.15 * Math.cos((i * Math.PI) / 3)] as Coord);
    return [{ nome: `Área de risco — ${s.nome} (${top.nome})`, poly }];
  });
}
