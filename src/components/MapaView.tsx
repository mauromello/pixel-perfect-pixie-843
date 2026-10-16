import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polygon, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Layers, PenTool, Search, X } from "lucide-react";
import { balancoAlimentador, perdasPorNivel, type Coord } from "@/lib/calculationEngine";
import { useRede } from "@/lib/network-store";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const COR_FECHADA = "oklch(0.55 0.15 155)", COR_ABERTA = "oklch(0.58 0.21 27)", COR_SE = "oklch(0.2 0.035 245)";

const camadas = [
  { k: "at", l: "Subestações (AT)", c: COR_SE },
  { k: "mt", l: "Trechos MT (cor = alimentador atual)", c: "oklch(0.55 0.17 250)" },
  { k: "bt", l: "Transformadores MT/BT", c: "oklch(0.8 0.15 75)" },
  { k: "ch", l: "Chaves (verde fechada / vermelha aberta)", c: COR_FECHADA },
];

function dentro(p: { lat: number; lng: number }, poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i]!, [yj, xj] = poly[j]!;
    if (yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function FlyTo({ pos }: { pos: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (pos) map.flyTo(pos, 13); }, [pos, map]);
  return null;
}
function Ajustar({ pts }: { pts: Coord[] }) {
  const map = useMap();
  const key = pts.length ? `${pts[0]![0]}${pts.length}` : "";
  useEffect(() => { if (pts.length) map.fitBounds(pts, { padding: [60, 60] }); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
function Desenho({ ativo, onPonto }: { ativo: boolean; onPonto: (p: [number, number]) => void }) {
  useMapEvents({ click: (e) => { if (ativo) onPonto([e.latlng.lat, e.latlng.lng]); } });
  return null;
}

export default function MapaView() {
  const { subestacoes, chaves, origemModelo } = useRede();
  const [ativas, setAtivas] = useState<Record<string, boolean>>({ at: true, mt: true, bt: true, ch: true });
  const [tipo, setTipo] = useState("Alimentador");
  const [q, setQ] = useState("");
  const [alvo, setAlvo] = useState<[number, number] | null>(null);
  const [erro, setErro] = useState("");
  const [desenhando, setDesenhando] = useState(false);
  const [poly, setPoly] = useState<[number, number][]>([]);
  const [fechado, setFechado] = useState(false);

  const feeders = subestacoes.flatMap((s) => s.alimentadores.map((a) => ({ a, s })));
  const trafos = feeders.flatMap(({ a }) => a.trafos.map((t) => ({ t, a })));
  const todosPts = useMemo<Coord[]>(() => [...subestacoes.map((s) => [s.lat, s.lng] as Coord), ...feeders.flatMap(({ a }) => a.segmentos.flatMap((g) => g.coords))], [subestacoes]); // eslint-disable-line react-hooks/exhaustive-deps
  const corDe = (id: string | undefined) => feeders.find((f) => f.a.id === id)?.a.cor ?? COR_SE;
  const codDe = (id: string | undefined) => feeders.find((f) => f.a.id === id)?.a.cod ?? "—";

  const buscar = () => {
    setErro("");
    const t = q.toLowerCase().trim();
    if (tipo === "Coordenadas") {
      const [a = NaN, b = NaN] = q.split(",").map((s) => Number(s.trim()));
      if (isNaN(a) || isNaN(b)) return setErro("Use o formato: -19.92, -43.94");
      return setAlvo([a, b]);
    }
    if (tipo === "Subestação" || tipo === "Município" || tipo === "Regional") {
      const s = subestacoes.find((s) => (tipo === "Subestação" ? s.nome : tipo === "Município" ? s.municipio : s.regional).toLowerCase().includes(t));
      return s ? setAlvo([s.lat, s.lng]) : setErro("Nada encontrado no modelo de rede.");
    }
    if (tipo === "Alimentador") {
      const f = feeders.find(({ a }) => a.cod.toLowerCase().includes(t));
      const p = f?.a.segmentos[Math.floor(f.a.segmentos.length / 2)]?.coords[0];
      return p ? setAlvo(p) : setErro("Alimentador não encontrado no modelo de rede.");
    }
    const tr = trafos.find(({ t: x }) => x.nome.toLowerCase().includes(t));
    if (tr) setAlvo([tr.t.lat, tr.t.lng]); else setErro("Transformador não encontrado.");
  };

  const resultado = useMemo(() => {
    if (!fechado || poly.length < 3) return null;
    const ts = trafos.filter(({ t }) => dentro(t, poly));
    const cs = ts.flatMap(({ t }) => t.clientes);
    return { trafos: ts.length, clientes: cs.length, gd: cs.filter((c) => c.tipo === "gd").length, kva: ts.reduce((s, { t }) => s + t.srated, 0), consumo: cs.reduce((s, c) => s + c.importacao, 0) };
  }, [fechado, poly, trafos]);

  const iniciar = () => { setPoly([]); setFechado(false); setDesenhando(true); };
  const concluir = () => { if (poly.length >= 3) { setFechado(true); setDesenhando(false); } };
  const limpar = () => { setPoly([]); setFechado(false); setDesenhando(false); };

  return (
    <div className={`relative h-screen ${desenhando ? "[&_.leaflet-container]:cursor-crosshair" : ""}`}>
      <MapContainer center={[-19.9, -44]} zoom={9} className="h-full w-full" zoomControl={false}>
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        <Ajustar pts={todosPts} />
        <FlyTo pos={alvo} />
        <Desenho ativo={desenhando} onPonto={(p) => setPoly((v) => [...v, p])} />

        {ativas["mt"] && feeders.map(({ a, s }) => {
          const b = balancoAlimentador(a);
          return a.segmentos.map((g) => (
            <Polyline key={g.id} positions={g.coords} pathOptions={{ color: a.cor, weight: a.tensaoKV > 20 ? 6 : 4 }}>
              <Popup><b>{g.cod}</b> — {a.cod} ({s.nome})<br />Tensão: {a.tensaoKV} kV · {fmt(g.comprimento)} km<br />Corrente: {fmt(a.condutor.corrente)} / {a.ampacidade} A<br />Perda total: {fmt(b.lTotal)} MWh · PT {fmt(b.lTecnica)} · PNT {fmt(b.lNT)}</Popup>
            </Polyline>
          ));
        })}
        {ativas["ch"] && chaves.filter((c) => c.alimentadorBId).map((c) => {
          const a = feeders.find((f) => f.a.id === c.alimentadorId)?.a.segmentos.find((g) => g.id === c.segmentoId)?.coords.at(-1);
          const b = feeders.find((f) => f.a.id === c.alimentadorBId)?.a.segmentos.find((g) => g.id === c.segmentoBId)?.coords.at(-1);
          return a && b ? <Polyline key={c.id + "l"} positions={[a, [c.lat, c.lng], b]} pathOptions={{ color: c.aberta ? COR_ABERTA : corDe(c.alimentadorBId), weight: 3, dashArray: c.aberta ? "6 6" : undefined }} /> : null;
        })}
        {ativas["bt"] && trafos.map(({ t, a }) => (
          <CircleMarker key={t.id} center={[t.lat, t.lng]} radius={5} pathOptions={{ color: a.cor, fillColor: "oklch(0.8 0.15 75)", fillOpacity: 1, weight: 2 }}>
            <Popup><b>{t.nome}</b><br />{t.tensaoPrimKV} kV / {t.tensaoSecV} V · {t.srated} kVA<br />Alimentador: {a.cod}<br />Clientes: {t.clientes.length}</Popup>
          </CircleMarker>
        ))}
        {ativas["ch"] && chaves.map((c) => (
          <CircleMarker key={c.id} center={[c.lat, c.lng]} radius={6} pathOptions={{ color: c.aberta ? COR_ABERTA : COR_FECHADA, fillColor: c.aberta ? "white" : COR_FECHADA, fillOpacity: 1, weight: 3 }}>
            <Popup><b>{c.cod}</b> ({c.tipo})<br />Estado: {c.aberta ? "ABERTA" : "FECHADA"} · Normal: {c.normalAberta ? "NA" : "NF"}<br />{c.alimentadorBId ? `Interliga ${codDe(c.alimentadorId)} ↔ ${codDe(c.alimentadorBId)}` : `Alimentador ${codDe(c.alimentadorId)}`}</Popup>
          </CircleMarker>
        ))}
        {ativas["at"] && subestacoes.map((s) => {
          const p = perdasPorNivel(s);
          return (
            <CircleMarker key={s.id} center={[s.lat, s.lng]} radius={10} pathOptions={{ color: COR_SE, fillColor: "oklch(0.95 0.02 245)", fillOpacity: 1, weight: 3 }}>
              <Popup><b>{s.nome}</b><br />{s.municipio} · {s.regional}<br />{s.tensaoATkV} / {s.tensaoMTkV} kV · {s.alimentadores.length} alimentadores<br />Perdas AT {fmt(p.at)} · MT {fmt(p.mt)} · BT {fmt(p.bt)} MWh</Popup>
            </CircleMarker>
          );
        })}

        {poly.length > 1 && (fechado
          ? <Polygon positions={poly} pathOptions={{ color: "oklch(0.45 0.18 255)", weight: 2, fillOpacity: 0.15 }} />
          : <Polyline positions={poly} pathOptions={{ color: "oklch(0.45 0.18 255)", weight: 2, dashArray: "6 4" }} />)}
        {!fechado && poly.map((p, i) => <CircleMarker key={i} center={p} radius={4} pathOptions={{ color: "oklch(0.45 0.18 255)", fillOpacity: 1 }} />)}
        {alvo && <CircleMarker center={alvo} radius={14} pathOptions={{ color: COR_ABERTA, weight: 3, fillOpacity: 0 }} />}
      </MapContainer>

      <div className="panel absolute left-1/2 top-4 z-[1000] flex w-[min(640px,90%)] -translate-x-1/2 items-center gap-2 p-2">
        <select className="inp" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {["Regional", "Município", "Subestação", "Alimentador", "Transformador", "Coordenadas"].map((t) => <option key={t}>{t}</option>)}
        </select>
        <input className="inp flex-1" placeholder={tipo === "Coordenadas" ? "-19.92, -43.94" : `Buscar ${tipo.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscar()} />
        <button className="btn-primary" onClick={buscar} aria-label="Pesquisar"><Search size={14} /></button>
      </div>
      {erro && <div className="panel absolute left-1/2 top-20 z-[1000] -translate-x-1/2 px-3 py-1.5 text-sm text-destructive">{erro}</div>}

      <div className="absolute right-4 top-20 z-[1000] w-80 space-y-3">
        <div className="panel">
          <div className="panel-h"><span className="flex items-center gap-2"><Layers size={14} /> Camadas do Modelo de Rede</span></div>
          <div className="space-y-1.5 p-3">
            <p className="text-xs text-muted-foreground">Fonte: {origemModelo}</p>
            {camadas.map((c) => (
              <label key={c.k} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={!!ativas[c.k]} onChange={(e) => setAtivas({ ...ativas, [c.k]: e.target.checked })} />
                <span className="h-3 w-3 rounded-sm" style={{ background: c.c }} />
                {c.l}
              </label>
            ))}
            <div className="space-y-0.5 border-t border-border pt-2">
              {feeders.map(({ a }) => (
                <div key={a.id} className="flex items-center gap-2 text-xs"><span className="h-1.5 w-5 rounded" style={{ background: a.cor }} />{a.cod}<span className="ml-auto font-mono text-muted-foreground">{a.tensaoKV} kV</span></div>
              ))}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-h"><span className="flex items-center gap-2"><PenTool size={14} /> Seleção por Polígono</span>{poly.length > 0 && <button onClick={limpar} aria-label="Limpar"><X size={14} /></button>}</div>
          <div className="space-y-2 p-3 text-sm">
            {!desenhando && !resultado && <button className="btn-primary w-full justify-center" onClick={iniciar}>Desenhar área no mapa</button>}
            {desenhando && (
              <>
                <p className="text-xs text-muted-foreground">Clique no mapa para adicionar vértices ({poly.length} adicionados). Mínimo 3.</p>
                <button className="btn-primary w-full justify-center disabled:opacity-50" disabled={poly.length < 3} onClick={concluir}>Concluir polígono</button>
              </>
            )}
            {resultado && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded bg-muted p-2"><div className="text-xs text-muted-foreground">Clientes</div><div className="kpi text-lg">{resultado.clientes}</div></div>
                  <div className="rounded bg-muted p-2"><div className="text-xs text-muted-foreground">Trafos</div><div className="kpi text-lg">{resultado.trafos}</div></div>
                </div>
                <div className="text-xs text-muted-foreground">GD: {resultado.gd} · {fmt(resultado.kva)} kVA · consumo {fmt(resultado.consumo)} MWh</div>
                <button className="btn w-full justify-center" onClick={iniciar}>Nova área</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
