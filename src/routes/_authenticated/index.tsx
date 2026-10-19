import { Link, createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/AppShell";
import { PainelBalancoFisico } from "@/components/BalancoFisico";
import { PerdasNiveis } from "@/components/PerdasNiveis";
import { RelatorioBalanco } from "@/components/RelatorioBalanco";
import { balanco, fontesBalanco } from "@/lib/mock-data";
import { useRede } from "@/lib/network-store";
import { arvoreRede, encontrarNo, idsNo, type NoRede as Node } from "@/lib/historico";
import { auditar } from "@/lib/metodologia";
import { historicoQuery, parametrosCriticasQuery } from "@/lib/auditoriaDados";
import { AchadosAuditoria } from "@/components/AchadosAuditoria";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Balanço Energético — PerdaZero" },
      { name: "description", content: "Cálculo e gestão do balanço energético por elemento da rede de distribuição." },
      { property: "og:title", content: "Balanço Energético — PerdaZero" },
      { property: "og:description", content: "Balanço energético por elemento da rede de Minas Gerais." },
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

const auth = getRouteApi("/_authenticated");

function BalancoPage() {
  const { sessao } = auth.useRouteContext();
  const ses = useRede(s => s.subestacoes);
  const chaves = useRede(s => s.chaves);
  const arvore = useMemo(() => arvoreRede(ses, chaves), [ses, chaves]);
  const [sel, setSel] = useState<Node>(arvore);
  const selecionado = encontrarNo(arvore, sel.id) ?? arvore;
  const historico = useQuery(historicoQuery(sessao.id, "2026-09-01"));
  const parametros = useQuery(parametrosCriticasQuery(sessao.id));
  const achados = useMemo(() => {
    const ids = new Set(idsNo(selecionado));
    return auditar(ses, { serie: historico.data ?? [], competencia: "2026-09-01", parametros: parametros.data ?? [], historicoDisponivel: historico.isSuccess }).filter(a => selecionado.id === "root" || (a.elementoId && ids.has(a.elementoId)));
  }, [ses, selecionado, historico.data, historico.isSuccess, parametros.data]);
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
              <div className="space-y-2 p-4 text-sm">
                <p className="text-muted-foreground">Motores de perdas, sub-balanços geoelétricos, gap regulatório e auditoria de medições.</p>
                <Link to="/metodologia" className="btn-primary w-full justify-center">Abrir módulo de Metodologia</Link>
              </div>
            </div>
          </div>

          <PainelBalancoFisico />

          <PerdasNiveis />


          <p className="text-xs text-muted-foreground">Dados de demonstração — série mensal fictícia e limiares ilustrativos, não homologados pela CEMIG. Competência: 2026-09.</p>
          {(historico.isPending || parametros.isPending) && <p role="status">Carregando série histórica…</p>}
          {(historico.isError || parametros.isError) && <p role="alert" className="text-destructive">Não foi possível carregar histórico ou parâmetros; regras dependentes não foram executadas.</p>}
          <AchadosAuditoria achados={achados} />

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
