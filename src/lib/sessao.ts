import { supabase } from "@/integrations/supabase/client";
import type { Perfil } from "@/lib/permissoes";

export type Sessao = { id: string; email: string; nome: string; ativo: boolean; perfis: Perfil[] };

export async function carregarSessao(): Promise<Sessao | null> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const [{ data: perfil }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("nome, email, ativo").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  return {
    id: user.id,
    email: user.email ?? perfil?.email ?? "",
    nome: perfil?.nome || user.email || "",
    ativo: perfil?.ativo ?? true,
    perfis: (roles ?? []).map((r) => r.role as Perfil),
  };
}
