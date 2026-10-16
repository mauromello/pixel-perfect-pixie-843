import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { areaDoCaminho, podeAcessar } from "@/lib/permissoes";
import { carregarSessao } from "@/lib/sessao";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const sessao = await carregarSessao();
    if (!sessao) throw redirect({ to: "/login", search: { redirect: location.href } });
    if (!sessao.ativo) {
      await supabase.auth.signOut();
      throw redirect({ to: "/login", search: { bloqueado: 1 } });
    }
    if (!podeAcessar(sessao.perfis, areaDoCaminho(location.pathname))) throw redirect({ to: "/" });
    return { sessao };
  },
  component: AppShell,
});
