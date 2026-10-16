import { useEffect, useRef, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Maximize2, ExternalLink } from "lucide-react";
import { SLIDES, type L } from "@/lib/guia";
import { useIdioma } from "@/lib/i18n";

type Modo = "ambos" | "uso" | "tecnico";

export const Route = createFileRoute("/_authenticated/guia")({
  validateSearch: (s: Record<string, unknown>) => ({ s: Math.max(0, Math.min(SLIDES.length - 1, Number(s["s"]) || 0)) }),
  head: () => ({
    meta: [
      { title: "Guide & Presentation — PerdaZero" },
      { name: "description", content: "Interactive training deck: how to use PerdaZero and how its calculations, algorithms and methodologies work." },
      { property: "og:title", content: "Guide & Presentation — PerdaZero" },
      { property: "og:description", content: "Usage guide plus technical deep dive, in English and Portuguese." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuiaPage,
});

function GuiaPage() {
  const { s } = Route.useSearch();
  const navigate = useNavigate({ from: "/guia" });
  const { idioma, setIdioma } = useIdioma();
  const en = idioma !== "pt-BR";
  const tx = (v: L) => (en ? v.en : v.pt);
  const [modo, setModo] = useState<Modo>("ambos");
  const ref = useRef<HTMLDivElement>(null);
  const toque = useRef<number | null>(null);
  const ir = (i: number) => navigate({ search: { s: Math.max(0, Math.min(SLIDES.length - 1, i)) }, replace: true });
  const slide = SLIDES[s] ?? SLIDES[0]!;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); ir(s + 1); }
      if (e.key === "ArrowLeft") ir(s - 1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  useEffect(() => { document.title = `${s + 1}/${SLIDES.length} — ${tx(slide.titulo)}`; }, [s, en]);

  const rot = {
    uso: en ? "How to use" : "Como usar",
    tec: en ? "Under the hood" : "Como funciona por trás",
    form: en ? "Formulas" : "Fórmulas",
    abrir: en ? "Open this screen" : "Abrir esta tela",
    modos: { ambos: en ? "Both" : "Ambos", uso: en ? "Usage" : "Uso", tecnico: en ? "Technical" : "Técnico" },
  };

  return (
    <div className="flex h-screen flex-col" data-sem-traducao>
      <div className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2 text-sm">
        <span className="font-semibold">{en ? "PerdaZero Training Deck" : "Apresentação de Treinamento PerdaZero"}</span>
        <div className="ml-auto flex items-center gap-1">
          {(["ambos", "uso", "tecnico"] as Modo[]).map((m) => (
            <button key={m} onClick={() => setModo(m)} className={`rounded px-2.5 py-1 ${modo === m ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{rot.modos[m]}</button>
          ))}
          <span className="mx-2 h-5 w-px bg-border" />
          <button onClick={() => setIdioma("en-US")} className={`rounded px-2 py-1 ${en ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>EN</button>
          <button onClick={() => setIdioma("pt-BR")} className={`rounded px-2 py-1 ${!en ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>PT</button>
          <button className="ml-2 rounded p-1.5 hover:bg-muted" aria-label="Fullscreen" onClick={() => ref.current?.requestFullscreen?.()}><Maximize2 size={16} /></button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <nav className="w-56 shrink-0 overflow-y-auto border-r bg-muted/30 p-2">
          {SLIDES.map((sl, i) => (
            <button key={sl.id} onClick={() => ir(i)} className={`mb-1 block w-full rounded px-2 py-1.5 text-left text-xs ${i === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {i + 1}. {tx(sl.titulo)}
            </button>
          ))}
        </nav>
        <div
          ref={ref}
          className="relative min-w-0 flex-1 overflow-y-auto bg-background"
          onTouchStart={(e) => (toque.current = e.touches[0]?.clientX ?? 0)}
          onTouchEnd={(e) => {
            if (toque.current == null) return;
            const dx = (e.changedTouches[0]?.clientX ?? 0) - toque.current;
            if (Math.abs(dx) > 50) ir(s + (dx < 0 ? 1 : -1));
            toque.current = null;
          }}
        >
          <article className="mx-auto max-w-6xl px-10 py-10">
            <div className="text-xs font-semibold uppercase tracking-widest text-primary">{s + 1} / {SLIDES.length}</div>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">{tx(slide.titulo)}</h1>
            <p className="mt-3 max-w-3xl text-lg text-muted-foreground">{tx(slide.resumo)}</p>
            <div className={`mt-8 grid gap-6 ${modo === "ambos" ? "lg:grid-cols-2" : ""}`}>
              {modo !== "tecnico" && (
                <section className="rounded-lg border bg-card p-6">
                  <h2 className="mb-3 text-lg font-semibold">{rot.uso}</h2>
                  <ul className="space-y-2.5 text-base">{slide.uso.map((b, i) => <li key={i} className="flex gap-2"><span className="text-primary">▸</span>{tx(b)}</li>)}</ul>
                  {slide.rota && (
                    <Link to={slide.rota as "/"} className="mt-5 inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"><ExternalLink size={14} />{rot.abrir}</Link>
                  )}
                </section>
              )}
              {modo !== "uso" && (
                <section className="rounded-lg border bg-card p-6">
                  <h2 className="mb-3 text-lg font-semibold">{rot.tec}</h2>
                  <ul className="space-y-2.5 text-base">{slide.tecnico.map((b, i) => <li key={i} className="flex gap-2"><span className="text-primary">◆</span>{tx(b)}</li>)}</ul>
                  {slide.formulas && (
                    <div className="mt-5">
                      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{rot.form}</h3>
                      <div className="space-y-2">
                        {slide.formulas.map((f, i) => (
                          <div key={i} className="rounded border bg-muted/40 px-3 py-2">
                            <code className="font-mono text-sm font-semibold">{f.f}</code>
                            <div className="text-xs text-muted-foreground">{tx(f.d)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>
            <div className="mt-10 flex items-center justify-between">
              <button disabled={s === 0} onClick={() => ir(s - 1)} className="btn inline-flex items-center gap-1 disabled:opacity-40"><ChevronLeft size={16} />{en ? "Previous" : "Anterior"}</button>
              <span className="text-xs text-muted-foreground">{en ? "Use ← → keys" : "Use as teclas ← →"}</span>
              <button disabled={s === SLIDES.length - 1} onClick={() => ir(s + 1)} className="btn inline-flex items-center gap-1 disabled:opacity-40">{en ? "Next" : "Próximo"}<ChevronRight size={16} /></button>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
