import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/AppShell";
import { elementosProjecao, hash } from "@/lib/mock-data";

export const Route = createFileRoute("/projecao")({
  head: () => ({
    meta: [
      { title: "Projeção e Simulação de Perdas — PerdaZero" },
      { name: "description", content: "Análise de sensibilidade e projeção automatizada de perdas em 3, 6, 12 e 24 meses." },
      { property: "og:title", content: "Projeção e Simulação de Perdas — PerdaZero" },
      { property: "og:description", content: "Simule cenários e projete perdas por SE, alimentador ou distribuidora." },
    ],
  }),
  component: ProjecaoPage,
});

type Sim = { id: number; data: string; elemento: string; horizonte: number; consumo: number; infra: number; fiscal: number; final: number };

function ProjecaoPage() {
  const [elemento, setElemento] = useState<string>(elementosProjecao[0]!);
  const [horizonte, setHorizonte] = useState(12);
  const [consumo, setConsumo] = useState(3);
  const [infra, setInfra] = useState(0);
  const [fiscal, setFiscal] = useState(10);
  const [hist, setHist] = useState<Sim[]>([]);

  const dados = useMemo(() => {
    const h = hash(elemento);
    const base = 12 + (h % 50) / 10;
    const out: { mes: string; historico?: number; projecao?: number; cenario?: number }[] = [];
    for (let i = -12; i <= horizonte; i++) {
      const d = new Date(2026, 9 + i, 1);
      const mes = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const saz = Math.sin((i + h) / 2) * 0.6;
      if (i <= 0) out.push({ mes, historico: +(base + saz - i * 0.03).toFixed(2), ...(i === 0 ? { projecao: +(base + saz).toFixed(2), cenario: +(base + saz).toFixed(2) } : {}) });
      else {
        const tend = base + saz + i * 0.04;
        const cen = tend * (1 + (consumo / 100) * 0.4) - (infra / 100) * i * 0.08 - (fiscal / 100) * i * 0.05;
        out.push({ mes, projecao: +tend.toFixed(2), cenario: +Math.max(cen, 0).toFixed(2) });
      }
    }
    return out;
  }, [elemento, horizonte, consumo, infra, fiscal]);
  const final = dados[dados.length - 1]?.cenario ?? 0;

  const Slider = ({ l, v, set, min, max }: { l: string; v: number; set: (n: number) => void; min: number; max: number }) => (
    <div>
      <div className="flex justify-between text-xs"><span className="text-muted-foreground">{l}</span><span className="font-mono">{v}%</span></div>
      <input type="range" className="w-full accent-[var(--primary)]" min={min} max={max} value={v} onChange={(e) => set(Number(e.target.value))} />
    </div>
  );

  return (
    <div>
      <PageHeader title="Projeção Automatizada de Perdas e Simulação" subtitle="Análise de Sensibilidade e Simulação de Cenários">
        <button className="btn-primary" onClick={() => setHist([{ id: Date.now(), data: new Date().toLocaleString("pt-BR"), elemento, horizonte, consumo, infra, fiscal, final }, ...hist])}>
          <Save size={14} /> Salvar Simulação
        </button>
      </PageHeader>
      <div className="grid gap-4 p-6 lg:grid-cols-[300px_1fr]">
        <div className="panel">
          <div className="panel-h">Insumos da Simulação</div>
          <div className="space-y-4 p-4">
            <div>
              <label className="text-xs text-muted-foreground">Visualização</label>
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
            <Slider l="Variação de consumo" v={consumo} set={setConsumo} min={-20} max={20} />
            <Slider l="Investimento em infraestrutura (recondutoramento, trafos)" v={infra} set={setInfra} min={0} max={100} />
            <Slider l="Intensidade de fiscalização (inspeções)" v={fiscal} set={setFiscal} min={0} max={100} />
            <div className="rounded bg-muted p-3">
              <div className="text-xs text-muted-foreground">Perda total projetada em {horizonte} meses</div>
              <div className="kpi">{final.toFixed(2)}%</div>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="panel">
            <div className="panel-h">Histórico e Projeção de Perdas (%) — {elemento}</div>
            <div className="h-80 p-3">
              <ResponsiveContainer>
                <LineChart data={dados}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="mes" fontSize={11} />
                  <YAxis fontSize={11} domain={["auto", "auto"]} />
                  <Tooltip />
                  <Legend />
                  <Line dataKey="historico" name="Histórico" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                  <Line dataKey="projecao" name="Projeção tendencial" stroke="var(--chart-5)" strokeDasharray="5 4" dot={false} />
                  <Line dataKey="cenario" name="Cenário simulado" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="panel overflow-auto">
            <div className="panel-h">Histórico de Simulações Salvas</div>
            <table className="tbl">
              <thead><tr><th>Data</th><th>Elemento</th><th>Horizonte</th><th>Consumo</th><th>Infra</th><th>Fiscalização</th><th>Perda final</th></tr></thead>
              <tbody>
                {hist.length === 0 && <tr><td colSpan={7} className="text-center text-muted-foreground">Nenhuma simulação salva ainda.</td></tr>}
                {hist.map((s) => (
                  <tr key={s.id}><td>{s.data}</td><td>{s.elemento}</td><td>{s.horizonte}m</td><td className="font-mono">{s.consumo}%</td><td className="font-mono">{s.infra}%</td><td className="font-mono">{s.fiscal}%</td><td className="font-mono font-semibold">{s.final.toFixed(2)}%</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
