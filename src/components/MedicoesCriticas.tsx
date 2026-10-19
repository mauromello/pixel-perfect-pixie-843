import { useMemo, useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useRede } from "@/lib/network-store";
import { useT } from "@/lib/i18n";
import { auditar, CAMADAS, saudeCamadas } from "@/lib/metodologia";
import { historicoQuery, parametrosCriticasQuery } from "@/lib/auditoriaDados";
import { validarParametroCritica, mesesAnteriores, type ParametroCritica } from "@/lib/historico";
import { AchadosAuditoria } from "./AchadosAuditoria";

const auth = getRouteApi("/_authenticated");
function Limite({ parametro, parametros, admin, salvar, pendente }: { parametro: ParametroCritica; parametros: ParametroCritica[]; admin: boolean; salvar: (p: ParametroCritica) => void; pendente: boolean }) {
  const t = useT(); const [valor, setValor] = useState(String(parametro.valor));
  const proposta = { ...parametro, valor: Number(valor) };
  return <tr><td>{t(parametro.regra)}</td><td>{parametro.parametro}</td><td><input aria-label={`${parametro.regra}.${parametro.parametro}`} className="inp w-28" type="number" min="0" step="any" value={valor} disabled={!admin || pendente} onChange={e => setValor(e.target.value)} /></td>
    {admin && <td><Button size="icon" variant="outline" aria-label={`${t("Salvar")} ${parametro.regra}.${parametro.parametro}`} title={t("Salvar")} disabled={pendente || valor === "" || !validarParametroCritica(proposta, parametros)} onClick={() => salvar(proposta)}><Save /></Button></td>}</tr>;
}
export function MedicoesCriticas() {
  const t = useT(); const { sessao } = auth.useRouteContext(); const qc = useQueryClient();
  const ses = useRede(s => s.subestacoes);
  const chaves = useRede(s => s.chaves);
  const [competencia, setCompetencia] = useState("2026-09-01");
  const ps = useQuery(parametrosCriticasQuery(sessao.id));
  const hist = useQuery(historicoQuery(sessao.id, competencia));
  const [msg, setMsg] = useState("");
  const admin = sessao.id !== "avaliador" && sessao.perfis.includes("admin");
  const mut = useMutation({ mutationFn: async (p: ParametroCritica) => {
    if (!admin || !validarParametroCritica(p, ps.data ?? [])) throw new Error("invalid");
    const { error } = await supabase.from("criticas_parametros").update({ valor: p.valor }).eq("regra", p.regra).eq("parametro", p.parametro).select().single();
    if (error) throw error;
  }, onSuccess: async () => { setMsg("Alteração salva."); await qc.invalidateQueries({ queryKey: ["criticas_parametros"] }); }, onError: () => setMsg("Não foi possível salvar os parâmetros de críticas.") });
  const achados = useMemo(() => auditar(ses, { serie: hist.data ?? [], competencia, parametros: ps.data ?? [], historicoDisponivel: hist.isSuccess, chaves }), [ses, chaves, hist.data, hist.isSuccess, competencia, ps.data]);
  const camadas = useMemo(() => saudeCamadas(ses), [ses]);
  return <section className="space-y-4" data-sem-traducao>
    <div className="flex flex-wrap items-center gap-3"><label className="text-sm">{t("Competência")}<select aria-label={t("Competência")} className="inp ml-2" value={competencia} onChange={e => setCompetencia(e.target.value)}>{mesesAnteriores("2026-09-01", 24).map(m => <option key={m} value={m}>{m.slice(0, 7)}</option>)}</select></label>
      <span className="text-xs text-muted-foreground">{t("Dados de demonstração — série mensal fictícia e limiares ilustrativos, não homologados pela CEMIG.")}</span></div>
    {(hist.isPending || ps.isPending) && <p role="status">{t("Carregando série histórica…")}</p>}
    {(hist.isError || ps.isError) && <p role="alert" className="text-destructive">{t("Não foi possível carregar histórico ou parâmetros; regras dependentes não foram executadas.")}</p>}
    <div className="panel"><div className="panel-h">{t("Camadas de medição")}</div><div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-6">{camadas.map((c, i) => <div key={c.camada} className="rounded border p-3 text-center"><div className="text-xs text-muted-foreground">{i + 1}. {t(CAMADAS[i] ?? "")}</div><div className="font-mono text-lg">{c.pct.toFixed(1)}%</div></div>)}</div></div>
    <details className="border-b py-3"><summary className="cursor-pointer font-semibold">{t("Parâmetros de críticas")}</summary>
      <p className="py-2 text-xs text-muted-foreground">{t("Somente administradores autenticados podem alterar os limiares.")}</p>
      {msg && <p role="status">{t(msg)}</p>}<div className="max-h-80 overflow-auto"><table className="tbl"><thead><tr><th>{t("Regra")}</th><th>{t("Parâmetro")}</th><th>{t("Valor")}</th>{admin && <th>{t("Ações")}</th>}</tr></thead><tbody>{(ps.data ?? []).map(p => <Limite key={`${p.regra}:${p.parametro}:${p.valor}`} parametro={p} parametros={ps.data ?? []} admin={admin} pendente={mut.isPending} salvar={p => mut.mutate(p)} />)}</tbody></table></div>
    </details>
    <AchadosAuditoria achados={achados} />
  </section>;
}