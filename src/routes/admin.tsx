import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { dicionario, perfis } from "@/lib/mock-data";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administração e Dicionário de Dados — PerdaZero" },
      { name: "description", content: "Dicionário de dados, hierarquia da rede para extração e controle de perfis de acesso." },
      { property: "og:title", content: "Administração e Dicionário de Dados — PerdaZero" },
      { property: "og:description", content: "Documentação das variáveis e controle de segurança e acessos." },
    ],
  }),
  component: AdminPage,
});

const hierarquia = ["Distribuidora", "Regional", "Município", "Subestação (SE)", "Alimentador", "Religador", "Transformador", "Medidor", "Instalação (UC)"];
const permCls = (p: string) => (p === "Editar" ? "bg-primary/15 text-primary" : p === "Ver" ? "bg-muted text-muted-foreground" : "text-muted-foreground");

function AdminPage() {
  return (
    <div>
      <PageHeader title="Administração e Dicionário de Dados" subtitle="Documentação estruturada e controle de acessos" />
      <div className="grid gap-4 p-6 xl:grid-cols-[260px_1fr]">
        <div className="panel">
          <div className="panel-h">Hierarquia da Rede para Extração</div>
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
            <tbody>{dicionario.map((d) => (
              <tr key={d.variavel}><td className="font-mono text-primary">{d.variavel}</td><td className="font-mono text-xs">{d.tipo}</td><td>{d.nivel}</td><td>{d.origem}</td><td>{d.descricao}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <div className="panel overflow-auto xl:col-span-2">
          <div className="panel-h"><span className="flex items-center gap-2"><ShieldCheck size={14} /> Segurança e Acessos — Perfis</span><span className="text-xs font-normal text-muted-foreground">MFA obrigatório · trilha de auditoria ativa</span></div>
          <table className="tbl">
            <thead><tr><th>Perfil</th><th>Usuários</th><th>Balanço</th><th>Projeção</th><th>Mapas</th><th>IA / Data Lake</th><th>Administração</th></tr></thead>
            <tbody>{perfis.map((p) => (
              <tr key={p.perfil}><td className="font-medium">{p.perfil}</td><td className="font-mono">{p.usuarios}</td>
                {[p.balanco, p.projecao, p.mapas, p.ia, p.admin].map((v, i) => <td key={i}><span className={`badge ${permCls(v)}`}>{v}</span></td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
