import type { Achado } from "@/lib/metodologia";
import { useT } from "@/lib/i18n";

export function AchadosAuditoria({ achados }: { achados: Achado[] }) {
  const t = useT();
  const fmt = (v: number | null | undefined) => v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return <div className="panel min-w-0" data-sem-traducao>
    <div className="panel-h">{t("Indicadores de Críticas de Dados")} ({achados.length})</div>
    <div className="max-h-[560px] overflow-auto"><table className="tbl"><thead><tr>
      {["Elemento", "Regra", "Competência", "Descrição", "Valor medido", "Valor de referência", "Var. histórico", "Severidade"].map(h => <th key={h}>{t(h)}</th>)}
    </tr></thead><tbody>{achados.map((a, i) => <tr key={`${a.elementoId}:${a.regra}:${a.competencia}:${i}`}>
      <td>{a.elemento}</td><td>{t(a.regra)}</td><td className="whitespace-nowrap">{a.competencia?.slice(0, 7) ?? "—"}</td><td>{t(a.descricao)}</td>
      <td className="font-mono">{fmt(a.valorMedido)}</td><td className="font-mono">{fmt(a.valorReferencia)}</td><td className="font-mono">{a.variacaoHistorica == null ? "—" : `${fmt(a.variacaoHistorica)}%`}</td>
      <td><span className={`badge ${a.severidade === "Alta" ? "bg-destructive/15 text-destructive" : a.severidade === "Média" ? "bg-warning/25 text-accent-foreground" : "bg-muted text-muted-foreground"}`}>{t(a.severidade)}</span></td>
    </tr>)}{!achados.length && <tr><td colSpan={8}>{t("Nenhum achado para os dados disponíveis.")}</td></tr>}</tbody></table></div>
  </div>;
}