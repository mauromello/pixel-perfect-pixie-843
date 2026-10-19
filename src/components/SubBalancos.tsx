import { useMemo, useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { FolderOpen, Save, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useRede } from "@/lib/network-store";
import { useIdioma, useT } from "@/lib/i18n";
import { subBalanco, validarElementosArea, type ElementosArea, type Motor } from "@/lib/metodologia";
import type { Tables } from "@/integrations/supabase/types";

const auth = getRouteApi("/_authenticated");
const grupos = ["alimentadores", "trafos", "medidoresFronteira", "chavesCorte"] as const;
const nomes = { alimentadores: "Alimentadores", trafos: "Trafos", medidoresFronteira: "Medidores de fronteira", chavesCorte: "Chaves" };

export function SubBalancos({ motor, pct }: { motor: Motor; pct: number }) {
  const t = useT();
  const idioma = useIdioma(s => s.idioma);
  const fmt = (n: number) => n.toLocaleString(idioma, { maximumFractionDigits: 2 });
  const ses = useRede(s => s.subestacoes);
  const chaves = useRede(s => s.chaves);
  const updSE = useRede(s => s.updSubestacao);
  const { sessao } = auth.useRouteContext();
  const gravar = sessao.id !== "avaliador" && sessao.perfis.some(p => ["admin", "operador", "planejamento"].includes(p));
  const [area, setArea] = useState<ElementosArea>(() => ({ alimentadores: ses[0]?.alimentadores.map(f => f.id) ?? [], trafos: ses[0]?.alimentadores.flatMap(f => f.trafos.map(tr => tr.id)) ?? [], medidoresFronteira: ses[0]?.medidoresFronteira?.map(m => m.id) ?? [], chavesCorte: [] }));
  const [grupo, setGrupo] = useState<(typeof grupos)[number]>("alimentadores");
  const [filtro, setFiltro] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dialog, setDialog] = useState<"salvar" | "abrir" | null>(null);
  const [salvas, setSalvas] = useState<Tables<"areas_subbalanco">[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [editar, setEditar] = useState<string | null>(null);
  const sb = useMemo(() => subBalanco(ses, area, motor, pct, chaves), [ses, area, motor, pct, chaves]);
  const feeders = ses.flatMap(s => s.alimentadores);
  const meters = ses.flatMap(s => (s.medidoresFronteira ?? []).map(m => ({ ...m, seId: s.id })));
  const elementos = {
    alimentadores: feeders.map(f => ({ id: f.id, nome: f.cod, extra: `${f.tensaoKV} kV` })),
    trafos: feeders.flatMap(f => f.trafos.map(tr => ({ id: tr.id, nome: tr.nome, extra: f.cod }))),
    medidoresFronteira: meters.map(m => ({ id: m.id, nome: m.nome, extra: `${fmt(m.energiaMWh)} / ${fmt(m.reversaMWh)} MWh · ${t(m.fonte === "medida" ? "Medida" : "Estimada")}` })),
    chavesCorte: chaves.filter(c => !c.alimentadorBId).map(c => ({ id: c.id, nome: c.cod, extra: feeders.find(f => f.id === c.alimentadorId)?.cod ?? c.alimentadorId })),
  };
  const endpoints = [...feeders.map(f => ({ id: f.id, nome: f.cod })), ...feeders.flatMap(f => [...f.trafos.map(tr => ({ id: tr.id, nome: tr.nome })), ...f.segmentos.map(g => ({ id: g.id, nome: g.cod }))]), { id: "exterior", nome: t("Exterior") }];
  const label = (id: string) => endpoints.find(e => e.id === id)?.nome ?? id;
  const meter = meters.find(m => m.id === editar);
  function toggle(id: string) {
    setArea(a => {
      const lista = a[grupo] ?? [];
      const next = lista.includes(id) ? lista.filter(x => x !== id) : [...lista, id];
      if (grupo !== "alimentadores") return { ...a, [grupo]: next };
      const trIds = feeders.find(f => f.id === id)?.trafos.map(tr => tr.id) ?? [];
      const was = lista.includes(id);
      return { ...a, alimentadores: next, trafos: was ? (a.trafos ?? []).filter(x => !trIds.includes(x)) : [...new Set([...(a.trafos ?? []), ...trIds])] };
    });
  }
  async function salvar() {
    if (!nome.trim() || !gravar || busy) return;
    setBusy(true); setMsg("");
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) { setMsg("Entre com uma conta para salvar ou abrir áreas."); return; }
      const { error } = await supabase.from("areas_subbalanco").insert({ nome: nome.trim(), descricao, elementos: JSON.parse(JSON.stringify(area)), usuario_id: user.user.id });
      if (error) { setMsg("Não foi possível salvar a área."); return; }
      setDialog(null); setMsg("Área salva.");
    } catch { setMsg("Não foi possível salvar a área."); } finally { setBusy(false); }
  }
  async function abrir() {
    setDialog("abrir"); setBusy(true); setMsg("");
    try {
      const { data, error } = await supabase.from("areas_subbalanco").select("*").order("criado_em", { ascending: false });
      if (error) { setMsg("Não foi possível abrir as áreas salvas."); return; }
      setSalvas(data ?? []);
    } catch { setMsg("Não foi possível abrir as áreas salvas."); } finally { setBusy(false); }
  }
  function atualizarMedidor(p: Partial<NonNullable<typeof meter>>) {
    if (!meter) return;
    const se = ses.find(s => s.id === meter.seId);
    if (!se) return;
    updSE(se.id, { medidoresFronteira: (se.medidoresFronteira ?? []).map(m => m.id === meter.id ? { ...m, ...p } : m) });
  }
  return <section className="space-y-4" data-sem-traducao>
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" disabled={!gravar} onClick={() => { setDialog("salvar"); setMsg(""); }}><Save />{t("Salvar área")}</Button>
      <Button size="sm" variant="outline" disabled={sessao.id === "avaliador"} onClick={abrir}><FolderOpen />{t("Abrir área salva")}</Button>
      <span className="text-xs text-muted-foreground">{t("Dados de demonstração — leituras fictícias e fluxos estimados.")}</span>
    </div>
    {sessao.id === "avaliador" && <p className="text-xs text-muted-foreground">{t("Entre com uma conta para salvar ou abrir áreas.")}</p>}
    {msg && <p role="status" className="text-sm">{t(msg)}</p>}
    <div className="grid gap-4 xl:grid-cols-[minmax(300px,1fr)_2fr]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label={t("Elementos da área")}>
          {grupos.map(g => <Button key={g} size="sm" role="tab" aria-selected={grupo === g} variant={grupo === g ? "default" : "outline"} onClick={() => { setGrupo(g); setFiltro(""); setEditar(null); }}>{t(nomes[g])}</Button>)}
        </div>
        <input className="inp w-full" aria-label={t("Filtrar elementos")} placeholder={t("Filtrar elementos")} value={filtro} onChange={e => setFiltro(e.target.value)} />
        <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{(area[grupo] ?? []).length} {t("Selecionados")}</span><Button size="sm" variant="ghost" onClick={() => setArea({ alimentadores: [], trafos: [], medidoresFronteira: [], chavesCorte: [] })}>{t("Limpar")}</Button></div>
        <div className="max-h-96 overflow-auto divide-y border rounded-md">
          {elementos[grupo].filter(e => `${e.nome} ${e.extra}`.toLowerCase().includes(filtro.toLowerCase())).map(e => <div key={e.id} className="flex items-center gap-2 p-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm"><input type="checkbox" checked={(area[grupo] ?? []).includes(e.id)} onChange={() => toggle(e.id)} /><span className="min-w-0 break-words">{e.nome}<span className="block text-xs text-muted-foreground">{e.extra}</span></span></label>
            {grupo === "medidoresFronteira" && <Button size="icon" variant="ghost" title={t("Editar medidor")} aria-label={`${t("Editar medidor")} ${e.nome}`} onClick={() => setEditar(e.id)}><Pencil /></Button>}
          </div>)}
          {!elementos[grupo].length && <p className="p-3 text-sm text-muted-foreground">{t("Nenhum elemento disponível.")}</p>}
        </div>
        {meter && <fieldset className="space-y-2 border rounded-md p-3 text-xs"><legend>{meter.nome}</legend>
          {(["origemId", "destinoId"] as const).map(k => <label key={k} className="block">{t(k === "origemId" ? "Origem" : "Destino")}<select className="inp mt-1 w-full" value={meter[k]} onChange={e => atualizarMedidor({ [k]: e.target.value })}>{endpoints.map(ep => <option key={ep.id} value={ep.id}>{ep.nome}</option>)}</select></label>)}
          {(["energiaMWh", "reversaMWh"] as const).map(k => <label key={k} className="block">{t(k === "energiaMWh" ? "Fluxo direto (MWh)" : "Fluxo reverso (MWh)")}<input className="inp mt-1 w-full" type="number" min="0" step="0.01" value={meter[k]} onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 0) atualizarMedidor({ [k]: n }); }} /></label>)}
          <label className="block">{t("Fonte")}<select className="inp mt-1 w-full" value={meter.fonte} onChange={e => atualizarMedidor({ fonte: e.target.value === "medida" ? "medida" : "estimada" })}><option value="estimada">{t("Estimada")}</option><option value="medida">{t("Medida")}</option></select></label>
          <Button size="sm" variant="outline" onClick={() => setEditar(null)}>{t("Fechar")}</Button>
        </fieldset>}
      </div>
      <div className="min-w-0 space-y-4">
        <h2 className="text-sm font-semibold">{t("Balanço do sub-conjunto")}{nome ? ` · ${nome}` : ""}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{([
          ["Energia injetada", sb.entrada], ["Fluxo de fronteira externa", sb.fronteiraExterna], ["Fluxo interno compensado", sb.fronteiraInterna], ["Entrada líquida", sb.liquida], ["Energia fornecida", sb.fornecida], ["Perda total", sb.total], ["Perda técnica", sb.pt], ["Perda não técnica", sb.pnt], ["Perda %", sb.pct],
        ] as [string, number][]).map(([l,v]) => <div key={l} className="border rounded-md p-3 min-w-0"><div className="text-xs text-muted-foreground">{t(l)}</div><div className="font-mono text-base break-words">{fmt(v)} {l === "Perda %" ? "%" : "MWh"}</div></div>)}</div>
        <p className="text-sm">{t("Estanqueidade da fronteira")}: <b>{fmt(sb.estanqueidade)}%</b></p>
        {sb.alertas.map(a => <p key={a} className="text-xs text-destructive" role="alert">{t(a)}</p>)}
        <h3 className="text-sm font-semibold">{t("Elementos da fronteira")}</h3>
        <div className="max-h-80 overflow-auto border rounded-md"><table className="tbl"><thead><tr>{["Elemento", "Origem", "Destino", "Tipo", "Fluxo (MWh)", "Fonte"].map(l => <th key={l}>{t(l)}</th>)}</tr></thead><tbody>{sb.fronteira.map(e => <tr key={e.id}><td>{e.nome}</td><td>{label(e.origemId)}</td><td>{label(e.destinoId)}</td><td>{t(e.tipo === "interno" ? "Interno" : e.tipo === "entrada" ? "Entrada" : "Saída")}</td><td className="font-mono">{fmt(e.fluxo)}</td><td>{t(e.fonte === "medida" ? "Medida" : "Estimada")}</td></tr>)}</tbody></table>{!sb.fronteira.length && <p className="p-3 text-sm">{t("Nenhum fluxo de fronteira.")}</p>}</div>
      </div>
    </div>
    {dialog && <div role="dialog" aria-modal="true" aria-label={t(dialog === "salvar" ? "Salvar área" : "Abrir área salva")} className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4"><div className="w-full max-w-lg border rounded-md bg-background p-5 shadow-lg space-y-3">
      <div className="flex items-center justify-between"><h2 className="font-semibold">{t(dialog === "salvar" ? "Salvar área" : "Abrir área salva")}</h2><Button variant="ghost" size="icon" aria-label={t("Fechar")} onClick={() => setDialog(null)}><X /></Button></div>
      {dialog === "salvar" ? <form className="space-y-3" onSubmit={e => { e.preventDefault(); void salvar(); }}><label className="block text-sm">{t("Nome")}<input autoFocus required maxLength={120} className="inp mt-1 w-full" value={nome} onChange={e => setNome(e.target.value)} /></label><label className="block text-sm">{t("Descrição")}<textarea className="inp mt-1 w-full" value={descricao} onChange={e => setDescricao(e.target.value)} /></label><Button type="submit" disabled={busy || !nome.trim()}><Save />{t(busy ? "Carregando…" : "Salvar área")}</Button></form> : <div className="max-h-96 overflow-auto space-y-2">{busy ? t("Carregando…") : salvas.length ? salvas.map(a => <Button key={a.id} variant="outline" className="w-full h-auto justify-start whitespace-normal text-left" onClick={() => { const parsed = validarElementosArea(a.elementos); if (!parsed) { setMsg("Área salva inválida."); return; } setArea(parsed); setNome(a.nome); setDescricao(a.descricao); setDialog(null); }}><FolderOpen /><span>{a.nome}<span className="block text-xs text-muted-foreground">{a.descricao}</span></span></Button>) : t("Nenhuma área salva.")}</div>}
      {msg && <p role="alert" className="text-sm text-destructive">{t(msg)}</p>}
    </div></div>}
  </section>;
}