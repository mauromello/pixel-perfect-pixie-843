import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { PageHeader } from "@/components/AppShell";
import { fontesDados } from "@/lib/mock-data";

export const Route = createFileRoute("/ia")({
  head: () => ({
    meta: [
      { title: "IA, ML e Data Lake — PerdaZero" },
      { name: "description", content: "Saúde dos dados e algoritmos: fontes integradas, performance do repositório e logs do motor de IA." },
      { property: "og:title", content: "IA, ML e Data Lake — PerdaZero" },
      { property: "og:description", content: "Monitoramento de integração de dados e do motor de inteligência artificial." },
    ],
  }),
  component: IaPage,
});

const eventos = [
  ["Detecção de Anomalias", "Balanço", "Desvio de 3,2σ no AL-02 Barão — inspeção sugerida"],
  ["Otimização de Processos", "Projeção", "Modelo XGBoost re-treinado — MAPE 4,1% → 3,6%"],
  ["Detecção de Anomalias", "Mapas", "Cluster de PNT identificado em Campinas (14 UCs)"],
  ["Otimização de Processos", "Balanço", "Imputação automática de 4h de curva SCADA na SE Taquaral"],
  ["Detecção de Anomalias", "Medição", "MD-88013 com padrão de consumo compatível com by-pass"],
  ["Otimização de Processos", "Data Lake", "Particionamento ajustado — consultas 28% mais rápidas"],
  ["Detecção de Anomalias", "GD/GC", "Injeção GD acima da potência instalada em UC 3002"],
];

const spark = (s: number) => Array.from({ length: 20 }, (_, i) => ({ v: 50 + Math.sin(i / 2 + s) * 20 + ((i * s) % 10) }));

function IaPage() {
  const [logs, setLogs] = useState<{ t: string; e: string[] }[]>([]);
  useEffect(() => {
    const add = () => setLogs((l) => [{ t: new Date().toLocaleTimeString("pt-BR"), e: eventos[Math.floor(Math.random() * eventos.length)] }, ...l].slice(0, 30));
    add(); add(); add();
    const id = setInterval(add, 2500);
    return () => clearInterval(id);
  }, []);

  const cards = [
    ["Armazenamento utilizado", "8,1 TB", "de 20 TB (40%)", 1],
    ["Ingestão / hora", "1,9 M reg.", "+12% vs. média", 2],
    ["Latência média de consulta", "142 ms", "P95: 380 ms", 3],
    ["Nós de processamento", "12 / 16", "auto-escala ativa", 4],
  ] as const;

  return (
    <div>
      <PageHeader title="Saúde dos Dados e Algoritmos" subtitle="Módulo de IA, ML e Data Lake — status de integração" />
      <div className="space-y-4 p-6">
        <h2 className="text-sm font-semibold text-muted-foreground">Escalabilidade e Performance do Repositório Único</h2>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {cards.map(([l, v, s, k]) => (
            <div key={l} className="panel p-4">
              <div className="text-xs text-muted-foreground">{l}</div>
              <div className="kpi mt-1">{v}</div>
              <div className="text-xs text-muted-foreground">{s}</div>
              <div className="mt-2 h-10">
                <ResponsiveContainer><AreaChart data={spark(k)}><Area dataKey="v" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.15} /></AreaChart></ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1fr_440px]">
          <div className="panel overflow-auto">
            <div className="panel-h">Fontes de Dados Integradas</div>
            <table className="tbl">
              <thead><tr><th>Categoria</th><th>Origem</th><th>Status</th><th>Volume processado</th><th>Latência</th></tr></thead>
              <tbody>{fontesDados.map((f) => (
                <tr key={f.cat}><td className="font-medium">{f.cat}</td><td>{f.origem}</td>
                  <td><span className={`badge ${f.status === "Online" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>● {f.status}</span></td>
                  <td className="font-mono">{f.volume}</td><td className="font-mono">{f.latencia}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <div className="panel flex max-h-[460px] flex-col">
            <div className="panel-h">Logs do Motor de IA <span className="badge bg-success/15 text-success">ao vivo</span></div>
            <div className="flex-1 overflow-auto bg-sidebar p-3 font-mono text-xs text-sidebar-foreground">
              {logs.map((l, i) => (
                <div key={i} className="border-b border-sidebar-border py-1.5">
                  <span className="opacity-60">{l.t}</span>{" "}
                  <span className={l.e[0].startsWith("Detecção") ? "text-sidebar-primary" : "text-success"}>[{l.e[0]}]</span>{" "}
                  <span className="opacity-80">→ {l.e[1]}:</span> {l.e[2]}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
