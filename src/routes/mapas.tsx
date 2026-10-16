import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const MapaView = lazy(() => import("@/components/MapaView"));

export const Route = createFileRoute("/mapas")({
  head: () => ({
    meta: [
      { title: "Mapas Geoespaciais — PerdaZero" },
      { name: "description", content: "Camadas temáticas de perdas, fraudes, inadimplência e mapeamento de rede." },
      { property: "og:title", content: "Mapas Geoespaciais — PerdaZero" },
      { property: "og:description", content: "Visualize áreas de perdas e a rede de distribuição de Minas Gerais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClientOnly fallback={<div className="p-6 text-sm text-muted-foreground">Carregando mapa…</div>}>
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando mapa…</div>}>
        <MapaView />
      </Suspense>
    </ClientOnly>
  ),
});
