import { useState } from "react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Download, Pencil, Save, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { dicionarioQuery } from "@/lib/dicionarioDados";
import { COLUNAS_DICIONARIO, exportarDicionarioCSV, filtrarDicionario, type EntradaDicionario } from "@/lib/dicionarioSeed";
import { useT } from "@/lib/i18n";

const auth = getRouteApi("/_authenticated");
const rotulos = { grupo: "Grupo", entidade: "Entidade", variavel: "Variável", tipo: "Tipo", unidade: "Unidade", nivel_hierarquia: "Nível hierárquico", sistema_origem: "Sistema de origem", periodicidade: "Periodicidade", obrigatoria: "Obrigatória", chave: "Chave de identificação", regra_critica: "Regra crítica", descricao: "Descrição" };
export function DicionarioDados() {
  const t = useT();
  const { sessao } = auth.useRouteContext();
  const query = dicionarioQuery(sessao.id);
  const { data, isFetching } = useSuspenseQuery(query);
  const qc = useQueryClient();
  const admin = sessao.id !== "avaliador" && sessao.perfis.includes("admin");
  const [grupo, setGrupo] = useState(""); const [busca, setBusca] = useState("");
  const [edicao, setEdicao] = useState<{ original: EntradaDicionario; draft: EntradaDicionario } | null>(null);
  const [mensagem, setMensagem] = useState("");
  const lista = filtrarDicionario(data.rows, grupo, busca);
  const mut = useMutation({
    mutationFn: async ({ original, draft }: { original: EntradaDicionario; draft: EntradaDicionario }) => {
      if (!admin) throw new Error("forbidden");
      const { data: saved, error } = await supabase.from("dicionario_dados").update(draft).eq("entidade", original.entidade).eq("variavel", original.variavel).select().single();
      if (error || !saved) throw error ?? new Error("not updated");
    },
    onSuccess: async () => { setEdicao(null); setMensagem("Alteração salva."); await qc.invalidateQueries({ queryKey: query.queryKey }); },
    onError: () => setMensagem("Não foi possível salvar o dicionário."),
  });
  function exportar() {
    const url = URL.createObjectURL(new Blob([exportarDicionarioCSV(lista)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "dicionario-extracoes-cemig.csv"; a.click(); URL.revokeObjectURL(url);
  }
  return <section className="panel min-w-0" data-sem-traducao>
    <div className="panel-h">{t("Dicionário de Dados — Extrações CEMIG")}</div>
    <div className="flex flex-wrap items-end gap-3 p-3">
      <label className="text-xs">{t("Grupo")}<select className="inp mt-1 block max-w-full" value={grupo} onChange={e => setGrupo(e.target.value)}><option value="">{t("Todos os grupos")}</option>{[...new Set(data.rows.map(r => r.grupo))].sort().map(g => <option key={g} value={g}>{t(g)}</option>)}</select></label>
      <label className="min-w-0 flex-1 text-xs">{t("Buscar no dicionário")}<input className="inp mt-1 w-full" value={busca} onChange={e => setBusca(e.target.value)} /></label>
      <Button variant="outline" size="sm" disabled={!lista.length} onClick={exportar}><Download />{t("Exportar CSV")}</Button>
      <Button variant="outline" size="icon" title={t("Atualizar")} aria-label={t("Atualizar")} disabled={isFetching} onClick={() => void qc.invalidateQueries({ queryKey: query.queryKey })}><RefreshCw /></Button>
      <span className="text-xs text-muted-foreground">{lista.length} / {data.rows.length}</span>
    </div>
    <p className="px-3 pb-3 text-xs text-muted-foreground">{t("Dados de demonstração. Origens externas são referências para extração, não integrações ativas. Lacunas indicam entidades ainda ausentes.")}</p>
    {sessao.id === "avaliador" && <p className="p-3 text-sm">{t("Entre com uma conta para consultar o dicionário.")} <Link to="/login" className="text-primary underline">{t("Entrar")}</Link></p>}
    {data.erro && <p role="alert" className="p-3 text-destructive">{t("Não foi possível carregar o dicionário.")}</p>}
    {mensagem && <p role="status" className="px-3 pb-3 text-sm">{t(mensagem)}</p>}
    <div className="max-h-[620px] overflow-auto">
      <table className="tbl"><thead className="sticky top-0 z-10 bg-muted"><tr>{COLUNAS_DICIONARIO.map(k => <th key={k}>{t(rotulos[k])}</th>)}{admin && <th className="sticky right-0 bg-muted">{t("Ações")}</th>}</tr></thead>
        <tbody>{lista.map(r => {
          const edit = edicao?.original.entidade === r.entidade && edicao.original.variavel === r.variavel;
          return <tr key={`${r.entidade}:${r.variavel}`}>
            {COLUNAS_DICIONARIO.map(k => <td key={k} className={k === "variavel" ? "font-mono text-primary" : ""}>
              {edit && edicao ? typeof r[k] === "boolean" ? <input aria-label={t(rotulos[k])} type="checkbox" checked={Boolean(edicao.draft[k])} disabled={mut.isPending} onChange={e => setEdicao({ ...edicao, draft: { ...edicao.draft, [k]: e.target.checked } })} /> : <input aria-label={t(rotulos[k])} className="inp w-40" value={String(edicao.draft[k])} disabled={mut.isPending || k === "entidade" || k === "variavel"} onChange={e => setEdicao({ ...edicao, draft: { ...edicao.draft, [k]: e.target.value } })} /> : typeof r[k] === "boolean" ? t(r[k] ? "Sim" : "Não") : <span className="block max-w-80 whitespace-normal">{k === "entidade" || k === "variavel" || k === "tipo" ? String(r[k]) : t(String(r[k]))}</span>}
            </td>)}
            {admin && <td className="sticky right-0 bg-background"><div className="flex gap-1">{edit && edicao ? <><Button size="icon" variant="outline" title={t("Salvar")} aria-label={t("Salvar")} disabled={mut.isPending || !edicao.draft.grupo.trim() || !edicao.draft.tipo.trim()} onClick={() => mut.mutate(edicao)}><Save /></Button><Button size="icon" variant="outline" title={t("Cancelar")} aria-label={t("Cancelar")} disabled={mut.isPending} onClick={() => setEdicao(null)}><X /></Button></> : <Button size="icon" variant="outline" title={t("Editar")} aria-label={`${t("Editar")} ${r.entidade}.${r.variavel}`} disabled={edicao !== null} onClick={() => { setMensagem(""); setEdicao({ original: r, draft: { ...r } }); }}><Pencil /></Button>}</div></td>}
          </tr>;
        })}{!lista.length && sessao.id !== "avaliador" && !data.erro && <tr><td colSpan={13}>{t("Nenhuma variável encontrada.")}</td></tr>}</tbody>
      </table>
    </div>
  </section>;
}