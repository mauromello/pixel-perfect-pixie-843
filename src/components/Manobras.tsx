import { useMemo, useState } from "react";
import { ArrowRightLeft, RotateCcw, Zap } from "lucide-react";
import { balancoAlimentador, balancoSubestacao } from "@/lib/calculationEngine";
import { useRede } from "@/lib/network-store";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** Manobras restritas às chaves existentes no modelo de rede: fecha uma interligação NA e abre uma seccionadora. */
export function Manobras() {
  const { subestacoes, chaves, manobras, base, executarManobra, desfazerManobras } = useRede();
  const feeders = subestacoes.flatMap((s) => s.alimentadores.map((a) => ({ a, s })));
  const nomeAl = (id: string | undefined) => feeders.find((f) => f.a.id === id)?.a.cod ?? "—";
  const ties = chaves.filter((c) => c.alimentadorBId && c.aberta);
  const [tieId, setTieId] = useState("");
  const tie = ties.find((t) => t.id === tieId) ?? ties[0];
  const [origemId, setOrigemId] = useState("");
  const lados = tie ? [tie.alimentadorId, tie.alimentadorBId!] : [];
  const origem = lados.includes(origemId) ? origemId : lados[0];
  const secs = chaves.filter((c) => c.alimentadorId === origem && !c.alimentadorBId && !c.aberta && c.tipo !== "disjuntor");
  const [secId, setSecId] = useState("");
  const sec = secs.find((s) => s.id === secId) ?? secs[0];
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  const envolvidos = useMemo(() => new Set(manobras.flatMap((m) => [m.origem, m.destino])), [manobras]);
  const antes = useMemo(() => new Map((base?.subestacoes ?? subestacoes).flatMap((s) => s.alimentadores.map((a) => [a.cod, a.entradaDisjuntor]))), [base, subestacoes]);

  const executar = () => {
    setErro(""); setOk("");
    if (!tie || !sec) return setErro("Selecione uma chave de interligação e uma seccionadora do modelo de rede.");
    const e = executarManobra(tie.id, sec.id);
    if (e) setErro(e);
    else setOk(`Manobra executada: ${sec.cod} aberta, ${tie.cod} fechada. Topologia, mapa e balanço atualizados.`);
  };

  return (
    <div className="panel">
      <div className="panel-h"><span className="flex items-center gap-2"><ArrowRightLeft size={14} /> Registo e Simulação de Manobras na Rede</span><span className="text-xs font-normal text-muted-foreground">Somente chaves existentes no modelo de rede</span></div>
      <div className="grid gap-3 p-4 md:grid-cols-3">
        <label className="text-xs text-muted-foreground">1. Chave de interligação (NA) a fechar
          <select className="inp mt-1 w-full" value={tie?.id ?? ""} onChange={(e) => setTieId(e.target.value)}>
            {ties.length === 0 && <option value="">Nenhuma chave NA disponível</option>}
            {ties.map((c) => <option key={c.id} value={c.id}>{c.cod} ({nomeAl(c.alimentadorId)} ↔ {nomeAl(c.alimentadorBId)})</option>)}
          </select></label>
        <label className="text-xs text-muted-foreground">2. Alimentador que cede carga
          <select className="inp mt-1 w-full" value={origem ?? ""} onChange={(e) => setOrigemId(e.target.value)}>
            {lados.map((id) => { const f = feeders.find((x) => x.a.id === id); return <option key={id} value={id}>{f?.a.cod} — {f?.a.tensaoKV} kV ({f?.s.nome})</option>; })}
          </select></label>
        <label className="text-xs text-muted-foreground">3. Seccionadora a abrir
          <select className="inp mt-1 w-full" value={sec?.id ?? ""} onChange={(e) => setSecId(e.target.value)}>
            {secs.length === 0 && <option value="">Nenhuma seccionadora fechada</option>}
            {secs.map((c) => <option key={c.id} value={c.id}>{c.cod} ({c.tipo})</option>)}
          </select></label>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
        <button className="btn-primary" onClick={executar}><Zap size={14} /> Executar manobra e recalcular balanço</button>
        {base && <button className="btn" onClick={() => { desfazerManobras(); setOk(""); setErro(""); }}><RotateCcw size={14} /> Restaurar estado normal</button>}
        {erro && <span className="text-sm text-destructive">{erro}</span>}
        {ok && <span className="text-sm text-success">{ok}</span>}
      </div>

      <div className="grid gap-4 border-t border-border p-4 2xl:grid-cols-[1fr_360px]">
        <div className="overflow-auto">
          <table className="tbl">
            <thead><tr><th>Alimentador</th><th>SE</th><th>Tensão</th><th>Corrente / Ampac.</th><th>Trafos</th><th>Injetada antes</th><th>Injetada atual</th><th>Perda total</th></tr></thead>
            <tbody>{feeders.map(({ a, s }) => {
              const b = balancoAlimentador(a);
              const ant = antes.get(a.cod) ?? a.entradaDisjuntor;
              const uso = a.condutor.corrente / a.ampacidade;
              return (
                <tr key={a.id} className={envolvidos.has(a.cod) ? "bg-warning/10" : ""}>
                  <td className="font-medium"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: a.cor }} />{a.cod}</td><td>{s.nome}</td>
                  <td className="font-mono">{a.tensaoKV} kV</td>
                  <td className={`font-mono ${uso > 0.9 ? "text-destructive" : ""}`}>{fmt(a.condutor.corrente)} / {a.ampacidade} A</td>
                  <td className="font-mono">{a.trafos.length}</td>
                  <td className="font-mono">{fmt(ant)}</td>
                  <td className="font-mono font-semibold">{fmt(a.entradaDisjuntor)}</td>
                  <td className="font-mono">{b.entradaLiquida ? ((b.lTotal / b.entradaLiquida) * 100).toFixed(2) : "0.00"}%</td>
                </tr>
              );
            })}</tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">MWh no ciclo. Os trechos, trafos e clientes a jusante da seccionadora passam ao alimentador receptor. A manobra é bloqueada se formar laço, misturar níveis de tensão ou exceder a ampacidade.</p>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">Sub-balanço por Subestação</div>
          {subestacoes.map((s) => {
            const afetada = s.alimentadores.some((a) => envolvidos.has(a.cod));
            const b = balancoSubestacao(s);
            return (
              <div key={s.id} className={`rounded border px-3 py-2 text-sm ${afetada ? "border-warning bg-warning/10" : "border-border"}`}>
                <div className="flex justify-between font-medium"><span>{s.nome}</span><span className="font-mono">{fmt(b.saidaMT)} MWh</span></div>
                <div className="flex justify-between text-xs text-muted-foreground"><span>{s.tensaoATkV}/{s.tensaoMTkV} kV</span><span>Perdas AT: {fmt(b.lTotal)}</span></div>
              </div>
            );
          })}
        </div>
      </div>

      {manobras.length > 0 && (
        <div className="overflow-auto border-t border-border">
          <table className="tbl">
            <thead><tr><th>Quando</th><th>Fechada</th><th>Aberta</th><th>Origem → Destino</th><th>Trechos / Trafos</th><th>Energia transferida</th><th>Corrente receptor</th></tr></thead>
            <tbody>{manobras.map((r) => (
              <tr key={r.id}><td className="text-xs">{r.quando}</td><td>{r.tie}</td><td>{r.sec}</td><td>{r.origem} → {r.destino}</td><td className="font-mono">{r.segmentos} / {r.trafos}</td><td className="font-mono font-semibold">{fmt(r.energia)} MWh</td><td className="font-mono">{fmt(r.correnteDestino)} / {r.ampacidade} A</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function PerdasNiveis() {
  return null;
}
