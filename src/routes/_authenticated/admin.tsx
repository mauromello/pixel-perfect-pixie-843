import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { dicionario } from "@/lib/mock-data";
import { GestaoUsuarios } from "@/components/GestaoUsuarios";
import { ControleLogin } from "@/components/ControleLogin";

export const Route = createFileRoute("/_authenticated/admin")({
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
  const grupos = [...new Set(dicionario.map((d) => d.grupo))];

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
        <div className="panel overflow-auto">
          <div className="panel-h">Dicionário de Dados</div>
          <table className="tbl">
            <thead><tr><th>Variável</th><th>Tipo</th><th>Nível</th><th>Origem</th><th>Descrição</th></tr></thead>
            <tbody>{grupos.map((g) => [
              <tr key={g}><td colSpan={5} className="bg-muted text-xs font-semibold uppercase text-muted-foreground">{g}</td></tr>,
              ...dicionario.filter((d) => d.grupo === g).map((d) => (
                <tr key={d.variavel}><td className="font-mono text-primary">{d.variavel}</td><td className="font-mono text-xs">{d.tipo}</td><td>{d.nivel}</td><td>{d.origem}</td><td>{d.descricao}</td></tr>
              )),
            ])}</tbody>
          </table>
        </div>

        <ControleLogin />
        <GestaoUsuarios />
      </div>
    </div>
  );
}
