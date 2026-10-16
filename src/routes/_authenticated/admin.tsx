import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RefreshCw, ShieldCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { dicionario, perfis, usuariosAD } from "@/lib/mock-data";

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
const permCls = (p: string) => (p === "Editar" ? "bg-primary/15 text-primary" : p === "Ver" ? "bg-muted text-muted-foreground" : "text-muted-foreground");

function AdminPage() {
  const [usuarios, setUsuarios] = useState(usuariosAD);
  const [sync, setSync] = useState("16/10/2026 06:00");
  const [filtro, setFiltro] = useState("");
  const grupos = [...new Set(dicionario.map((d) => d.grupo))];
  const lista = usuarios.filter((u) => (u.nome + u.login + u.ou).toLowerCase().includes(filtro.toLowerCase()));

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

        <div className="panel overflow-auto xl:col-span-2">
          <div className="panel-h">
            <span className="flex items-center gap-2"><Users size={14} /> Utilizadores — Active Directory (corp.energiamg.local)</span>
            <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
              Última sincronização LDAP: {sync}
              <button className="btn text-xs" onClick={() => setSync(new Date().toLocaleString("pt-BR"))}><RefreshCw size={12} /> Sincronizar AD</button>
            </span>
          </div>
          <div className="p-3"><input className="inp w-72" placeholder="Filtrar por nome, login ou OU…" value={filtro} onChange={(e) => setFiltro(e.target.value)} /></div>
          <table className="tbl">
            <thead><tr><th>Login (sAMAccountName)</th><th>Nome</th><th>Unidade Organizacional</th><th>Perfil</th><th>Último acesso</th><th>Estado</th></tr></thead>
            <tbody>{lista.map((u) => {
              const upd = (p: Partial<typeof u>) => setUsuarios(usuarios.map((x) => (x.login === u.login ? { ...x, ...p } : x)));
              return (
                <tr key={u.login}>
                  <td className="font-mono">{u.login}</td><td>{u.nome}</td><td className="font-mono text-xs">{u.ou}</td>
                  <td><select className="inp" value={u.perfil} onChange={(e) => upd({ perfil: e.target.value })}>{perfis.map((p) => <option key={p.perfil}>{p.perfil}</option>)}</select></td>
                  <td className="text-xs">{u.ultimo}</td>
                  <td><button className={`badge ${u.ativo ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`} onClick={() => upd({ ativo: !u.ativo })}>{u.ativo ? "Ativo" : "Bloqueado"}</button></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>

        <div className="panel overflow-auto xl:col-span-2">
          <div className="panel-h"><span className="flex items-center gap-2"><ShieldCheck size={14} /> Perfis de Acesso</span><span className="text-xs font-normal text-muted-foreground">SSO via AD · MFA obrigatório · trilha de auditoria ativa</span></div>
          <table className="tbl">
            <thead><tr><th>Perfil</th><th>Grupo AD</th><th>Utilizadores</th><th>Balanço</th><th>Projeção</th><th>Mapas</th><th>IA / Data Lake</th><th>Administração</th></tr></thead>
            <tbody>{perfis.map((p) => (
              <tr key={p.perfil}><td className="font-medium">{p.perfil}</td><td className="font-mono text-xs">{p.grupoAD}</td><td className="font-mono">{usuarios.filter((u) => u.perfil === p.perfil).length + p.usuarios - usuariosAD.filter((u) => u.perfil === p.perfil).length}</td>
                {[p.balanco, p.projecao, p.mapas, p.ia, p.admin].map((v, i) => <td key={i}><span className={`badge ${permCls(v)}`}>{v}</span></td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
