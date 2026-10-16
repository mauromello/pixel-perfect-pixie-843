import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Save } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/AppShell";
import { elementosProjecao, hash } from "@/lib/mock-data";

export const Route = createFileRoute("/projecao")({
  head: () => ({
    meta: [
      { title: "Projeção e Simulação de Perdas — PerdaZero" },
      { name: "description", content: "Projeção de perdas técnicas e não técnicas das regionais de Minas Gerais com simulação de GD e GC." },
      { property: "og:title", content: "Projeção e Simulação de Perdas — PerdaZero" },
      { property: "og:description", content: "Simule cenários de PT e PNT em 3, 6, 12 e 24 meses para Minas Gerais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjecaoPage,
});

type Sim = { id: number; data: string; elemento: string; horizonte: number; consumo: number; gd: number; gc: number; fiscal: number; pt: number; pnt: number };

function ProjecaoPage() {
  const [elemento, setElemento] = useState<string>(elementosProjecao[0]!);
  const [horizonte, setHorizonte] = useState(12);
  const [consumo, setConsumo] = useState(3);
  const [gd, setGd] = useState(80);
  const [gc, setGc] = useState(0);
  const [fiscal, setFiscal] = useState(10);
  const [hist, setHist] = useState<Sim[]>([]);

  const dados = useMemo(() => {
    const h = hash(elemento);
    const basePt = 6.5 + (h % 25) / 10;
    const basePnt = 4 + (h % 60) / 10;
    const out: Record<string, string | number>[] = [];
    for (let i = -12; i <= horizonte; i++) {
      const mes = new Date(2026, 9 + i, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const saz = Math.sin((i + h) / 2) * 0.3;
      if (i <= 0) {
        const pt = +(basePt + saz).toFixed(2), pnt = +(basePnt + saz * 1.5 - i * 0.02).toFixed(2);
        out.push({ mes, ptHist: pt, pntHist: pnt, ...(i === 0 ? { ptProj: pt, pntProj: pnt } : {}) });
      } else {
        const f = i / 24;
        // GD (MW) reduz PT até ~150 MW e passa a elevar com fluxo reverso; GC conectada em AT reduz carregamento
        const efGd = gd <= 150 ? -gd * 0.004 : -0.6 + (gd - 150) * 0.006;
        const pt = basePt + saz + consumo * 0.03 * f * 2 + efGd * f * 2 - gc * 0.002 * f * 2;
        const pnt = basePnt + saz * 1.5 + i * 0.03 + consumo * 0.02 * f - (fiscal / 100) * i * 0.12;
        out.push({ mes, ptProj: +Math.max(pt, 0).toFixed(2), pntProj: +Math.max(pnt, 0).toFixed(2) });
      }
    }
    return out;
  }, [elemento, horizonte, consumo, gd, gc, fiscal]);
  const ult = dados[dados.length - 1]!;
  const ptF = Number(ult.ptProj ?? 0), pntF = Number(ult.pntProj ?? 0);

  const exportar = (lista: Sim[]) => {
    const cab = "data;elemento;horizonte_meses;variacao_consumo_pct;gd_mw;gc_mw;fiscalizacao_pct;pt_final_pct;pnt_final_pct";
    const linhas = lista.map((s) => [s.data, s.elemento, s.horizonte, s.consumo, s.gd, s.gc, s.fiscal, s.pt.toFixed(2), s.pnt.toFixed(2)].join(";"));
    const blob = new Blob(["\uFEFF" + [cab, ...linhas].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `simulacoes_perdas_mg_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const salvar = () => {
    const nova = [{ id: Date.now(), data: new Date().toLocaleString("pt-BR"), elemento, horizonte, consumo, gd, gc, fiscal, pt: ptF, pnt: pntF }, ...hist];
    setHist(nova);
    exportar(nova);
  };

  const Slider = ({ l, v, set, min, max, u }: { l: string; v: number; set: (n: number) => void; min: number; max: number; u: string }) => (
    <div>
      <div className="flex justify-between text-xs"><span className="text-muted-foreground">{l}</span><span className="font-mono">{v} {u}</span></div>
      <input type="range" className="w-full accent-[var(--primary)]" min={min} max={max} value={v} onChange={(e) => set(Number(e.target.value))} />
    </div>
  );

  return (
    <div>
      <PageHeader title="Projeção Automatizada de Perdas e Simulação" subtitle="Análise de Sensibilidade e Simulação de Cenários — Minas Gerais">
        <button className="btn-primary" onClick={salvar}><Save size={14} /> Salvar e Exportar Simulação (.CSV)</button>
      </PageHeader>
      <div className="grid gap-4 p-6 lg:grid-cols-[300px_1fr]">
        <div className="panel">
          <div className="panel-h">Parâmetros do Cenário</div>
          <div className="space-y-4 p-4">
            <div>
              <label className="text-xs text-muted-foreground">Regional</label>
              <select className="inp mt-1 w-full" value={elemento} onChange={(e) => setElemento(e.target.value)}>
                {elementosProjecao.map((e) => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Horizonte</label>
              <div className="mt-1 grid grid-cols-4 gap-1">
                {[3, 6, 12, 24].map((m) => (
                  <button key={m} className={m === horizonte ? "btn-primary justify-center" : "btn justify-center"} onClick={() => setHorizonte(m)}>{m}m</button>
                ))}
              </div>
            </div>
            <Slider l="Variação de consumo" v={consumo} set={setConsumo} min={-20} max={20} u="%" />
            <Slider l="Entrada de Geração Distribuída (GD)" v={gd} set={setGd} min={0} max={400} u="MW" />
            <Slider l="Entrada de Geração Centralizada (GC)" v={gc} set={setGc} min={0} max={300} u="MW" />
            <Slider l="Intensidade de fiscalização" v={fiscal} set={setFiscal} min={0} max={100} u="%" />
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded bg-muted p-3"><div className="text-xs text-muted-foreground">PT em {horizonte}m</div><div className="kpi">{ptF.toFixed(2)}%</div></div>
              <div className="rounded bg-muted p-3"><div className="text-xs text-muted-foreground">PNT em {horizonte}m</div><div className="kpi">{pntF.toFixed(2)}%</div></div>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="panel">
            <div className="panel-h">Histórico vs. Projeção — PT e PNT (%) — {elemento}</div>
            <div className="h-80 p-3">
              <ResponsiveContainer>
                <LineChart data={dados}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="mes" fontSize={11} />
                  <YAxis fontSize={11} domain={["auto", "auto"]} />
                  <Tooltip />
                  <Legend />
                  <Line dataKey="ptHist" name="PT histórico" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                  <Line dataKey="ptProj" name="PT projeção" stroke="var(--chart-1)" strokeDasharray="5 4" strokeWidth={2} dot={false} />
                  <Line dataKey="pntHist" name="PNT histórico" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                  <Line dataKey="pntProj" name="PNT projeção" stroke="var(--chart-2)" strokeDasharray="5 4" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="panel overflow-auto">
            <div className="panel-h">Histórico de Parâmetros das Simulações{hist.length > 0 && <button className="btn text-xs" onClick={() => exportar(hist)}><Download size={12} /> Exportar tudo</button>}</div>
            <table className="tbl">
              <thead><tr><th>Data</th><th>Regional</th><th>Horizonte</th><th>Consumo</th><th>GD</th><th>GC</th><th>Fiscalização</th><th>PT final</th><th>PNT final</th></tr></thead>
              <tbody>
                {hist.length === 0 && <tr><td colSpan={9} className="text-center text-muted-foreground">Nenhuma simulação salva ainda.</td></tr>}
                {hist.map((s) => (
                  <tr key={s.id}><td>{s.data}</td><td>{s.elemento}</td><td>{s.horizonte}m</td><td className="font-mono">{s.consumo}%</td><td className="font-mono">{s.gd} MW</td><td className="font-mono">{s.gc} MW</td><td className="font-mono">{s.fiscal}%</td><td className="font-mono font-semibold">{s.pt.toFixed(2)}%</td><td className="font-mono font-semibold">{s.pnt.toFixed(2)}%</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
