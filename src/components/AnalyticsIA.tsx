import { useMemo, useState } from "react";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { useRede } from "@/lib/network-store";
import { indicadoresTrafos } from "@/lib/tematicos";
import { curvaCarga, curvaPR, eficaciaCampo, rankingAlvos, confirmado } from "@/lib/analytics";

const fmt = (n: number, d = 1) => n.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });

export function AnalyticsIA() {
  const { subestacoes } = useRede();
  const [se, setSe] = useState("todas");
  const [minScore, setMinScore] = useState(0.7);
  const [alim, setAlim] = useState("");

  const seDe = useMemo(() => {
    const m = new Map<string, string>();
    subestacoes.forEach((s) => s.alimentadores.forEach((a) => m.set(a.cod, s.nome)));
    return m;
  }, [subestacoes]);

  const filtradas = se === "todas" ? subestacoes : subestacoes.filter((s) => s.nome === se);
  const todos = useMemo(() => rankingAlvos(filtradas.flatMap((s) => s.alimentadores.flatMap(indicadoresTrafos)), 0), [filtradas]);
  const alvos = todos.filter((a) => a.score >= minScore);
  const pr = curvaPR(todos);
  const efic = eficaciaCampo(todos, (a) => seDe.get(a.alimentador) ?? "—");
  const inspecionados = todos.filter((a) => a.score >= 0.5);
  const assert = inspecionados.length ? inspecionados.filter(confirmado).length / inspecionados.length : 0;
  const recuperavel = alvos.reduce((s, a) => s + a.recuperavel, 0);

  const alimentadores = filtradas.flatMap((s) => s.alimentadores);
  const alimSel = alimentadores.find((a) => a.cod === alim) ?? alimentadores[0];
  const curva = alimSel ? curvaCarga(alimSel.cod, Math.max(1, alimSel.trafos.length * 0.3)) : [];
  const anomalias = curva.filter((c) => c.anomalia);

  const kpis = [
    ["Assertividade do modelo", `${fmt(assert * 100)}%`, "inspeções com score ≥ 0,5"],
    ["Energia recuperável", `${fmt(recuperavel)} MWh/mês`, `alvos com score ≥ ${fmt(minScore, 2)}`],
    ["Alvos priorizados", String(alvos.length), `de ${todos.length} transformadores`],
    ["Anomalias de carga (24 h)", String(anomalias.length), alimSel ? `alimentador ${alimSel.cod}` : "—"],
  ];

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center gap-4 p-3 text-sm">
        <label className="flex items-center gap-2">Subestação
          <select className="rounded border bg-background px-2 py-1" value={se} onChange={(e) => { setSe(e.target.value); setAlim(""); }}>
            <option value="todas">Todas</option>
            {subestacoes.map((s) => <option key={s.id} value={s.nome}>{s.nome}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">Score mínimo
          <input type="range" min={0.3} max={0.95} step={0.05} value={minScore} onChange={(e) => setMinScore(+e.target.value)} />
          <span className="font-mono">{fmt(minScore, 2)}</span>
        </label>
        <span className="text-xs text-muted-foreground">Algoritmos: XGBoost (scoring) · Isolation Forest (anomalias)</span>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map(([l, v, s]) => (
          <div key={l} className="panel p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="kpi mt-1">{v}</div><div className="text-xs text-muted-foreground">{s}</div></div>
        ))}
      </div>

      <div className="panel overflow-auto">
        <div className="panel-h">Matriz de Scoring de Fraude e PNT</div>
        <div className="max-h-[360px] overflow-auto">
          <table className="tbl">
            <thead><tr><th>Transformador</th><th>Alimentador</th><th>Subestação</th><th>Score</th><th>Tipologia</th><th>Ação recomendada</th><th>PNT (MWh)</th><th>Recuperável (MWh)</th></tr></thead>
            <tbody>{alvos.slice(0, 50).map((a) => (
              <tr key={a.id}>
                <td className="font-medium">{a.nome}</td><td>{a.alimentador}</td><td>{seDe.get(a.alimentador)}</td>
                <td><div className="flex items-center gap-2"><div className="h-1.5 w-16 rounded bg-muted"><div className={`h-1.5 rounded ${a.score >= 0.85 ? "bg-destructive" : "bg-warning"}`} style={{ width: `${a.score * 100}%` }} /></div><span className="font-mono">{fmt(a.score, 2)}</span></div></td>
                <td>{a.tipologia}</td><td>{a.acao}</td><td className="font-mono">{fmt(a.pnt)}</td><td className="font-mono">{fmt(a.recuperavel)}</td>
              </tr>
            ))}
            {!alvos.length && <tr><td colSpan={8} className="text-center text-muted-foreground">Nenhum alvo acima do score mínimo</td></tr>}</tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h flex items-center justify-between">Curva de Carga Prevista vs. Real e Bandas de Anomalia
          <select className="rounded border bg-background px-2 py-1 text-xs" value={alimSel?.cod ?? ""} onChange={(e) => setAlim(e.target.value)}>
            {alimentadores.map((a) => <option key={a.cod} value={a.cod}>{a.cod}</option>)}
          </select>
        </div>
        <div className="h-72 p-3">
          <ResponsiveContainer>
            <ComposedChart data={curva}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="h" fontSize={11} /><YAxis fontSize={11} unit=" MW" />
              <Tooltip formatter={(v) => (Array.isArray(v) ? v.map((x) => fmt(+x, 2)).join(" – ") : fmt(+(v as number), 2))} />
              <Legend />
              <Area dataKey="b3" name="Banda ±3σ" stroke="none" fill="var(--chart-4)" fillOpacity={0.12} />
              <Area dataKey="b2" name="Banda ±2σ" stroke="none" fill="var(--chart-1)" fillOpacity={0.2} />
              <Line dataKey="prev" name="Prevista" stroke="var(--chart-1)" dot={false} strokeDasharray="4 3" />
              <Line dataKey="real" name="Real" stroke="var(--chart-2)" dot={false} />
              <Scatter data={anomalias} dataKey="real" name="Anomalia" fill="var(--destructive)" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel">
          <div className="panel-h">Eficácia de Campo por Subestação</div>
          <div className="h-72 p-3">
            <ResponsiveContainer>
              <BarChart data={efic.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="grupo" fontSize={10} interval={0} angle={-25} textAnchor="end" height={60} /><YAxis fontSize={11} />
                <Tooltip formatter={(v) => fmt(+(v as number))} /><Legend />
                <Bar dataKey="inspecoes" name="Inspeções" fill="var(--chart-1)" />
                <Bar dataKey="confirmadas" name="Confirmadas" fill="var(--chart-2)" />
                <Bar dataKey="mwh" name="MWh recuperado" fill="var(--chart-3)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <div className="panel-h">Precisão e Recall por Limiar de Score</div>
          <div className="h-72 p-3">
            <ResponsiveContainer>
              <LineChart data={pr.map((p) => ({ ...p, precisao: p.precisao * 100, recall: p.recall * 100 }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="limiar" fontSize={11} /><YAxis fontSize={11} unit="%" domain={[0, 100]} />
                <Tooltip formatter={(v) => `${fmt(+(v as number))}%`} /><Legend />
                <Line dataKey="precisao" name="Precisão" stroke="var(--chart-1)" />
                <Line dataKey="recall" name="Recall" stroke="var(--chart-2)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
