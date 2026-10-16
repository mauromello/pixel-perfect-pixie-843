import { useState } from "react";
import { ArrowRightLeft, Calculator } from "lucide-react";
import { alimentadoresManobra, chavesManobra } from "@/lib/mock-data";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
type Reg = { id: number; chave: string; origem: string; destino: string; carga: number; horas: number; energia: number; periodo: string };

export function Manobras() {
  const [chave, setChave] = useState(chavesManobra[0]!);
  const [origem, setOrigem] = useState("TAQ-AL01");
  const [destino, setDestino] = useState("NEV-AL01");
  const [carga, setCarga] = useState(2.5);
  const [unid, setUnid] = useState<"MW" | "kW">("MW");
  const [inicio, setInicio] = useState("2026-10-10T08:00");
  const [fim, setFim] = useState("2026-10-12T20:00");
  const [regs, setRegs] = useState<Reg[]>([]);
  const [erro, setErro] = useState("");

  // energia transferida acumulada por alimentador (MWh, positivo = recebeu)
  const delta: Record<string, number> = {};
  for (const r of regs) {
    delta[r.origem] = (delta[r.origem] ?? 0) - r.energia;
    delta[r.destino] = (delta[r.destino] ?? 0) + r.energia;
  }
  const envolvidos = new Set(regs.flatMap((r) => [r.origem, r.destino]));
  const linhas = alimentadoresManobra.map((a) => {
    const d = delta[a.cod] ?? 0;
    // a carga transferida também leva o faturamento dos clientes atendidos (≈ 88%)
    const fat = a.faturada + d * 0.88;
    return { ...a, d, inj2: a.injetada + d, fat2: fat, perdaAntes: ((a.injetada - a.faturada) / a.injetada) * 100, perdaDepois: ((a.injetada + d - fat) / (a.injetada + d)) * 100 };
  });
  const ses = [...new Set(alimentadoresManobra.map((a) => a.se))].map((se) => {
    const ls = linhas.filter((l) => l.se === se);
    const antes = ls.reduce((s, l) => s + l.injetada, 0);
    const depois = ls.reduce((s, l) => s + l.inj2, 0);
    return { se, antes, depois, sub: ls.reduce((s, l) => s + l.inj2 - l.fat2, 0), afetada: ls.some((l) => envolvidos.has(l.cod)) };
  });

  const recalcular = () => {
    setErro("");
    const horas = (new Date(fim).getTime() - new Date(inicio).getTime()) / 3_600_000;
    if (origem === destino) return setErro("Origem e destino devem ser alimentadores diferentes.");
    if (!(horas > 0)) return setErro("O fim da manobra deve ser depois do início.");
    if (!(carga > 0)) return setErro("Indique uma carga transferida maior que zero.");
    const mw = unid === "MW" ? carga : carga / 1000;
    setRegs([{ id: Date.now(), chave, origem, destino, carga: mw, horas, energia: mw * horas, periodo: `${new Date(inicio).toLocaleString("pt-BR")} → ${new Date(fim).toLocaleString("pt-BR")}` }, ...regs]);
  };

  return (
    <div className="panel">
      <div className="panel-h"><span className="flex items-center gap-2"><ArrowRightLeft size={14} /> Registo e Simulação de Manobras na Rede</span><span className="text-xs font-normal text-muted-foreground">Energia manobrada e alteração de topologia</span></div>
      <div className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
        <label className="text-xs text-muted-foreground">Chave de Seccionamento / Religador
          <select className="inp mt-1 w-full" value={chave} onChange={(e) => setChave(e.target.value)}>{chavesManobra.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="text-xs text-muted-foreground">Alimentador de Origem
          <select className="inp mt-1 w-full" value={origem} onChange={(e) => setOrigem(e.target.value)}>{alimentadoresManobra.map((a) => <option key={a.cod} value={a.cod}>{a.cod} ({a.se})</option>)}</select></label>
        <label className="text-xs text-muted-foreground">Alimentador de Destino
          <select className="inp mt-1 w-full" value={destino} onChange={(e) => setDestino(e.target.value)}>{alimentadoresManobra.map((a) => <option key={a.cod} value={a.cod}>{a.cod} ({a.se})</option>)}</select></label>
        <label className="text-xs text-muted-foreground">Carga Transferida
          <div className="mt-1 flex gap-1">
            <input className="inp w-full font-mono" type="number" step="0.1" value={carga} onChange={(e) => setCarga(Number(e.target.value))} />
            <select className="inp" value={unid} onChange={(e) => setUnid(e.target.value as "MW" | "kW")}><option>MW</option><option>kW</option></select>
          </div></label>
        <label className="text-xs text-muted-foreground">Início da Manobra
          <input className="inp mt-1 w-full" type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>
        <label className="text-xs text-muted-foreground">Fim da Manobra
          <input className="inp mt-1 w-full" type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
        <button className="btn-primary" onClick={recalcular}><Calculator size={14} /> Recalcular Equação de Balanço</button>
        {regs.length > 0 && <button className="btn" onClick={() => setRegs([])}>Desfazer todas as manobras</button>}
        {erro && <span className="text-sm text-destructive">{erro}</span>}
        <span className="ml-auto font-mono text-xs text-muted-foreground">E<sub>inj</sub>' = E<sub>inj</sub> ± Σ (carga × duração)</span>
      </div>

      <div className="grid gap-4 border-t border-border p-4 xl:grid-cols-[1fr_380px]">
        <div className="overflow-auto">
          <table className="tbl">
            <thead><tr><th>Alimentador</th><th>SE</th><th>Injetada antes</th><th>Energia manobrada</th><th>Injetada após</th><th>Perda antes</th><th>Perda após</th></tr></thead>
            <tbody>{linhas.map((l) => (
              <tr key={l.cod} className={envolvidos.has(l.cod) ? "bg-warning/10" : ""}>
                <td className="font-medium">{l.cod}</td><td>{l.se}</td>
                <td className="font-mono">{fmt(l.injetada)}</td>
                <td className={`font-mono ${l.d > 0 ? "text-success" : l.d < 0 ? "text-destructive" : "text-muted-foreground"}`}>{l.d === 0 ? "—" : (l.d > 0 ? "+" : "") + fmt(l.d)}</td>
                <td className="font-mono font-semibold">{fmt(l.inj2)}</td>
                <td className="font-mono">{l.perdaAntes.toFixed(2)}%</td>
                <td className="font-mono font-semibold">{l.perdaDepois.toFixed(2)}%</td>
              </tr>
            ))}</tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">Valores em MWh no ciclo. Linhas destacadas foram afetadas pelas manobras registadas.</p>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">Sub-balanço por Subestação</div>
          {ses.map((s) => (
            <div key={s.se} className={`rounded border px-3 py-2 text-sm ${s.afetada ? "border-warning bg-warning/10" : "border-border"}`}>
              <div className="flex justify-between font-medium"><span>{s.se}</span><span className="font-mono">{fmt(s.depois)} MWh</span></div>
              <div className="flex justify-between text-xs text-muted-foreground"><span>Antes: {fmt(s.antes)}</span><span>Sub-balanço (perdas): {fmt(s.sub)}</span></div>
            </div>
          ))}
        </div>
      </div>

      {regs.length > 0 && (
        <div className="overflow-auto border-t border-border">
          <table className="tbl">
            <thead><tr><th>Chave</th><th>Origem → Destino</th><th>Carga</th><th>Período</th><th>Duração</th><th>Energia manobrada</th></tr></thead>
            <tbody>{regs.map((r) => (
              <tr key={r.id}><td>{r.chave}</td><td>{r.origem} → {r.destino}</td><td className="font-mono">{fmt(r.carga)} MW</td><td className="text-xs">{r.periodo}</td><td className="font-mono">{fmt(r.horas)} h</td><td className="font-mono font-semibold">{fmt(r.energia)} MWh</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
