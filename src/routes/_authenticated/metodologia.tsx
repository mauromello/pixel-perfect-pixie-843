import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { useRede } from "@/lib/network-store";
import { CAMADAS, MOTORES, auditar, gapPorSE, saudeCamadas, subBalanco, type Motor } from "@/lib/metodologia";

export const Route = createFileRoute("/_authenticated/metodologia")({
  head: () => ({
    meta: [
      { title: "Metodologia e Cálculo — PerdaZero" },
      { name: "description", content: "Motores de cálculo de perdas, sub-balanços geoelétricos, gap regulatório e auditoria de medições." },
      { property: "og:title", content: "Metodologia e Cálculo — PerdaZero" },
      { property: "og:description", content: "Equações PRODIST/PRORET, sub-balanços e exposição tarifária." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MetodologiaPage,
});

const ABAS = ["Motores e Equações", "Sub-balanços Geoelétricos", "Gap Regulatório e Tarifa", "Medições e Críticas"] as const;
const fmt = (n: number, d = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });
const sevCls = { Alta: "bg-destructive/15 text-destructive", Média: "bg-chart-4/20", Baixa: "bg-muted" } as const;

function MetodologiaPage() {
  const ses = useRede((s) => s.subestacoes);
  const [aba, setAba] = useState<(typeof ABAS)[number]>(ABAS[0]);
  const [motor, setMotor] = useState<Motor>("analitico");
  const [pct, setPct] = useState(7);
  const [tarifa, setTarifa] = useState(320);
  const [filtro, setFiltro] = useState("");
  const todos = useMemo(() => ses.flatMap((s) => s.alimentadores.map((f) => ({ id: f.id, cod: f.cod, se: s.nome }))), [ses]);
  const [sel, setSel] = useState<string[]>(() => ses[0]?.alimentadores.map((f) => f.id) ?? []);
  const sb = useMemo(() => subBalanco(ses, sel, motor, pct), [ses, sel, motor, pct]);
  const gaps = useMemo(() => gapPorSE(ses, tarifa), [ses, tarifa]);
  const achados = useMemo(() => auditar(ses), [ses]);
  const camadas = useMemo(() => saudeCamadas(ses), [ses]);
  const expTotal = gaps.reduce((x, g) => x + g.exposicao, 0);
  const toggle = (id: string) => setSel((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  return (
    <div className="space-y-4">
      <PageHeader title="Metodologia e Cálculo" subtitle="Motores de perdas, sub-balanços geoelétricos, gap regulatório e crítica de medições (Anexo II itens 1, 2, 4, 8 e 10)" />
      <div className="flex flex-wrap gap-2">
        {ABAS.map((a) => <button key={a} className={a === aba ? "btn-primary" : "btn"} onClick={() => setAba(a)}>{a}</button>)}
      </div>

      {aba === "Motores e Equações" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="panel">
            <div className="panel-h">Motor de cálculo de perdas técnicas</div>
            <div className="space-y-2 p-4">
              {MOTORES.map((m) => (
                <label key={m.id} className="flex cursor-pointer gap-2 rounded border p-3">
                  <input type="radio" checked={motor === m.id} onChange={() => setMotor(m.id)} />
                  <span><b className="text-sm">{m.nome}</b><br /><span className="text-xs text-muted-foreground">{m.desc}</span></span>
                </label>
              ))}
              {motor === "parametrizado" && (
                <label className="block text-xs">% de perdas técnicas informado
                  <input className="inp mt-1 w-full" type="number" step="0.1" value={pct} onChange={(e) => setPct(Number(e.target.value))} />
                </label>
              )}
            </div>
          </div>
          <div className="panel">
            <div className="panel-h">Equações por nível de tensão</div>
            <div className="space-y-3 p-4 font-mono text-xs">
              <p><b>Perda total:</b> L = E_entrada_líquida − E_fornecida</p>
              <p><b>Entrada líquida:</b> E_disjuntor + E_GD_export − E_fronteira</p>
              <p><b>AT (SE):</b> L_AT = E_AT + G_local − S_aux − Σ E_disjuntor</p>
              <p><b>MT (condutores):</b> L_MT = 3 · R · I² · L · Δt (Δt = 730 h)</p>
              <p><b>BT (trafos):</b> L_BT = (P0 + Pcu · FC²) · Δt (FC = 0,6)</p>
              <p><b>PNT:</b> L_NT = L − L_técnica</p>
              <p><b>GD:</b> exportação e importação lidas separadamente — nunca compensadas</p>
              <p><b>Regulatório:</b> PT = E · %PT_PRORET; PNT = E · %PNT_PRORET</p>
            </div>
          </div>
        </div>
      )}

      {aba === "Sub-balanços Geoelétricos" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="panel">
            <div className="panel-h">Alimentadores da fronteira ({sel.length})</div>
            <div className="space-y-2 p-3">
              <input className="inp w-full" placeholder="Filtrar SE ou alimentador" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
              <div className="flex gap-2"><button className="btn" onClick={() => setSel([])}>Limpar</button></div>
              <div className="max-h-96 overflow-auto text-sm">
                {todos.filter((a) => `${a.se} ${a.cod}`.toLowerCase().includes(filtro.toLowerCase())).map((a) => (
                  <label key={a.id} className="flex gap-2 py-0.5"><input type="checkbox" checked={sel.includes(a.id)} onChange={() => toggle(a.id)} />{a.cod} <span className="text-muted-foreground">· {a.se}</span></label>
                ))}
              </div>
            </div>
          </div>
          <div className="panel lg:col-span-2">
            <div className="panel-h">Balanço do sub-conjunto · {MOTORES.find((m) => m.id === motor)?.nome}</div>
            <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3">
              {[
                ["Energia injetada", sb.entrada, "MWh"], ["Fluxo de fronteira externa", sb.fronteiraExterna, "MWh"], ["Fluxo interno compensado", sb.fronteiraInterna, "MWh"],
                ["Entrada líquida", sb.liquida, "MWh"], ["Energia fornecida", sb.fornecida, "MWh"], ["Perda total", sb.total, "MWh"],
                ["Perda técnica", sb.pt, "MWh"], ["Perda não técnica", sb.pnt, "MWh"], ["Perda %", sb.pct, "%"],
              ].map(([l, v, u]) => (
                <div key={l as string} className="rounded border p-3"><div className="text-xs text-muted-foreground">{l}</div><div className="font-mono text-lg">{fmt(v as number, u === "%" ? 2 : 0)} {u}</div></div>
              ))}
            </div>
            <div className="px-4 pb-4 text-sm">Estanqueidade da fronteira: <b>{fmt(sb.estanqueidade, 1)}%</b> {sb.estanqueidade < 97 ? "— fronteira com vazamento relevante" : "— fronteira fechada"}</div>
          </div>
        </div>
      )}

      {aba === "Gap Regulatório e Tarifa" && (
        <div className="panel overflow-auto">
          <div className="panel-h flex flex-wrap items-center gap-3">
            Gap regulatório por subestação
            <label className="ml-auto text-xs">Tarifa média de repasse (R$/MWh) <input className="inp ml-1 w-24" type="number" value={tarifa} onChange={(e) => setTarifa(Number(e.target.value))} /></label>
            <span className="text-sm">Exposição total: <b>R$ {fmt(expTotal)}</b></span>
          </div>
          <table className="tbl">
            <thead><tr><th>SE</th><th>Regional</th><th>Entrada (MWh)</th><th>Perda real %</th><th>Meta %</th><th>Gap (pp)</th><th>Gap (MWh)</th><th>Exposição (R$)</th></tr></thead>
            <tbody>{gaps.map((g) => (
              <tr key={g.id}><td>{g.nome}</td><td>{g.regional}</td><td className="font-mono">{fmt(g.entrada)}</td><td className="font-mono">{fmt(g.realPct, 2)}</td><td className="font-mono">{fmt(g.realPct - g.gapPP, 2)}</td>
                <td className={`font-mono ${g.gapPP > 0 ? "text-destructive" : ""}`}>{fmt(g.gapPP, 2)}</td><td className="font-mono">{fmt(g.gapMWh)}</td><td className="font-mono">{fmt(g.exposicao)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {aba === "Medições e Críticas" && (
        <div className="space-y-4">
          <div className="panel">
            <div className="panel-h">Camadas de medição</div>
            <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-6">
              {camadas.map((c, i) => (
                <div key={c.camada} className="rounded border p-3 text-center"><div className="text-xs text-muted-foreground">{i + 1}. {CAMADAS[i]}</div><div className="font-mono text-lg">{fmt(c.pct, 1)}%</div></div>
              ))}
            </div>
          </div>
          <div className="panel overflow-auto">
            <div className="panel-h">Achados das 8 regras de auditoria ({achados.length})</div>
            <table className="tbl">
              <thead><tr><th>Regra</th><th>Elemento</th><th>Descrição</th><th>Severidade</th></tr></thead>
              <tbody>{achados.slice(0, 200).map((a, i) => (
                <tr key={i}><td>{a.regra}</td><td>{a.elemento}</td><td>{a.descricao}</td><td><span className={`badge ${sevCls[a.severidade]}`}>{a.severidade}</span></td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
