import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/AppShell";
import { Manobras } from "@/components/Manobras";
import { PainelBalancoFisico } from "@/components/BalancoFisico";
import { PerdasNiveis } from "@/components/PerdasNiveis";
import { RelatorioBalanco } from "@/components/RelatorioBalanco";
import { arvore, balanco, criticas, fontesBalanco, type Node } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Balanço Energético e Manobras — PerdaZero" },
      { name: "description", content: "Cálculo e gestão do balanço energético por elemento da rede de distribuição." },
      { property: "og:title", content: "Balanço Energético e Manobras — PerdaZero" },
      { property: "og:description", content: "Balanço energético e simulação de manobras na rede de Minas Gerais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BalancoPage,
});

const fmt = (n: number) => n.toLocaleString("pt-BR");

function Tree({ node, sel, onSel, depth = 0 }: { node: Node; sel: string; onSel: (n: Node) => void; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);
  const has = !!node.filhos?.length;
  return (
    <div>
      <div
        className={`flex cursor-pointer items-center gap-1 rounded px-1 py-1 text-sm hover:bg-muted ${sel === node.id ? "bg-secondary font-semibold text-primary" : ""}`}
        style={{ paddingLeft: depth * 12 + 4 }}
        onClick={() => onSel(node)}
      >
        <button className="w-4" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
          {has ? open ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : null}
        </button>
        <span className="truncate">{node.nome}</span>
        <span className="ml-auto text-[10px] uppercase text-muted-foreground">{node.tipo}</span>
      </div>
      {open && node.filhos?.map((f) => <Tree key={f.id} node={f} sel={sel} onSel={onSel} depth={depth + 1} />)}
    </div>
  );
}

const sevCls: Record<string, string> = {
  Crítica: "bg-destructive text-destructive-foreground",
  Alta: "bg-destructive/15 text-destructive",
  Média: "bg-warning/25 text-accent-foreground",
  Baixa: "bg-muted text-muted-foreground",
};

function BalancoPage() {
  const [sel, setSel] = useState<Node>(arvore);
  const [ptManual, setPtManual] = useState("");
  const [msg, setMsg] = useState("");
  const [rel, setRel] = useState(false);
  const [linhas, setLinhas] = useState(fontesBalanco);
  const b = balanco(sel.id);
  const ptPct = ptManual ? Number(ptManual) : b.ptPct;
  const pt = Math.round((b.injetada * ptPct) / 100);
  const pnt = b.injetada - b.faturada - pt;

  return (
    <div>
      <PageHeader title="Cálculo e Gestão do Balanço Energético" subtitle="Controle de medições: Regional → Município → SE → Alimentador → Religador → Trafo → Medidor → Instalação">
        <button className="btn-primary" onClick={() => setRel(true)}>
          <FileText size={14} /> Gerar Relatório de Resultados
        </button>
      </PageHeader>
      {rel && <RelatorioBalanco onClose={() => setRel(false)} />}
      {msg && <div className="mx-6 mt-4 rounded border border-success/40 bg-success/10 px-3 py-2 text-sm">{msg}</div>}
      <div className="grid gap-4 p-6 lg:grid-cols-[300px_1fr]">
        <div className="panel max-h-[640px] overflow-auto">
          <div className="panel-h">Controle de Medições</div>
          <div className="p-2"><Tree node={arvore} sel={sel.id} onSel={setSel} /></div>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              ["Energia Injetada", fmt(b.injetada) + " MWh"],
              ["Energia Faturada", fmt(b.faturada) + " MWh"],
              [`Perdas Técnicas (${ptPct.toFixed(1)}%)`, fmt(pt) + " MWh"],
              [`Perdas Não Técnicas (${((pnt / b.injetada) * 100).toFixed(1)}%)`, fmt(pnt) + " MWh"],
            ].map(([l, v]) => (
              <div key={l} className="panel p-4">
                <div className="text-xs text-muted-foreground">{l}</div>
                <div className="kpi mt-1">{v}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
            <div className="panel">
              <div className="panel-h">Balanço {sel.id === "root" ? "Global" : "Individualizado"} — {sel.nome}<span className="text-xs font-normal text-muted-foreground">{sel.tipo}</span></div>
              <div className="h-64 p-3">
                <ResponsiveContainer>
                  <BarChart data={b.serie}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="mes" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="injetada" name="Injetada" fill="var(--chart-1)" />
                    <Bar dataKey="perdas" name="Perdas" fill="var(--chart-2)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="panel">
              <div className="panel-h">Metodologia e Cálculo</div>
              <div className="space-y-2 p-4">
                <button className="btn w-full justify-center" onClick={() => setMsg("Balanço calculado segundo metodologia análoga ao IPTD/Regulatório (PRODIST Módulo 7).")}>Calcular Balanço Análogo ao IPTD/Regulatório</button>
                <button className="btn w-full justify-center" onClick={() => setMsg(`Área de sub-balanço definida a partir de "${sel.nome}".`)}>Definir Áreas de Sub-balanço</button>
                <label className="block pt-2 text-xs text-muted-foreground">Inserir % de Perdas Técnicas</label>
                <div className="flex gap-2">
                  <input className="inp w-full" type="number" step="0.1" placeholder={b.ptPct.toFixed(1)} value={ptManual} onChange={(e) => setPtManual(e.target.value)} />
                  <button className="btn-primary whitespace-nowrap" onClick={() => { setPtManual(""); setMsg("Motor de cálculo de perdas técnicas acionado (fluxo de potência)."); }}>Acionar Motor</button>
                </div>
              </div>
            </div>
          </div>

          <PainelBalancoFisico />

          <PerdasNiveis />

          <Manobras />

          <div className="panel overflow-auto">
            <div className="panel-h">Indicadores de Críticas de Dados</div>
            <table className="tbl">
              <thead><tr><th>Elemento</th><th>Tipo</th><th>Descrição</th><th>Var. histórico</th><th>Severidade</th></tr></thead>
              <tbody>{criticas.map((c) => (
                <tr key={c.id}><td>{c.elemento}</td><td>{c.tipo}</td><td>{c.descricao}</td><td className="font-mono">{c.variacao}</td><td><span className={`badge ${sevCls[c.severidade]}`}>{c.severidade}</span></td></tr>
              ))}</tbody>
            </table>
          </div>

          <div className="panel overflow-auto">
            <div className="panel-h">Alterar Dados de Origem</div>
            <table className="tbl">
              <thead><tr><th>Elemento</th><th>Sistema</th><th>Injetada (MWh)</th><th>Faturada (MWh)</th><th>Status</th><th></th></tr></thead>
              <tbody>{linhas.map((l, i) => {
                const upd = (patch: Partial<typeof l>) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <tr key={l.id} className={l.confiavel ? "" : "bg-destructive/5"}>
                    <td>{l.elemento}</td><td>{l.sistema}</td>
                    <td><input className="inp w-28 font-mono" type="number" value={l.injetada} onChange={(e) => upd({ injetada: Number(e.target.value) })} /></td>
                    <td><input className="inp w-28 font-mono" type="number" value={l.faturada} onChange={(e) => upd({ faturada: Number(e.target.value) })} /></td>
                    <td>{l.confiavel ? <span className="badge bg-success/15 text-success">Confiável</span> : <span className="badge bg-destructive/15 text-destructive">Não-confiável</span>}</td>
                    <td><button className="btn text-xs" onClick={() => upd({ confiavel: !l.confiavel })}>{l.confiavel ? "Marcar balanço como não-confiável" : "Marcar como confiável"}</button></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
