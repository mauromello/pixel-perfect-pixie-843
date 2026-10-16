import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Save } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/AppShell";
import { useT } from "@/lib/i18n";
import { elementosProjecao, hash } from "@/lib/mock-data";
import { projetarMes, sensibilidade, type Params } from "@/lib/sensibilidade";

export const Route = createFileRoute("/_authenticated/projecao")({
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

function Slider({ l, v, set, min, max, u }: { l: string; v: number; set: (n: number) => void; min: number; max: number; u: string }) {
  const t = useT();
  return (
    <div>
      <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t(l)}</span><span className="font-mono">{v} {u}</span></div>
      <input type="range" className="w-full accent-[var(--primary)]" min={min} max={max} value={v} onChange={(e) => set(Number(e.target.value))} />
    </div>
  );
}

function ProjecaoPage() {
  const [elemento, setElemento] = useState<string>(elementosProjecao[0]!);
  const [horizonte, setHorizonte] = useState(12);
  const [consumo, setConsumo] = useState(3);
  const [gd, setGd] = useState(80);
  const [gc, setGc] = useState(0);
  const [fiscal, setFiscal] = useState(10);
  const [temperatura, setTemperatura] = useState(0);
  const [tarifa, setTarifa] = useState(0);
  const [pib, setPib] = useState(0);
  const [hist, setHist] = useState<Sim[]>([]);
  const t = useT();

  const h = hash(elemento);
  const params: Params = { basePt: 6.5 + (h % 25) / 10, basePnt: 4 + (h % 60) / 10, horizonte, consumo, gd, gc, fiscal, temperatura, tarifa, pib };
  const dados = useMemo(() => {
    const out: Record<string, string | number>[] = [];
    for (let i = -12; i <= horizonte; i++) {
      const mes = new Date(2026, 9 + i, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const saz = Math.sin((i + h) / 2) * 0.3;
      if (i <= 0) {
        const pt = +(params.basePt + saz).toFixed(2), pnt = +(params.basePnt + saz * 1.5 - i * 0.02).toFixed(2);
        out.push({ mes, ptHist: pt, pntHist: pnt, ...(i === 0 ? { ptProj: pt, pntProj: pnt } : {}) });
      } else {
        const r = projetarMes(params, i);
        out.push({ mes, ptProj: +Math.max(r.pt + saz, 0).toFixed(2), pntProj: +Math.max(r.pnt + saz * 1.5, 0).toFixed(2) });
      }
    }
    return out;
  }, [elemento, horizonte, consumo, gd, gc, fiscal, temperatura, tarifa, pib]); // eslint-disable-line react-hooks/exhaustive-deps
  const sens = useMemo(() => sensibilidade(params), [elemento, horizonte, consumo, gd, gc, fiscal, temperatura, tarifa, pib]); // eslint-disable-line react-hooks/exhaustive-deps
  const ult = dados[dados.length - 1]!;
  const ptF = Number(ult["ptProj"] ?? 0), pntF = Number(ult["pntProj"] ?? 0);

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
            <Slider l="Entrada de Geração Convencional (GC)" v={gc} set={setGc} min={0} max={300} u="MW" />
            <Slider l="Intensidade de fiscalização" v={fiscal} set={setFiscal} min={0} max={100} u="%" />
            <Slider l="Variação de temperatura média" v={temperatura} set={setTemperatura} min={-5} max={5} u="°C" />
            <Slider l="Reajuste tarifário" v={tarifa} set={setTarifa} min={-10} max={30} u="%" />
            <Slider l="Variação do PIB regional" v={pib} set={setPib} min={-5} max={5} u="%" />
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
          <div className="panel">
            <div className="panel-h">Análise de Sensibilidade — impacto nas perdas em {horizonte}m (p.p.)</div>
            <div className="grid gap-4 p-3 xl:grid-cols-[1fr_1fr]">
              <div className="h-72">
                <ResponsiveContainer>
                  <BarChart data={sens.map((s) => ({ nome: t(s.nome), menos: +(s.ptMenos + s.pntMenos).toFixed(3), mais: +(s.ptMais + s.pntMais).toFixed(3) }))} layout="vertical" stackOffset="sign">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" fontSize={11} />
                    <YAxis type="category" dataKey="nome" width={130} fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <ReferenceLine x={0} stroke="var(--foreground)" />
                    <Bar dataKey="menos" name={t("Variável −Δ")} fill="var(--chart-1)" stackId="s" />
                    <Bar dataKey="mais" name={t("Variável +Δ")} fill="var(--chart-2)" stackId="s" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="tbl">
                <thead><tr><th>Variável</th><th>Δ</th><th>PT −/+</th><th>PNT −/+</th></tr></thead>
                <tbody>{sens.map((s) => (
                  <tr key={s.nome}><td>{t(s.nome)}</td><td className="font-mono text-xs">{s.delta}</td><td className="font-mono text-xs">{s.ptMenos.toFixed(2)} / {s.ptMais.toFixed(2)}</td><td className="font-mono text-xs">{s.pntMenos.toFixed(2)} / {s.pntMais.toFixed(2)}</td></tr>
                ))}</tbody>
              </table>
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
