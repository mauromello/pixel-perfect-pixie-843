import { supabase } from "@/integrations/supabase/client";
import type { Sessao } from "@/lib/sessao";

export const SESSAO_AVALIADOR: Sessao = {
  id: "avaliador",
  email: "",
  nome: "Avaliador (sem login)",
  ativo: true,
  perfis: ["admin", "operador", "planejamento", "consulta"],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabela = () => (supabase as any).from("configuracao");

export async function exigeLogin(): Promise<boolean> {
  const { data } = await tabela().select("exigir_login").eq("id", 1).maybeSingle();
  return data?.exigir_login ?? true;
}

export async function definirExigeLogin(v: boolean): Promise<string | null> {
  const { error, data } = await tabela().update({ exigir_login: v, updated_at: new Date().toISOString() }).eq("id", 1).select();
  if (error) return error.message;
  if (!data?.length) return "Apenas administradores autenticados podem alterar.";
  return null;
}
