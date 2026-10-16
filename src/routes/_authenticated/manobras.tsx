import { Link, createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Manobras } from "@/components/Manobras";

export const Route = createFileRoute("/_authenticated/manobras")({
  head: () => ({
    meta: [
      { title: "Simulação de Manobras — PerdaZero" },
      { name: "description", content: "Registo e simulação de manobras na rede com recálculo do balanço energético." },
      { property: "og:title", content: "Simulação de Manobras — PerdaZero" },
      { property: "og:description", content: "Transferência de carga entre alimentadores validada pelo modelo de rede." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManobrasPage,
});

function ManobrasPage() {
  return (
    <div>
      <PageHeader title="Simulação de Manobras" subtitle="Feche uma chave de interligação e abra uma seccionadora para transferir carga entre alimentadores">
        <Link to="/mapas" className="btn">Ver no mapa</Link>
        <Link to="/" className="btn">Ver balanço</Link>
      </PageHeader>
      <div className="p-6"><Manobras /></div>
    </div>
  );
}
