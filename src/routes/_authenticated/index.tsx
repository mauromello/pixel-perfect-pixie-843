import { Link, createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/AppShell";
import { PainelBalancoFisico } from "@/components/BalancoFisico";
import { PerdasNiveis } from "@/components/PerdasNiveis";
import { RelatorioBalanco } from "@/components/RelatorioBalanco";
import { fontesBalanco } from "@/lib/mock-data";
import { balancoNo, serieBalancoNo } from "@/lib/calculationEngine";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { useRede } from "@/lib/network-store";
import { arvoreRede, encontrarNo, idsNo, mesesAnteriores, type NoRede as Node } from "@/lib/historico";
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

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

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
        <Button variant="ghost" className="h-5 w-5 shrink-0 p-0" aria-label={`${open ? "Recolher" : "Expandir"} ${node.nome}`} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
          {has ? open ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : null}
        </Button>
        <span className="truncate">{node.nome}</span>
        <span className="ml-auto text-[10px] uppercase text-muted-foreground">{node.tipo}</span>
      </div>
      {open && node.filhos?.map((f) => <Tree key={f.id} node={f} sel={sel} onSel={onSel} depth={depth + 1} />)}
    </div>
  );
}

const auth = getRouteApi("/_authenticated");

function BalancoPage() {
  const t = useT();
  const { sessao } = auth.useRouteContext();
  const ses = useRede(s => s.subestacoes);
  const chaves = useRede(s => s.chaves);
  const metodologia = useRede(s => s.metodologia);
  const arvore = useMemo(() => arvoreRede(ses, chaves), [ses, chaves]);
  const [sel, setSel] = useState<Node>(arvore);
  const selecionado = encontrarNo(arvore, sel.id) ?? arvore;
  const historico = useQuery(historicoQuery(sessao.id, "2026-09-01"));
  const parametros = useQuery(parametrosCriticasQuery(sessao.id));
  const achados = useMemo(() => {
    const ids = new Set(idsNo(selecionado));
    return auditar(ses, { serie: historico.data ?? [], competencia: "2026-09-01", parametros: parametros.data ?? [], historicoDisponivel: historico.isSuccess, chaves }).filter(a => selecionado.id === "root" || (a.elementoId && ids.has(a.elementoId)));
  }, [ses, chaves, selecionado, historico.data, historico.isSuccess, parametros.data]);
  const [ptManual, setPtManual] = useState("");
  const [msg, setMsg] = useState("");
  const [rel, setRel] = useState(false);
  const [linhas, setLinhas] = useState(fontesBalanco);
  const manual = ptManual.trim() === "" ? undefined : Number(ptManual);
  const manualValida = manual === undefined || (Number.isFinite(manual) && manual >= 0 && manual <= 100);
  const b = useMemo(() => balancoNo(ses, idsNo(selecionado), metodologia, manualValida ? manual : undefined), [ses, selecionado, metodologia, manual, manualValida]);
  const grafico = useMemo(() => serieBalancoNo(b, historico.data ?? [], mesesAnteriores("2026-09-01", 6).reverse(), metodologia, manualValida ? manual : undefined), [b, historico.data, metodologia, manual, manualValida]);
  const ptPct = b.injetada ? b.pt / b.injetada * 100 : 0;
  const pntPct = b.injetada ? b.pnt / b.injetada * 100 : 0;

  return (
    <div>
      <PageHeader title="Cálculo e Gestão do Balanço Energético" subtitle="Distribuidora → Regional → Município → SE → Alimentador → Religador → Trafo → Instalação">
        <Button onClick={() => setRel(true)}>
          <FileText size={14} /> Gerar Relatório de Resultados
        </Button>
      </PageHeader>
      {rel && <RelatorioBalanco onClose={() => setRel(false)} />}
      {msg && <div className="mx-6 mt-4 rounded border border-success/40 bg-success/10 px-3 py-2 text-sm">{msg}</div>}
      <div className="grid gap-4 p-6 lg:grid-cols-[300px_1fr]">
        <div className="panel max-h-[640px] overflow-auto">
          <div className="panel-h">Controle de Medições</div>
          <div className="p-2"><Tree node={arvore} sel={sel.id} onSel={setSel} /></div>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" data-testid="balance-kpis">
            {[
              ["Energia Injetada", fmt(b.injetada) + " MWh"],
              ["Energia Faturada", fmt(b.faturada) + " MWh"],
              [`${t("Perdas Técnicas")} (${ptPct.toFixed(1)}%)`, fmt(b.pt) + " MWh"],
              [`${t("Perdas Não Técnicas")} (${pntPct.toFixed(1)}%)`, fmt(b.pnt) + " MWh"],
            ].map(([l, v]) => (
              <div key={l} className="panel p-4">
                <div className="text-xs text-muted-foreground">{l}</div>
                <div className="kpi mt-1">{v}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">{t("PT manual (%)")}<input aria-label={t("PT manual (%)")} className="inp w-28" type="number" min="0" max="100" step="0.1" placeholder={t("Automática")} value={ptManual} onChange={e => setPtManual(e.target.value)} /></label>
            {ptManual && <Button variant="ghost" size="sm" onClick={() => setPtManual("")}>{t("Restaurar PT automática")}</Button>}
            {!manualValida && <span role="alert" className="text-destructive">{t("Informe uma PT entre 0% e 100%.")}</span>}
            <span className="text-xs text-muted-foreground">{t("Perdas AT da SE (separadas dos KPIs)")}: {fmt(b.perdaAT)} MWh</span>
          </div>
          <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
            <div className="panel">
              <div className="panel-h">Balanço {selecionado.id === "root" ? "Global" : "Individualizado"} — {selecionado.nome}<span className="text-xs font-normal text-muted-foreground">{selecionado.tipo}</span></div>
              {!grafico.completa && <p role="status" className="px-3 pt-3 text-xs text-muted-foreground">{t("Histórico de seis meses indisponível ou incompleto para este nó; exibindo somente o ciclo atual.")}</p>}
              {grafico.completa && <p className="px-3 pt-3 text-xs text-muted-foreground">{t("Histórico: injeção e consumo registrados; não inclui todos os fluxos direcionais do balanço atual.")}</p>}
              {selecionado.tipo === "Trafo" || selecionado.tipo === "Instalação" || selecionado.tipo === "Religador" ? <p className="px-3 pt-3 text-xs text-muted-foreground">{t("Ciclo atual a jusante: entrada estimada por consumo e PT alocada; sem medição independente de PNT.")}</p> : null}
              <div className="h-64 p-3">
                <ResponsiveContainer>
                  <BarChart data={grafico.serie}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="mes" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="injetada" name={t("Injetada")} fill="var(--chart-1)" />
                    <Bar dataKey="perdas" name={t(grafico.completa ? metodologia === "regulatorio" && manual === undefined ? "Perdas regulatórias" : "Diferença registrada" : "Perdas")} fill="var(--chart-2)" />
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
