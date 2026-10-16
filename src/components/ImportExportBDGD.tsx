import { useState } from "react";
import { Download, RotateCcw, Upload } from "lucide-react";
import { exportarCIM, exportarGeoJSON, importarBDGD, type FeatureCollection } from "@/lib/bdgd";
import { useRede } from "@/lib/network-store";

function baixar(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  URL.revokeObjectURL(url);
}

/** Importa camadas BDGD (GeoJSON) como modelo único e exporta em CIM-XML / GeoJSON. */
export function ImportExportBDGD() {
  const { subestacoes, chaves, origemModelo, carregarModelo, restaurarDemo } = useRede();
  const [msg, setMsg] = useState<{ erro?: string; avisos?: string[]; resumo?: string }>({});

  const importar = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const arquivos = await Promise.all([...files].map(async (f) => ({ nome: f.name, dados: JSON.parse(await f.text()) as FeatureCollection })));
      const r = importarBDGD(arquivos);
      carregarModelo({ subestacoes: r.subestacoes, chaves: r.chaves }, `BDGD — ${[...files].map((f) => f.name).join(", ")}`);
      const n = r.subestacoes.reduce((s, x) => s + x.alimentadores.length, 0);
      setMsg({ resumo: `Importado: ${r.subestacoes.length} subestações, ${n} alimentadores, ${r.chaves.length} chaves. Camadas: ${Object.entries(r.contagem).map(([k, v]) => `${k} (${v})`).join(", ")}.`, avisos: r.avisos });
    } catch (e) {
      setMsg({ erro: e instanceof Error ? e.message : "Arquivo inválido. Envie GeoJSON das camadas da BDGD." });
    }
  };

  return (
    <div className="panel">
      <div className="panel-h"><span>Modelo de Rede Único (IEC 61970 CIM17) — Origem: {origemModelo}</span></div>
      <div className="flex flex-wrap items-center gap-2 p-4">
        <label className="btn-primary cursor-pointer"><Upload size={14} /> Importar BDGD (GeoJSON)
          <input type="file" multiple accept=".geojson,.json" className="hidden" onChange={(e) => { void importar(e.target.files); e.target.value = ""; }} />
        </label>
        <button className="btn" onClick={() => baixar("modelo-rede-cim17.xml", exportarCIM(subestacoes, chaves), "application/rdf+xml")}><Download size={14} /> Exportar CIM-XML</button>
        <button className="btn" onClick={() => baixar("modelo-rede-bdgd.geojson", JSON.stringify(exportarGeoJSON(subestacoes, chaves)), "application/geo+json")}><Download size={14} /> Exportar GeoJSON</button>
        <button className="btn" onClick={() => { restaurarDemo(); setMsg({}); }}><RotateCcw size={14} /> Rede demonstrativa</button>
        <span className="text-xs text-muted-foreground">Camadas aceitas: SUB, CTMT, SSDMT, UNSEMT, UNTRMT, UCBT/UCMT, UGBT/UGMT (exporte da GDB da ANEEL para GeoJSON, WGS84).</span>
      </div>
      {msg.erro && <p className="px-4 pb-3 text-sm text-destructive">{msg.erro}</p>}
      {msg.resumo && <p className="px-4 pb-1 text-sm text-success">{msg.resumo}</p>}
      {msg.avisos?.length ? <ul className="list-disc px-8 pb-3 text-xs text-muted-foreground">{msg.avisos.slice(0, 8).map((a) => <li key={a}>{a}</li>)}</ul> : null}
    </div>
  );
}
