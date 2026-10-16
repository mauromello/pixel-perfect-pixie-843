import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { aplicarMetodologia, balancoAlimentador, balancoSubestacao, type Alimentador, type Subestacao } from "@/lib/calculationEngine";
import { useRede } from "@/lib/network-store";

const f1 = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export function GraficoAlimentador({ se, al }: { se: Subestacao; al: Alimentador }) {
  const metodologia = useRede((s) => s.metodologia);
  const b = balancoAlimentador(al);
  const m = aplicarMetodologia(b, metodologia, se.alvoPT, se.alvoPNT);
  const data = [
    { nome: "Entrada disjuntor", v: al.entradaDisjuntor },
    { nome: "Geração GD (export.)", v: b.geracaoEmbutida },
    { nome: "Importações clientes", v: b.fornecida.total },
    { nome: "Export. fronteira", v: al.exportacaoFronteira },
    { nome: "Perda técnica", v: m.pt },
    { nome: "Perda não técnica", v: m.pnt },
  ];
  return (
    <div className="panel">
      <div className="panel-h">
        Balanço do Alimentador {al.cod}
        <span className="text-xs font-normal text-muted-foreground">{metodologia === "fisico" ? "Físico real" : "Regulatório PRORET"}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3 text-xs md:grid-cols-4">
        <div><div className="text-muted-foreground">L_f (perda total)</div><div className="kpi">{f1(b.lTotal)}</div></div>
        <div><div className="text-muted-foreground">Perda técnica</div><div className="kpi">{f1(m.pt)}</div></div>
        <div><div className="text-muted-foreground">Perda não técnica</div><div className="kpi">{f1(m.pnt)}</div></div>
        <div><div className="text-muted-foreground">Exposição (Real − Reg.)</div><div className={`kpi ${m.exposicao > 0 ? "text-destructive" : ""}`}>{metodologia === "fisico" ? "—" : f1(m.exposicao)}</div></div>
      </div>
      <div className="h-60 px-3 pb-3">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="nome" fontSize={10} interval={0} />
            <YAxis fontSize={11} />
            <Tooltip formatter={(v: number) => `${f1(v)} MWh`} />
            <Legend />
            <Bar dataKey="v" name="MWh" fill="var(--chart-1)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function PainelBalancoFisico() {
  const { subestacoes, metodologia, setMetodologia } = useRede();
  return (
    <div className="panel overflow-auto">
      <div className="panel-h">
        Balanço Físico por Nível Hierárquico
        <label className="flex items-center gap-2 text-xs font-normal">
          Metodologia de Cálculo
          <select className="inp" value={metodologia} onChange={(e) => setMetodologia(e.target.value as typeof metodologia)}>
            <option value="fisico">A — Balanço Físico Real (Operacional)</option>
            <option value="regulatorio">B — Cálculo Regulatório (PRODIST/ANEEL)</option>
          </select>
        </label>
      </div>
      <table className="tbl">
        <thead><tr><th>Elemento</th><th>Entrada líq.</th><th>Fornecida</th><th>Perda total</th><th>PT</th><th>PNT</th><th>Exposição</th></tr></thead>
        <tbody>
          {subestacoes.map((se) => {
            const bs = balancoSubestacao(se);
            return [
              <tr key={se.id} className="bg-muted/40 font-semibold">
                <td>{se.nome}</td><td>{f1(se.entradaAT + se.geracaoLocal)}</td><td>{f1(bs.saidaMT)} (saída MT)</td><td>{f1(bs.lTotal)}</td><td colSpan={3} className="text-xs font-normal text-muted-foreground">Alvos PRORET: PT {se.alvoPT}% · PNT {se.alvoPNT}%</td>
              </tr>,
              ...se.alimentadores.map((al) => {
                const b = balancoAlimentador(al);
                const m = aplicarMetodologia(b, metodologia, se.alvoPT, se.alvoPNT);
                return (
                  <tr key={al.id}>
                    <td className="pl-6">{al.cod}</td><td>{f1(b.entradaLiquida)}</td><td>{f1(b.fornecida.total)}</td><td>{f1(b.lTotal)}</td><td>{f1(m.pt)}</td><td>{f1(m.pnt)}</td>
                    <td className={m.exposicao > 0 ? "text-destructive" : ""}>{metodologia === "fisico" ? "—" : f1(m.exposicao)}</td>
                  </tr>
                );
              }),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
