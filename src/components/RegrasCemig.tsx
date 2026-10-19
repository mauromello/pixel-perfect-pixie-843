import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { useRede } from "@/lib/network-store";
import { aplicarRegrasCemig, energiaCCEE, limitesMes, type EntradaRegras, type MercadoA, type MedicaoCCEE } from "@/lib/regrasCemig";

const vazio = (competencia: string): EntradaRegras => ({ competencia, grupoA: [], grupoB: [], ipAtual: 0, cargaIP: 0, horasIP: limitesMes(competencia).horas, faturas: [], demonstracao: true });
const aVazio = (): MercadoA => ({ classe: "A4", cativoAnterior: 0, livreAnterior: 0, livreAtual: 0, cativoAtual: 0, gdConsumoAnterior: 0, gdInjecaoAnterior: 0, gdConsumoAtual: 0, gdInjecaoAtual: 0, crescimentoGD: 0 });
const f = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const camposA = [
  ["cativoAtual", "Cativo atual (MWh)"], ["cativoAnterior", "Cativo anterior (MWh)"], ["livreAnterior", "Livre anterior (MWh)"], ["livreAtual", "Livre atual (MWh)"],
  ["gdConsumoAtual", "GD consumo atual (MWh)"], ["gdConsumoAnterior", "GD consumo anterior (MWh)"], ["gdInjecaoAtual", "GD injeção atual (MWh)"], ["gdInjecaoAnterior", "GD injeção anterior (MWh)"], ["crescimentoGD", "Crescimento GD médio 12 meses (%)"],
] as const;
const nomes = { cativo_a: "Cativo A", livre_a: "Livre A", gd_consumo: "GD A — consumo", gd_injecao: "GD A — injeção", grupo_b: "Grupo B", ip: "Iluminação pública", fraude: "Fraude", recuperacao: "Recuperação" };

export function RegrasCemig() {
  const t = useT();
  const { subestacoes, competencia, setCompetencia } = useRede();
  const feeders = subestacoes.flatMap(s => s.alimentadores);
  const [id, setId] = useState(feeders[0]?.id ?? "");
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-4">
      <label className="text-xs">{t("Competência")}<input aria-label={t("Competência")} className="inp ml-2" type="month" value={competencia} onChange={e => { if (e.target.value) setCompetencia(e.target.value); }} /></label>
      <label className="text-xs">{t("Alimentador")}<select aria-label={t("Alimentador")} className="inp ml-2" value={id} onChange={e => setId(e.target.value)}>{feeders.map(f => <option key={f.id} value={f.id}>{f.cod}</option>)}</select></label>
    </div>
    <p className="text-xs text-muted-foreground">{t("Dados de demonstração. Mercado e CCEE: entradas manuais, sem conexão externa. Alterações e versões ficam nesta sessão; exporte antes de recarregar.")}</p>
    <Editor key={`${id}:${competencia}`} id={id} competencia={competencia} />
  </div>;
}
function Editor({ id, competencia }: { id: string; competencia: string }) {
  const t = useT();
  const { mercadoRegras, aplicarMercado, cceeVersoes, registrarCCEE } = useRede();
  const [e, setE] = useState<EntradaRegras>(mercadoRegras[`${id}:${competencia}`] ?? vazio(competencia));
  const [msg, setMsg] = useState("");
  const [usarCCEE, setUsarCCEE] = useState(false);
  const [destino, setDestino] = useState<"livre" | "entrada" | "fronteira">("livre");
  const [classeCCEE, setClasseCCEE] = useState<MercadoA["classe"]>("A4");
  const [parcial, setParcial] = useState(true);
  const [nova, setNova] = useState<MedicaoCCEE>({ id: `${id}:${competencia}:livre`, ponto: `${id}:livre:A4`, versao: 1, inicio: `${competencia}-01T00:00:00Z`, fim: new Date(limitesMes(competencia).fim).toISOString(), energia: 0, recebidoEm: new Date().toISOString() });
  const ponto = destino === "livre" ? `${id}:livre:${classeCCEE}` : `${id}:${destino}`;
  const ccee = useMemo(() => { try { return { resultado: energiaCCEE(cceeVersoes, ponto, competencia, parcial), erro: "" }; } catch (erro) { return { resultado: null, erro: erro instanceof Error ? erro.message : "Medição CCEE inválida." }; } }, [cceeVersoes, ponto, competencia, parcial]);
  const entrada = useMemo(() => ({ ...e, grupoA: e.grupoA.map(a => usarCCEE && destino === "livre" && a.classe === classeCCEE ? { ...a, livreAtual: ccee.resultado?.energia ?? NaN } : a) }), [e, usarCCEE, destino, classeCCEE, ccee.resultado]);
  const resultado = aplicarRegrasCemig(entrada);
  const num = (label: string, valor: number, onChange: (v: number) => void) => <label className="text-xs">{t(label)}<input aria-label={t(label)} className="inp mt-1 w-full" type="number" step="any" value={Number.isFinite(valor) ? valor : ""} onChange={ev => onChange(ev.target.value === "" ? NaN : Number(ev.target.value))} /></label>;
  const aplicar = () => { try {
    if (usarCCEE && (ccee.resultado?.energia == null || (destino === "livre" && !e.grupoA.some(a => a.classe === classeCCEE)))) throw new Error("Referência CCEE ausente para o segmento selecionado.");
    aplicarMercado(id, entrada, usarCCEE && destino !== "livre" && ccee.resultado?.energia != null ? { [destino]: ccee.resultado.energia } : {});
    setMsg("Regras aplicadas ao balanço da competência.");
  } catch (erro) { setMsg(erro instanceof Error ? erro.message : "Parâmetros inválidos ou referência ausente."); } };
  return <div className="space-y-4" data-sem-traducao>
    <section className="space-y-3 border-t pt-4">
      <h3 className="font-semibold">{t("Grupo A por classe de tensão")}</h3>
      <p className="font-mono text-xs">E_cativo = E_cativo_anterior / E_livre_anterior × E_livre_atual<br />E_GD = E_GD_anterior / h_anterior × h_atual × (1 + g_12m / 100)</p>
      {e.grupoA.map((a, i) => <div key={i} className="grid gap-3 border-b pb-3 sm:grid-cols-3">
        <label className="text-xs">{t("Classe de tensão")}<select className="inp mt-1 w-full" value={a.classe} onChange={ev => setE({ ...e, grupoA: e.grupoA.map((x, j) => j === i ? { ...x, classe: ev.target.value as MercadoA["classe"] } : x) })}>{["A2", "A3", "A3a", "A4", "AS"].map(c => <option key={c}>{c}</option>)}</select></label>
        {camposA.map(([k, label]) => <div key={k}>{num(label, a[k], v => setE({ ...e, grupoA: e.grupoA.map((x, j) => j === i ? { ...x, [k]: v } : x) }))}</div>)}
        <Button size="sm" variant="ghost" onClick={() => setE({ ...e, grupoA: e.grupoA.filter((_, j) => j !== i) })}>{t("Remover")}</Button>
      </div>)}
      <Button size="sm" variant="outline" onClick={() => setE({ ...e, grupoA: [...e.grupoA, aVazio()] })}>{t("Adicionar classe A")}</Button>
    </section>
    <section className="space-y-3 border-t pt-4">
      <h3 className="font-semibold">{t("Grupo B por classe de consumo")}</h3>
      <p className="font-mono text-xs">E_B = E_aquisição / N_aquisição × (N_anterior + ΔN_12m)</p>
      {e.grupoB.map((b, i) => <div key={i} className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs">{t("Classe de consumo")}<input className="inp mt-1 w-full" value={b.classe} onChange={ev => setE({ ...e, grupoB: e.grupoB.map((x, j) => j === i ? { ...x, classe: ev.target.value } : x) })} /></label>
        {([["energiaAtual", "Energia adquirida (MWh)"], ["consumidoresAquisicao", "Consumidores na aquisição"], ["consumidoresAnterior", "Consumidores mês anterior"], ["crescimentoConsumidores", "Crescimento médio 12 meses (consumidores)"]] as const).map(([k, label]) => <div key={k}>{num(label, b[k], v => setE({ ...e, grupoB: e.grupoB.map((x, j) => j === i ? { ...x, [k]: v } : x) }))}</div>)}
        <Button variant="ghost" size="sm" onClick={() => setE({ ...e, grupoB: e.grupoB.filter((_, j) => j !== i) })}>{t("Remover")}</Button>
      </div>)}
      <Button size="sm" variant="outline" onClick={() => setE({ ...e, grupoB: [...e.grupoB, { classe: "Residencial", energiaAtual: 0, consumidoresAquisicao: 1, consumidoresAnterior: 1, crescimentoConsumidores: 0 }] })}>{t("Adicionar classe B")}</Button>
    </section>
    <section className="space-y-3 border-t pt-4">
      <h3 className="font-semibold">{t("Iluminação pública e faturas de ajuste")}</h3>
      <p className="font-mono text-xs">E_IP = P_instalada (kW) × h / 1000</p>
      <div className="grid gap-3 sm:grid-cols-3">{num("IP antes (MWh)", e.ipAtual, v => setE({ ...e, ipAtual: v }))}{num("Carga IP instalada (kW)", e.cargaIP, v => setE({ ...e, cargaIP: v }))}{num("Horas IP no mês", e.horasIP, v => setE({ ...e, horasIP: v }))}</div>
      {e.faturas.map((a, i) => <div key={a.id} className="flex flex-wrap items-end gap-3">
        <select aria-label={t("Tipo de fatura")} className="inp" value={a.tipo} onChange={ev => setE({ ...e, faturas: e.faturas.map((x, j) => j === i ? { ...x, tipo: ev.target.value as typeof a.tipo } : x) })}><option value="fraude">{t("Fraude")}</option><option value="recuperacao">{t("Recuperação")}</option></select>
        <label className="text-xs">{t("Competência de referência")}<input className="inp ml-2" type="month" value={a.competencia} onChange={ev => setE({ ...e, faturas: e.faturas.map((x, j) => j === i ? { ...x, competencia: ev.target.value } : x) })} /></label>
        {num("Fatura (MWh)", a.energia, v => setE({ ...e, faturas: e.faturas.map((x, j) => j === i ? { ...x, energia: v } : x) }))}
        <Button size="sm" variant="ghost" onClick={() => setE({ ...e, faturas: e.faturas.filter((_, j) => j !== i) })}>{t("Remover")}</Button>
      </div>)}
      <Button size="sm" variant="outline" onClick={() => setE({ ...e, faturas: [...e.faturas, { id: crypto.randomUUID(), tipo: "fraude", competencia, energia: 0 }] })}>{t("Adicionar fatura")}</Button>
    </section>
    <section className="space-y-3 border-t pt-4">
      <h3 className="font-semibold">CCEE</h3>
      <div className="flex flex-wrap items-center gap-3">
        <select aria-label={t("Destino CCEE")} className="inp" value={destino} onChange={ev => setDestino(ev.target.value as typeof destino)}><option value="livre">{t("Livre A")}</option><option value="entrada">{t("Energia injetada")}</option><option value="fronteira">{t("Exportação de fronteira")}</option></select>
        {destino === "livre" && <select className="inp" value={classeCCEE} onChange={ev => setClasseCCEE(ev.target.value as typeof classeCCEE)}>{["A2", "A3", "A3a", "A4", "AS"].map(c => <option key={c}>{c}</option>)}</select>}
        <label className="text-xs"><input type="checkbox" checked={parcial} onChange={ev => setParcial(ev.target.checked)} /> {t("Projetar aquisição parcial para o mês inteiro")}</label>
        <label className="text-xs"><input type="checkbox" checked={usarCCEE} onChange={ev => setUsarCCEE(ev.target.checked)} /> {t("Aplicar CCEE ao balanço")}</label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs">{t("ID da medição")}<input aria-label={t("ID da medição")} className="inp mt-1 w-full" value={nova.id} onChange={ev => setNova({ ...nova, id: ev.target.value })} /></label>
        {num("Versão CCEE", nova.versao, v => setNova({ ...nova, versao: v }))}{num("Energia CCEE (MWh)", nova.energia, v => setNova({ ...nova, energia: v }))}
        {(["inicio", "fim"] as const).map(k => <label key={k} className="text-xs">{t(k === "inicio" ? "Início UTC" : "Fim UTC (exclusivo)")}<input aria-label={t(k === "inicio" ? "Início UTC" : "Fim UTC (exclusivo)")} className="inp mt-1 w-full" type="datetime-local" value={nova[k].slice(0, 16)} onChange={ev => setNova({ ...nova, [k]: `${ev.target.value}:00Z` })} /></label>)}
      </div>
      <Button variant="outline" size="sm" onClick={() => { try { registrarCCEE({ ...nova, ponto, recebidoEm: new Date().toISOString() }); setMsg("Versão CCEE registrada."); } catch (erro) { setMsg(erro instanceof Error ? erro.message : "Medição CCEE inválida."); } }}>{t("Registrar versão CCEE")}</Button>
      <p className="text-sm">{t("Energia CCEE (MWh)")}: {ccee.resultado?.energia == null ? "—" : f(ccee.resultado.energia)} · {t(ccee.resultado?.origem === "mes_anterior" ? "Mês anterior — estimado" : ccee.resultado?.estimado ? "Estimado" : "Medido")} · {ccee.resultado?.horas ?? 0} h</p>
      {ccee.erro && <p role="alert" className="text-destructive">{t(ccee.erro)}</p>}
      <div className="overflow-auto"><table className="tbl"><thead><tr><th>{t("ID da medição")}</th><th>{t("Versão CCEE")}</th><th>MWh</th><th>{t("Recebido em")}</th></tr></thead><tbody>{cceeVersoes.filter(r => r.ponto === ponto).map(r => <tr key={`${r.id}:${r.versao}`}><td>{r.id}</td><td>{r.versao}</td><td>{f(r.energia)}</td><td>{r.recebidoEm}</td></tr>)}</tbody></table></div>
    </section>
    <div className="overflow-auto"><table className="tbl" aria-label={t("Resultados por segmento")}><thead><tr><th>{t("Segmento")}</th><th>{t("Regra")}</th><th>{t("Antes (MWh)")}</th><th>{t("Depois (MWh)")}</th><th>{t("Status")}</th></tr></thead><tbody>{resultado.segmentos.map((s, i) => <tr key={i}><td>{s.segmento}</td><td>{t(nomes[s.regra])}</td><td>{f(s.antes)}</td><td>{s.depois == null ? "—" : f(s.depois)}</td><td>{s.erro ? t(s.erro) : t("Calculado")}</td></tr>)}</tbody></table></div>
    <p className="font-semibold">{t("Energia fornecida depois das regras")}: {resultado.fornecida === null ? "—" : f(resultado.fornecida)} MWh · {t("GD A — injeção")}: {f(resultado.gdExport)} MWh</p>
    <div className="flex flex-wrap gap-3"><Button disabled={resultado.fornecida === null} onClick={aplicar}>{t("Aplicar regras ao balanço")}</Button><Button variant="outline" onClick={() => {
      const blob = new Blob([JSON.stringify({ elemento: id, entrada: e, cceeVersoes }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `regras-cemig-${id}-${competencia}.json`; a.click(); URL.revokeObjectURL(url);
    }}>{t("Exportar regras e versões")}</Button></div>
    {msg && <p role="status">{t(msg)}</p>}
  </div>;
}