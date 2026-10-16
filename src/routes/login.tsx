import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

type Busca = { redirect?: string; bloqueado?: number };

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): Busca => ({
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") && !s.redirect.startsWith("//") ? s.redirect : undefined,
    bloqueado: s.bloqueado ? 1 : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — PerdaZero" },
      { name: "description", content: "Acesso restrito ao sistema de combate a perdas PerdaZero." },
      { property: "og:title", content: "Entrar — PerdaZero" },
      { property: "og:description", content: "Acesso restrito ao sistema de combate a perdas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const busca = Route.useSearch();
  const navigate = useNavigate();
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [msg, setMsg] = useState<string | null>(busca.bloqueado ? "Seu acesso está bloqueado. Procure o administrador." : null);
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setMsg(null);
    if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      setCarregando(false);
      if (error) return setMsg("E-mail ou senha inválidos.");
      await supabase.rpc("registrar_acesso");
      navigate({ to: busca.redirect ?? "/", replace: true });
    } else {
      const { error } = await supabase.auth.signUp({ email, password: senha, options: { data: { nome }, emailRedirectTo: window.location.origin } });
      setCarregando(false);
      if (error) return setMsg(error.message);
      setMsg("Cadastro criado. Confirme pelo link enviado ao seu e-mail e depois entre.");
      setModo("entrar");
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) return setMsg("Não foi possível entrar com Google.");
    if (r.redirected) return;
    await supabase.rpc("registrar_acesso");
    navigate({ to: busca.redirect ?? "/", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-4">
      <div className="panel w-full max-w-sm">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground"><Zap size={18} /></div>
          <div>
            <div className="font-semibold">PerdaZero</div>
            <div className="text-xs text-muted-foreground">Acesso restrito</div>
          </div>
        </div>
        <form onSubmit={enviar} className="flex flex-col gap-3 p-5">
          {modo === "cadastrar" && <input className="inp" placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} required />}
          <input className="inp" type="email" placeholder="E-mail corporativo" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="inp" type="password" placeholder="Senha" minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} required />
          {msg && <p className="text-sm text-destructive">{msg}</p>}
          <button className="btn justify-center bg-primary text-primary-foreground" disabled={carregando}>{modo === "entrar" ? "Entrar" : "Solicitar acesso"}</button>
          <button type="button" className="btn justify-center" onClick={google}>Entrar com Google</button>
          <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setModo(modo === "entrar" ? "cadastrar" : "entrar")}>
            {modo === "entrar" ? "Não tem conta? Solicitar acesso" : "Já tenho conta"}
          </button>
          <p className="text-[11px] text-muted-foreground">Novas contas entram com perfil Consulta até o administrador liberar outro perfil.</p>
        </form>
      </div>
    </div>
  );
}
