import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DicionarioDados } from "@/components/DicionarioDados";
import { dicionarioQuery } from "@/lib/dicionarioDados";
import { GestaoUsuarios } from "@/components/GestaoUsuarios";
import { ControleLogin } from "@/components/ControleLogin";

export const Route = createFileRoute("/_authenticated/admin")({
  loader: async ({ context }) => { await context.queryClient.ensureQueryData(dicionarioQuery(context.sessao.id)); },
  head: () => ({
    meta: [
      { title: "Configurações, Dicionário e Segurança — PerdaZero" },
      { name: "description", content: "Dicionário de dados do modelo de rede, gestão de utilizadores e perfis integrados ao Active Directory." },
      { property: "og:title", content: "Configurações, Dicionário e Segurança — PerdaZero" },
      { property: "og:description", content: "Documentação das variáveis e controlo de acessos via Active Directory." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const hierarquia = ["Distribuidora", "Regional", "Município", "Subestação (SE)", "Alimentador", "Religador", "Transformador", "Medidor", "Instalação (UC)"];

function AdminPage() {
  return (
    <div>
      <PageHeader title="Configurações, Dicionário de Dados e Segurança" subtitle="Documentação do modelo de rede elétrica e controlo de acessos" />
      <div className="grid gap-4 p-6 xl:grid-cols-[260px_1fr]">
        <div className="panel">
          <div className="panel-h">Modelo de Rede Elétrica</div>
          <ol className="p-4 text-sm">
            {hierarquia.map((h, i) => (
              <li key={h} className="flex items-center gap-2 py-1" style={{ paddingLeft: i * 8 }}>
                <span className="flex h-5 w-5 items-center justify-center rounded bg-secondary font-mono text-[10px]">{i}</span>{h}
              </li>
            ))}
          </ol>
        </div>
        <DicionarioDados />

        <ControleLogin />
        <GestaoUsuarios />
      </div>
    </div>
  );
}
