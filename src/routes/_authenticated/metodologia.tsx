import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { useRede } from "@/lib/network-store";
import { SubBalancos } from "@/components/SubBalancos";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { CAMADAS, MOTORES, auditar, gapPorSE, saudeCamadas, type Motor } from "@/lib/metodologia";

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
  const t = useT();
  const ses = useRede((s) => s.subestacoes);
  const [aba, setAba] = useState<(typeof ABAS)[number]>(ABAS[0]);
  const [motor, setMotor] = useState<Motor>("analitico");
  const [pct, setPct] = useState(7);
  const [tarifa, setTarifa] = useState(320);
  const gaps = useMemo(() => gapPorSE(ses, tarifa), [ses, tarifa]);
  const achados = useMemo(() => auditar(ses), [ses]);
  const camadas = useMemo(() => saudeCamadas(ses), [ses]);
  const expTotal = gaps.reduce((x, g) => x + g.exposicao, 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Metodologia e Cálculo" subtitle="Motores de perdas, sub-balanços geoelétricos, gap regulatório e crítica de medições (Anexo II itens 1, 2, 4, 8 e 10)" />
      <div className="flex flex-wrap gap-2">
        {ABAS.map((a) => <Button key={a} size="sm" className="h-auto min-h-8 whitespace-normal text-left" variant={a === aba ? "default" : "outline"} onClick={() => setAba(a)}>{t(a)}</Button>)}
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

      {aba === "Sub-balanços Geoelétricos" && <SubBalancos motor={motor} pct={pct} />}

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
