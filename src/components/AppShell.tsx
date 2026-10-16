import { Link, Outlet } from "@tanstack/react-router";
import { Activity, BrainCircuit, Map, Network, Scale, Settings, Zap } from "lucide-react";

const itens = [
  { to: "/", label: "Balanço e Manobras", icon: Scale },
  { to: "/rede", label: "Gestão do Modelo de Rede", icon: Network },
  { to: "/projecao", label: "Projeção e Simulação", icon: Activity },
  { to: "/mapas", label: "Mapas Geoespaciais", icon: Map },
  { to: "/ia", label: "IA, ML e Data Lake", icon: BrainCircuit },
  { to: "/admin", label: "Configurações e Segurança", icon: Settings },
] as const;

export function AppShell() {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-sidebar-primary text-sidebar-primary-foreground">
            <Zap size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold text-sidebar-accent-foreground">PerdaZero</div>
            <div className="text-[11px] opacity-70">Combate a Perdas</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {itens.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: true }}
              className="flex items-center gap-2.5 rounded px-3 py-2 text-sm hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary" }}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-[11px] opacity-60">Minas Gerais · Ciclo Out/2026</div>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-card px-6 py-4">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex gap-2">{children}</div>
    </header>
  );
}
