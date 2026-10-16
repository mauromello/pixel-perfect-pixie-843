import { Link, Outlet, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowRightLeft, Calculator, BrainCircuit, LogOut, Map, Network, Scale, Settings, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { nomePerfil, podeAcessar, type Area } from "@/lib/permissoes";
import { IDIOMAS, useIdioma, useT } from "@/lib/i18n";

const itens = [
  { to: "/", label: "Balanço Energético", icon: Scale, area: "balanco" },
  { to: "/manobras", label: "Simulação de Manobras", icon: ArrowRightLeft, area: "manobras" },
  { to: "/metodologia", label: "Metodologia e Cálculo", icon: Calculator, area: "metodologia" },
  { to: "/rede", label: "Gestão do Modelo de Rede", icon: Network, area: "rede" },
  { to: "/projecao", label: "Projeção e Simulação", icon: Activity, area: "projecao" },
  { to: "/mapas", label: "Mapas Geoespaciais", icon: Map, area: "mapas" },
  { to: "/ia", label: "IA, ML e Data Lake", icon: BrainCircuit, area: "ia" },
  { to: "/admin", label: "Configurações e Segurança", icon: Settings, area: "admin" },
] as const satisfies readonly { to: string; label: string; icon: unknown; area: Area }[];

const rotaAuth = getRouteApi("/_authenticated");

export function AppShell() {
  const { sessao } = rotaAuth.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const t = useT();
  const { idioma, setIdioma } = useIdioma();

  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-sidebar-primary text-sidebar-primary-foreground">
            <Zap size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold text-sidebar-accent-foreground">PerdaZero</div>
            <div className="text-[11px] opacity-70">{t("Combate a Perdas")}</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {itens.filter((i) => podeAcessar(sessao.perfis, i.area)).map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: true }}
              className="flex items-center gap-2.5 rounded px-3 py-2 text-sm hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary" }}
            >
              <Icon size={16} />
              {t(label)}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3 text-xs">
          <div className="truncate font-medium text-sidebar-accent-foreground">{sessao.nome}</div>
          <div className="truncate opacity-70">{sessao.perfis.map((p) => t(nomePerfil(p))).join(", ") || t("Sem perfil")}</div>
          <button className="mt-2 flex items-center gap-1.5 rounded px-2 py-1 hover:bg-sidebar-accent" onClick={sair}>
            <LogOut size={13} /> {t("Sair")}
          </button>
          <div className="mt-2 flex items-center gap-1" aria-label={t("Idioma")}>
            {IDIOMAS.map((i) => (
              <button key={i.id} onClick={() => setIdioma(i.id)} className={`rounded px-2 py-0.5 text-[11px] ${idioma === i.id ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"}`}>
                {i.rotulo}
              </button>
            ))}
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  const t = useT();
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-card px-6 py-4">
      <div>
        <h1 className="text-xl font-semibold">{t(title)}</h1>
        <p className="text-sm text-muted-foreground">{t(subtitle)}</p>
      </div>
      <div className="flex gap-2">{children}</div>
    </header>
  );
}
