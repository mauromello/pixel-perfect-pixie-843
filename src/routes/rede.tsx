import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { GraficoAlimentador } from "@/components/BalancoFisico";
import type { TipoCliente } from "@/lib/calculationEngine";
import { useRede } from "@/lib/network-store";

export const Route = createFileRoute("/rede")({
  head: () => ({
    meta: [
      { title: "Gestão do Modelo de Rede — PerdaZero" },
      { name: "description", content: "Edite topologia, condutores, transformadores, clientes e geração distribuída." },
      { property: "og:title", content: "Gestão do Modelo de Rede — PerdaZero" },
      { property: "og:description", content: "Topologia e parâmetros técnicos da rede de distribuição." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RedePage,
});

type Sel = { tipo: "se" | "al" | "tr"; id: string };
const tipoLabel: Record<TipoCliente, string> = { cativo: "Cativo", livre: "Livre (ACL)", gd: "GD" };

function Num({ label, value, onChange, unit }: { label: string; value: number; onChange: (n: number) => void; unit: string }) {
  return (
    <label className="block text-xs text-muted-foreground">
      {label} <span className="opacity-70">({unit})</span>
      <input className="inp mt-1 w-full font-mono text-foreground" type="number" step="any" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function RedePage() {
  const st = useRede();
  const [sel, setSel] = useState<Sel>({ tipo: "al", id: st.subestacoes[0]?.alimentadores[0]?.id ?? "" });
  const [novo, setNovo] = useState({ nome: "", tipo: "gd" as TipoCliente, importacao: 10, exportacao: 50, trId: "" });

  const se = st.subestacoes.find((s) => s.id === sel.id || s.alimentadores.some((a) => a.id === sel.id || a.trafos.some((t) => t.id === sel.id)))!;
  const al = se.alimentadores.find((a) => a.id === sel.id || a.trafos.some((t) => t.id === sel.id));
  const tr = al?.trafos.find((t) => t.id === sel.id);
  const item = (s: Sel, nome: string, tipo: string, depth: number) => (
    <div key={s.id} onClick={() => setSel(s)} style={{ paddingLeft: depth * 14 + 6 }}
      className={`flex cursor-pointer items-center rounded py-1 pr-2 text-sm hover:bg-muted ${sel.id === s.id ? "bg-secondary font-semibold text-primary" : ""}`}>
      <span className="truncate">{nome}</span><span className="ml-auto text-[10px] uppercase text-muted-foreground">{tipo}</span>
    </div>
  );

  return (
    <div>
      <PageHeader title="Gestão do Modelo de Rede" subtitle="Topologia Subestação → Alimentador → Transformador → Instalação e parâmetros técnicos" />
      <div className="grid gap-4 p-6 lg:grid-cols-[300px_1fr]">
        <div className="panel max-h-[720px] overflow-auto">
          <div className="panel-h">Topologia</div>
          <div className="p-2">
            {st.subestacoes.map((s) => [
              item({ tipo: "se", id: s.id }, s.nome, "SE", 0),
              ...s.alimentadores.map((a) => [
                item({ tipo: "al", id: a.id }, a.cod, "Alim.", 1),
                ...a.trafos.map((t) => [
                  item({ tipo: "tr", id: t.id }, t.nome, "Trafo", 2),
                  ...t.clientes.map((c) => (
                    <div key={c.id} className="flex py-0.5 pr-2 text-xs text-muted-foreground" style={{ paddingLeft: 3 * 14 + 6 }}>
                      <span className="truncate">{c.nome}</span><span className="ml-auto">{tipoLabel[c.tipo]}</span>
                    </div>
                  )),
                ]),
              ]),
            ])}
          </div>
        </div>

        <div className="space-y-4">
          {sel.tipo === "se" && (
            <div className="panel">
              <div className="panel-h">Subestação — {se.nome}</div>
              <div className="grid gap-3 p-4 md:grid-cols-3">
                <Num label="Entrada AT líquida" unit="MWh" value={se.entradaAT} onChange={(v) => st.updSubestacao(se.id, { entradaAT: v })} />
                <Num label="Geração local" unit="MWh" value={se.geracaoLocal} onChange={(v) => st.updSubestacao(se.id, { geracaoLocal: v })} />
                <Num label="Serviço auxiliar" unit="MWh" value={se.servicoAuxiliar} onChange={(v) => st.updSubestacao(se.id, { servicoAuxiliar: v })} />
                <Num label="Alvo regulatório PT" unit="%" value={se.alvoPT} onChange={(v) => st.updSubestacao(se.id, { alvoPT: v })} />
                <Num label="Alvo regulatório PNT" unit="%" value={se.alvoPNT} onChange={(v) => st.updSubestacao(se.id, { alvoPNT: v })} />
              </div>
            </div>
          )}

          {al && sel.tipo === "al" && (
            <>
              <div className="panel">
                <div className="panel-h">Alimentador {al.cod} — Medições e Condutor</div>
                <div className="grid gap-3 p-4 md:grid-cols-4">
                  <Num label="Entrada disjuntor" unit="MWh" value={al.entradaDisjuntor} onChange={(v) => st.updAlimentador(al.id, { entradaDisjuntor: v })} />
                  <Num label="Export. fronteira jusante" unit="MWh" value={al.exportacaoFronteira} onChange={(v) => st.updAlimentador(al.id, { exportacaoFronteira: v })} />
                  <Num label="Uso interno" unit="MWh" value={al.usoInterno} onChange={(v) => st.updAlimentador(al.id, { usoInterno: v })} />
                  <Num label="Iluminação pública" unit="MWh" value={al.iluminacaoPublica} onChange={(v) => st.updAlimentador(al.id, { iluminacaoPublica: v })} />
                  <Num label="Resistência R" unit="Ω/km" value={al.condutor.r} onChange={(v) => st.updCondutor(al.id, { r: v })} />
                  <Num label="Comprimento" unit="km" value={al.condutor.comprimento} onChange={(v) => st.updCondutor(al.id, { comprimento: v })} />
                  <Num label="Corrente I" unit="A" value={al.condutor.corrente} onChange={(v) => st.updCondutor(al.id, { corrente: v })} />
                </div>
              </div>
              <div className="panel overflow-auto">
                <div className="panel-h">Clientes e Geração Distribuída do Alimentador</div>
                <table className="tbl">
                  <thead><tr><th>Cliente</th><th>Tipo</th><th>Trafo</th><th>Importação (MWh)</th><th>Exportação (MWh)</th><th></th></tr></thead>
                  <tbody>
                    {al.trafos.flatMap((t) => t.clientes.map((c) => (
                      <tr key={c.id}>
                        <td>{c.nome}</td><td>{tipoLabel[c.tipo]}</td><td>{t.nome}</td><td className="font-mono">{c.importacao}</td><td className="font-mono">{c.tipo === "gd" ? c.exportacao : "—"}</td>
                        <td><button className="btn text-xs" aria-label="Remover cliente" onClick={() => st.removeCliente(t.id, c.id)}><Trash2 size={13} /></button></td>
                      </tr>
                    )))}
                    <tr>
                      <td><input className="inp w-full" placeholder="Nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></td>
                      <td><select className="inp" value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value as TipoCliente })}>
                        <option value="cativo">Cativo</option><option value="livre">Livre (ACL)</option><option value="gd">GD</option>
                      </select></td>
                      <td><select className="inp" value={novo.trId || al.trafos[0]?.id} onChange={(e) => setNovo({ ...novo, trId: e.target.value })}>
                        {al.trafos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                      </select></td>
                      <td><input className="inp w-24 font-mono" type="number" value={novo.importacao} onChange={(e) => setNovo({ ...novo, importacao: Number(e.target.value) })} /></td>
                      <td><input className="inp w-24 font-mono" type="number" disabled={novo.tipo !== "gd"} value={novo.tipo === "gd" ? novo.exportacao : 0} onChange={(e) => setNovo({ ...novo, exportacao: Number(e.target.value) })} /></td>
                      <td><button className="btn-primary text-xs" onClick={() => {
                        const trId = novo.trId && al.trafos.some((t) => t.id === novo.trId) ? novo.trId : al.trafos[0]?.id;
                        if (!trId) return;
                        st.addCliente(trId, { nome: novo.nome || `${tipoLabel[novo.tipo]} novo`, tipo: novo.tipo, importacao: novo.importacao, exportacao: novo.tipo === "gd" ? novo.exportacao : 0 });
                        setNovo({ ...novo, nome: "" });
                      }}><Plus size={13} /> Adicionar</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tr && (
            <div className="panel">
              <div className="panel-h">Transformador {tr.nome}</div>
              <div className="grid gap-3 p-4 md:grid-cols-3">
                <Num label="Perda no núcleo P0" unit="kW" value={tr.p0} onChange={(v) => st.updTrafo(tr.id, { p0: v })} />
                <Num label="Perda no cobre Pcu" unit="kW" value={tr.pcu} onChange={(v) => st.updTrafo(tr.id, { pcu: v })} />
                <Num label="Potência nominal Srated" unit="kVA" value={tr.srated} onChange={(v) => st.updTrafo(tr.id, { srated: v })} />
              </div>
            </div>
          )}

          {al ? <GraficoAlimentador se={se} al={al} /> : se.alimentadores.map((a) => <GraficoAlimentador key={a.id} se={se} al={a} />)}
        </div>
      </div>
    </div>
  );
}
