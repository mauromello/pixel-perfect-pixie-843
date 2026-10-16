import { Download, Printer, X } from "lucide-react";
import { aplicarMetodologia, balancoAlimentador, perdasPorNivel } from "@/lib/calculationEngine";
import { useRede } from "@/lib/network-store";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);

/** Relatório de Resultados do Balanço (Anexo II item 7) — dados do modelo de rede único. */
export function RelatorioBalanco({ onClose }: { onClose: () => void }) {
  const { subestacoes, metodologia, manobras, origemModelo } = useRede();
  const linhas = subestacoes.flatMap((s) => s.alimentadores.map((a) => {
    const b = balancoAlimentador(a);
    const m = aplicarMetodologia(b, metodologia, s.alvoPT, s.alvoPNT);
    const perdaPct = pct(b.lTotal, b.entradaLiquida);
    return { s, a, b, m, perdaPct, acima: perdaPct > s.alvoPT + s.alvoPNT };
  }));
  const tot = linhas.reduce((x, l) => ({ ent: x.ent + l.b.entradaLiquida, forn: x.forn + l.b.fornecida, pt: x.pt + l.m.pt, pnt: x.pnt + l.m.pnt }), { ent: 0, forn: 0, pt: 0, pnt: 0 });
  const criticos = [...linhas].sort((x, y) => y.perdaPct - x.perdaPct).slice(0, 3);
  const agora = new Date().toLocaleString("pt-BR");

  const csv = () => {
    const cab = "subestacao;alimentador;tensao_kv;entrada_mwh;fornecida_mwh;pt_mwh;pnt_mwh;perda_total_pct;meta_pct;situacao";
    const ls = linhas.map((l) => [l.s.nome, l.a.cod, l.a.tensaoKV, l.b.entradaLiquida.toFixed(2), l.b.fornecida.toFixed(2), l.m.pt.toFixed(2), l.m.pnt.toFixed(2), l.perdaPct.toFixed(2), (l.s.alvoPT + l.s.alvoPNT).toFixed(2), l.acima ? "ACIMA DA META" : "OK"].join(";"));
    const blob = new Blob(["\uFEFF" + [cab, ...ls].join("\n")], { type: "text/csv;charset=utf-8" });
    const el = document.createElement("a");
    el.href = URL.createObjectURL(blob);
    el.download = `relatorio_balanco_${new Date().toISOString().slice(0, 10)}.csv`;
    el.click();
    URL.revokeObjectURL(el.href);
  };

  return (
    <div className="fixed inset-0 z-[2000] overflow-auto bg-foreground/40 p-6 print:static print:bg-background print:p-0">
      <div id="relatorio" className="mx-auto max-w-5xl rounded-lg bg-card p-8 text-card-foreground shadow-xl print:max-w-none print:shadow-none">
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <h2 className="text-xl font-bold">Relatório de Resultados do Balanço Energético</h2>
            <p className="text-sm text-muted-foreground">Emitido em {agora} · Metodologia: {metodologia === "fisico" ? "A — Balanço físico (leituras reais)" : "B — Regulatória (metas PRORET)"} · Fonte: {origemModelo}</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button className="btn" onClick={csv}><Download size={14} /> CSV</button>
            <button className="btn-primary" onClick={() => window.print()}><Printer size={14} /> Imprimir / PDF</button>
            <button className="btn" onClick={onClose} aria-label="Fechar"><X size={14} /></button>
          </div>
        </div>

        <h3 className="mb-2 font-semibold">1. Sumário executivo</h3>
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[["Energia de entrada", fmt(tot.ent) + " MWh"], ["Energia fornecida", fmt(tot.forn) + " MWh"], [`Perdas técnicas (${pct(tot.pt, tot.ent).toFixed(2)}%)`, fmt(tot.pt) + " MWh"], [`Perdas não técnicas (${pct(tot.pnt, tot.ent).toFixed(2)}%)`, fmt(tot.pnt) + " MWh"]].map(([l, v]) => (
            <div key={l} className="rounded border border-border p-3"><div className="text-xs text-muted-foreground">{l}</div><div className="kpi">{v}</div></div>
          ))}
        </div>

        <h3 className="mb-2 font-semibold">2. Balanço por alimentador</h3>
        <table className="tbl mb-6">
          <thead><tr><th>Subestação</th><th>Alimentador</th><th>kV</th><th>Entrada</th><th>Fornecida</th><th>PT</th><th>PNT</th><th>Perda %</th><th>Meta %</th><th>Situação</th></tr></thead>
          <tbody>{linhas.map((l) => (
            <tr key={l.a.id}><td>{l.s.nome}</td><td className="font-mono">{l.a.cod}</td><td className="font-mono">{l.a.tensaoKV}</td><td className="font-mono">{fmt(l.b.entradaLiquida)}</td><td className="font-mono">{fmt(l.b.fornecida)}</td><td className="font-mono">{fmt(l.m.pt)}</td><td className="font-mono">{fmt(l.m.pnt)}</td><td className="font-mono font-semibold">{l.perdaPct.toFixed(2)}</td><td className="font-mono">{(l.s.alvoPT + l.s.alvoPNT).toFixed(2)}</td>
              <td>{l.acima ? <span className="badge bg-destructive/15 text-destructive">Acima da meta</span> : <span className="badge bg-success/15 text-success">Dentro</span>}</td></tr>
          ))}</tbody>
        </table>

        <h3 className="mb-2 font-semibold">3. Perdas técnicas por nível de tensão (MWh)</h3>
        <table className="tbl mb-6">
          <thead><tr><th>Subestação</th><th>AT</th><th>MT</th><th>BT</th><th>Total</th></tr></thead>
          <tbody>{subestacoes.map((s) => { const p = perdasPorNivel(s); return <tr key={s.id}><td>{s.nome}</td><td className="font-mono">{fmt(p.at)}</td><td className="font-mono">{fmt(p.mt)}</td><td className="font-mono">{fmt(p.bt)}</td><td className="font-mono font-semibold">{fmt(p.total)}</td></tr>; })}</tbody>
        </table>

        <h3 className="mb-2 font-semibold">4. Pontos críticos e recomendações</h3>
        <ul className="mb-6 list-disc space-y-1 pl-6 text-sm">
          {criticos.map((l) => <li key={l.a.id}><b>{l.a.cod}</b> ({l.s.nome}): perda de {l.perdaPct.toFixed(2)}% — {l.acima ? "priorizar inspeção de PNT e revisão de medição de fronteira." : "monitorar tendência."}</li>)}
        </ul>

        <h3 className="mb-2 font-semibold">5. Manobras consideradas</h3>
        <p className="text-sm">{manobras.length === 0 ? "Rede em estado normal de operação (nenhuma manobra ativa)." : `${manobras.length} manobra(s) ativa(s) refletida(s) na topologia deste balanço.`}</p>
      </div>
    </div>
  );
}
