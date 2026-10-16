import { Layers } from "lucide-react";
import { perdasPorNivel } from "@/lib/calculationEngine";
import { useRede } from "@/lib/network-store";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** Perdas técnicas segregadas por nível de tensão (AT / MT / BT), calculadas do modelo de rede. */
export function PerdasNiveis() {
  const ses = useRede((s) => s.subestacoes);
  return (
    <div className="panel overflow-auto">
      <div className="panel-h"><span className="flex items-center gap-2"><Layers size={14} /> Perdas por Nível de Tensão (PRORET Mód. 7)</span></div>
      <table className="tbl">
        <thead><tr><th>Subestação</th><th>Tensões</th><th>AT — transformação SE</th><th>MT — condutores</th><th>BT — trafos distribuição</th><th>Total técnica</th></tr></thead>
        <tbody>{ses.map((s) => {
          const p = perdasPorNivel(s);
          return (
            <tr key={s.id}><td className="font-medium">{s.nome}</td><td className="font-mono">{s.tensaoATkV} / {[...new Set(s.alimentadores.map((a) => a.tensaoKV))].join(", ")} kV</td>
              <td className="font-mono">{fmt(p.at)}</td><td className="font-mono">{fmt(p.mt)}</td><td className="font-mono">{fmt(p.bt)}</td><td className="font-mono font-semibold">{fmt(p.total)} MWh</td></tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}
