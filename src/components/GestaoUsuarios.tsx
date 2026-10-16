import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldCheck, Users } from "lucide-react";
import { getRouteApi } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { MATRIZ, PERFIS, type Area, type Perfil } from "@/lib/permissoes";

const rotaAuth = getRouteApi("/_authenticated");
const AREAS: { id: Area; nome: string }[] = [
  { id: "balanco", nome: "Balanço" }, { id: "rede", nome: "Modelo de Rede" }, { id: "projecao", nome: "Projeção" },
  { id: "mapas", nome: "Mapas" }, { id: "ia", nome: "IA / Data Lake" }, { id: "admin", nome: "Administração" },
];

type Linha = { id: string; nome: string; email: string; unidade: string; ativo: boolean; ultimo_acesso: string | null; perfil: Perfil };

async function listar(): Promise<Linha[]> {
  const [{ data: ps, error }, { data: rs }] = await Promise.all([
    supabase.from("profiles").select("id, nome, email, unidade, ativo, ultimo_acesso").order("nome"),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  if (error) throw error;
  return (ps ?? []).map((p) => ({ ...p, perfil: ((rs ?? []).find((r) => r.user_id === p.id)?.role ?? "consulta") as Perfil }));
}

export function GestaoUsuarios() {
  const { sessao } = rotaAuth.useRouteContext();
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const { data: usuarios = [], isLoading } = useQuery({ queryKey: ["usuarios"], queryFn: listar });

  const mut = useMutation({
    mutationFn: async (fn: () => Promise<{ error: unknown }>) => {
      const { error } = await fn();
      if (error) throw error;
    },
    onSuccess: () => { setErro(null); qc.invalidateQueries({ queryKey: ["usuarios"] }); },
    onError: () => setErro("Não foi possível salvar a alteração."),
  });

  const mudarPerfil = (id: string, role: Perfil) => mut.mutate(async () => {
    const del = await supabase.from("user_roles").delete().eq("user_id", id);
    if (del.error) return del;
    return supabase.from("user_roles").insert({ user_id: id, role });
  });
  const atualizar = (id: string, campos: { ativo?: boolean; unidade?: string }) =>
    mut.mutate(async () => supabase.from("profiles").update(campos).eq("id", id));

  const lista = usuarios.filter((u) => (u.nome + u.email + u.unidade).toLowerCase().includes(filtro.toLowerCase()));

  return (
    <>
      <div className="panel overflow-auto xl:col-span-2">
        <div className="panel-h">
          <span className="flex items-center gap-2"><Users size={14} /> Usuários do sistema</span>
          <span className="text-xs font-normal text-muted-foreground">{usuarios.length} cadastrados · {usuarios.filter((u) => u.ativo).length} ativos</span>
        </div>
        <div className="flex items-center gap-3 p-3">
          <input className="inp w-72" placeholder="Filtrar por nome, e-mail ou unidade…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          {erro && <span className="text-sm text-destructive">{erro}</span>}
        </div>
        <table className="tbl">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Unidade</th><th>Perfil</th><th>Último acesso</th><th>Estado</th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="text-muted-foreground">Carregando…</td></tr>}
            {lista.map((u) => {
              const eu = u.id === sessao.id;
              return (
                <tr key={u.id}>
                  <td>{u.nome}{eu && <span className="ml-1 text-xs text-muted-foreground">(você)</span>}</td>
                  <td className="font-mono text-xs">{u.email}</td>
                  <td><input className="inp w-32" defaultValue={u.unidade} onBlur={(e) => e.target.value !== u.unidade && atualizar(u.id, { unidade: e.target.value })} /></td>
                  <td>
                    <select className="inp" value={u.perfil} disabled={eu} onChange={(e) => mudarPerfil(u.id, e.target.value as Perfil)}>
                      {PERFIS.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </td>
                  <td className="text-xs">{u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleString("pt-BR") : "—"}</td>
                  <td>
                    <button disabled={eu} className={`badge ${u.ativo ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`} onClick={() => atualizar(u.id, { ativo: !u.ativo })}>
                      {u.ativo ? "Ativo" : "Bloqueado"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="p-3 text-xs text-muted-foreground">Novos usuários solicitam acesso na tela de login e entram como Consulta. Bloquear um usuário encerra o acesso dele na próxima navegação.</p>
      </div>

      <div className="panel overflow-auto xl:col-span-2">
        <div className="panel-h"><span className="flex items-center gap-2"><ShieldCheck size={14} /> Perfis de Acesso</span></div>
        <table className="tbl">
          <thead><tr><th>Perfil</th><th>Descrição</th><th>Usuários</th>{AREAS.map((a) => <th key={a.id}>{a.nome}</th>)}</tr></thead>
          <tbody>{PERFIS.map((p) => (
            <tr key={p.id}>
              <td className="font-medium">{p.nome}</td><td className="text-xs">{p.descricao}</td>
              <td className="font-mono">{usuarios.filter((u) => u.perfil === p.id).length}</td>
              {AREAS.map((a) => {
                const ok = MATRIZ[p.id].includes(a.id);
                return <td key={a.id}><span className={`badge ${ok ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>{ok ? "Acesso" : "—"}</span></td>;
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
