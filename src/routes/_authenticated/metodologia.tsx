import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { useRede } from "@/lib/network-store";
import { SubBalancos } from "@/components/SubBalancos";
import { MedicoesCriticas } from "@/components/MedicoesCriticas";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { fatorPerdas, balancoAlimentador } from "@/lib/calculationEngine";
import { MOTORES, gapPorSE, importarPertecCSV, perdaTecnicaMotor, type Motor } from "@/lib/metodologia";

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

function MetodologiaPage() {
  const t = useT();
  const ses = useRede((s) => s.subestacoes);
  const parametros = useRede(s => s.parametrosPerda);
  const setParametros = useRede(s => s.setParametrosPerda);
  const setMotorPT = useRede(s => s.setMotorPT);
  const importarPT = useRede(s => s.importarPT);
  const motorPT = useRede(s => s.motorPT);
  const [aba, setAba] = useState<(typeof ABAS)[number]>(ABAS[0]);
  const [motor, setMotor] = useState<Motor>(motorPT);
  const [mensagem, setMensagem] = useState("");
  const [importando, setImportando] = useState(false);
  const [pct, setPct] = useState(7);
  const [tarifa, setTarifa] = useState(320);
  const gaps = useMemo(() => gapPorSE(ses, tarifa), [ses, tarifa]);
  const expTotal = gaps.reduce((x, g) => x + g.exposicao, 0);
  const feeders = ses.flatMap(s => s.alimentadores);
  const entrada = feeders.reduce((n,f) => n + balancoAlimentador(f).entradaLiquida, 0);
  const ptTotal = ses.reduce((n,s) => n + s.alimentadores.reduce((v,f) => v + perdaTecnicaMotor(f, motor, pct, s.alvoPT), 0), 0);
  async function importar(file: File) {
    setImportando(true); setMensagem("");
    try {
      const resultado = importarPertecCSV(await file.text(), feeders.map(f => f.cod));
      importarPT(resultado.valores); setMotor("importado");
      setMensagem(`${t("Alimentadores importados")}: ${Object.keys(resultado.valores).length}. ${t("Códigos fora do modelo")}: ${resultado.desconhecidos.join(", ") || "0"}`);
    } catch (erro) { setMensagem(t(erro instanceof Error ? erro.message : "Não foi possível ler o CSV.")); }
    finally { setImportando(false); }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Metodologia e Cálculo" subtitle="Motores de perdas, sub-balanços geoelétricos, gap regulatório e crítica de medições (Anexo II itens 1, 2, 4, 8 e 10)" />
      <div className="flex flex-wrap gap-2">
        {ABAS.map((a) => <Button key={a} size="sm" className="h-auto min-h-8 whitespace-normal text-left" variant={a === aba ? "default" : "outline"} onClick={() => setAba(a)}>{t(a)}</Button>)}
      </div>

      {aba === "Motores e Equações" && (
        <div className="grid gap-4 lg:grid-cols-2" data-sem-traducao>
          <div className="panel">
            <div className="panel-h">{t("Motor de cálculo de perdas técnicas")}</div>
            <div className="space-y-2 p-4">
              {MOTORES.map((m) => (
                <label key={m.id} className="flex cursor-pointer gap-2 rounded border p-3">
                  <input type="radio" name="motor" checked={motor === m.id} onChange={() => { setMotor(m.id); setMotorPT(m.id === "importado" ? "importado" : "analitico"); }} />
                  <span><b className="text-sm">{t(m.nome)}</b><br /><span className="text-xs text-muted-foreground">{t(m.desc)}</span></span>
                </label>
              ))}
              {motor === "parametrizado" && (
                <label className="block text-xs">{t("% de perdas técnicas informado")}
                  <input className="inp mt-1 w-full" type="number" step="0.1" value={pct} onChange={(e) => setPct(Number(e.target.value))} />
                </label>
              )}
              {(motor === "analitico" || motor === "importado") && <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {([{ key: "fd", label: "Fator de distribuição Fd" }, { key: "coeficiente", label: "Coeficiente a" }, { key: "fc", label: "Fator de carga FC" }] as const).map(p => <label key={p.key} className="text-xs">{t(p.label)}
                  <input className="inp mt-1 w-full" type="number" min="0" max="1" step="any" value={parametros[p.key]} onChange={e => { if (e.target.value !== "") setParametros({ ...parametros, [p.key]: Number(e.target.value) }); }} />
                </label>)}
              </div>}
              {motor === "importado" && <div className="space-y-2">
                <label className="block text-xs">{t("Importar CSV PERTEC PLUS")}
                  <input className="inp mt-1 w-full" type="file" accept=".csv,text/csv" disabled={importando} onChange={e => { const file = e.target.files?.[0]; if (file) void importar(file); e.target.value = ""; }} />
                </label>
                <p className="font-mono text-xs">cod_alimentador;pt_mwh</p>
                <p className="text-xs text-muted-foreground">{t("Alimentadores sem PT importada usam o motor analítico.")}</p>
              </div>}
              {mensagem && <p role="status" className="text-xs">{mensagem}</p>}
              <div className="border-t pt-3 text-sm" aria-label="PT total">
                {t("PT total")}: <b>{fmt(ptTotal, 2)} MWh · {fmt(entrada > 0 ? ptTotal / entrada * 100 : 0, 2)}%</b>
              </div>
              <p className="text-xs text-muted-foreground">{t("Dados de demonstração — leituras fictícias e fluxos estimados.")}</p>
            </div>
          </div>
          <div className="panel">
            <div className="panel-h">{t("Equações por nível de tensão")}</div>
            <div className="space-y-3 p-4 font-mono text-xs">
              <p><b>{t("Perda total")}:</b> L = E_net_input − E_delivered</p>
              <p><b>{t("Entrada líquida")}:</b> E_breaker + E_GD_export − E_boundary</p>
              <p><b>AT (SE):</b> L_AT = E_AT + G_local − S_aux − Σ E_disjuntor</p>
              <p><b>{t("MT (condutores)")}:</b> L_MT = 3 · R · I² · L · 730 · Fd · Fp / 10⁶ MWh</p>
              <p>Fp = a · FC + (1 − a) · FC² = {fmt(fatorPerdas(parametros), 4)}</p>
              <p>Fd = {fmt(parametros.fd, 6)}; a = {fmt(parametros.coeficiente, 2)}; FC = {fmt(parametros.fc, 2)}</p>
              <p><b>{t("BT (trafos)")}:</b> L_BT = (P0 + Pcu · FC²) · 730 / 1000 MWh</p>
              <p><b>PNT:</b> L_NT = L − L_técnica</p>
              <p><b>GD:</b> {t("exportação e importação lidas separadamente — nunca compensadas")}</p>
              <p><b>{t("Regulatório")}:</b> PT = E · %PT_PRORET; PNT = E · %PNT_PRORET</p>
              <p><b>PERTEC PLUS:</b> {t("PT = CSV por alimentador; sem linha: motor analítico")}</p>
              <p className="text-muted-foreground">{t("PT importada por nível e por área parcial: rateio proporcional às perdas analíticas.")}</p>
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

      {aba === "Medições e Críticas" && <MedicoesCriticas />}
    </div>
  );
}
