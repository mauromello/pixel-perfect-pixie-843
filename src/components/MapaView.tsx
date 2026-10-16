import { Fragment, useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { BookOpen, ChevronDown, Layers, PenTool, Search, X } from "lucide-react";
import { balancoAlimentador, perdasPorNivel, type Coord } from "@/lib/calculationEngine";
import { useRede } from "@/lib/network-store";
import { alertaRegulatorio, carregamentoTrafo, sobrecargaAlimentador, trechosDesenergizados } from "@/lib/estadoRede";
import { COS, rotacao, svgDisjuntor, svgFusivel, svgSeccionadora, svgSubestacao, svgTrafo } from "@/lib/simbologia";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const COR_ABERTA = COS.fechado, COR_SE = COS.se;
const icone = (html: string, w: number, h: number) => L.divIcon({ html, className: "", iconSize: [w, h], iconAnchor: [w / 2, h / 2], popupAnchor: [0, -h / 2] });

const camadas = [
  { k: "at", l: "Subestações (AT)", c: COR_SE },
  { k: "mt", l: "Trechos MT (cor = alimentador atual)", c: "oklch(0.55 0.17 250)" },
  { k: "bt", l: "Transformadores MT/BT", c: COS.nucleo },
  { k: "ch", l: "Chaves e interligações", c: COS.fechado },
];

const legenda: { svg: string; l: string }[] = [
  { svg: svgSubestacao(138, 13.8, false), l: "Subestação (pórtico + barramento)" },
  { svg: svgSubestacao(138, 13.8, true), l: "Subestação acima da meta PRORET" },
  { svg: svgDisjuntor(false, false), l: "Disjuntor fechado (energizado)" },
  { svg: svgDisjuntor(true, false), l: "Disjuntor aberto" },
  { svg: svgDisjuntor(false, false, true), l: "Religador fechado" },
  { svg: svgSeccionadora(false, false, 0), l: "Seccionadora fechada" },
  { svg: svgSeccionadora(true, false, 0), l: "Seccionadora aberta" },
  { svg: svgSeccionadora(false, true, 0), l: "Chave manobrada (fora do normal)" },
  { svg: svgTrafo("#3b82f6", false, false), l: "Transformador normal" },
  { svg: svgTrafo("#3b82f6", true, false), l: "Transformador em sobrecarga (>100%)" },
  { svg: svgTrafo("#3b82f6", false, true), l: "Transformador desenergizado" },
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
  const desligados = new Map(feeders.map(({ a }) => [a.id, trechosDesenergizados(a, chaves)]));
  const [legAberta, setLegAberta] = useState(true);

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
          const off = desligados.get(a.id)!;
          const sobre = sobrecargaAlimentador(a);
          return a.segmentos.map((g) => {
            const des = off.has(g.id);
            const w = a.tensaoKV > 20 ? 6 : 4;
            return (
              <Fragment key={g.id}>
                {sobre && !des && <Polyline positions={g.coords} pathOptions={{ color: COS.sobrecarga, weight: w + 8, opacity: 0.3 }} />}
                <Polyline positions={g.coords} pathOptions={{ color: des ? COS.desenergizado : a.cor, weight: w, dashArray: des ? "2 7" : undefined, opacity: des ? 0.8 : 1 }}>
                  <Popup><b>{g.cod}</b> — {a.cod} ({s.nome})<br />Estado: {des ? "DESENERGIZADO" : "ENERGIZADO"}{sobre ? " · SOBRECARGA" : ""}<br />Tensão: {a.tensaoKV} kV · {fmt(g.comprimento)} km<br />Corrente: {fmt(a.condutor.corrente)} / {a.ampacidade} A<br />Perda total: {fmt(b.lTotal)} MWh · PT {fmt(b.lTecnica)} · PNT {fmt(b.lNT)}</Popup>
                </Polyline>
              </Fragment>
            );
          });
        })}
        {ativas["ch"] && chaves.filter((c) => c.alimentadorBId).map((c) => {
          const a = feeders.find((f) => f.a.id === c.alimentadorId)?.a.segmentos.find((g) => g.id === c.segmentoId)?.coords.at(-1);
          const b = feeders.find((f) => f.a.id === c.alimentadorBId)?.a.segmentos.find((g) => g.id === c.segmentoBId)?.coords.at(-1);
          return a && b ? <Polyline key={c.id + "l"} positions={[a, [c.lat, c.lng], b]} pathOptions={{ color: c.aberta ? COS.aberto : COS.fechado, weight: 3, dashArray: "6 6" }} /> : null;
        })}
        {ativas["bt"] && trafos.map(({ t, a }) => {
          const des = desligados.get(a.id)!.has(t.segmentoId);
          const fc = carregamentoTrafo(t);
          return (
            <Marker key={t.id} position={[t.lat, t.lng]} icon={icone(svgTrafo(a.cor, fc > 1, des), 28, 20)}>
              <Popup><b>{t.nome}</b><br />{t.tensaoPrimKV} kV / {t.tensaoSecV} V · {t.srated} kVA<br />Carregamento: {fmt(fc * 100)}%{fc > 1 ? " — SOBRECARGA" : ""}<br />Estado: {des ? "DESENERGIZADO" : "ENERGIZADO"}<br />Alimentador: {a.cod} · Clientes: {t.clientes.length}</Popup>
            </Marker>
          );
        })}
        {ativas["ch"] && chaves.map((c) => {
          const manob = c.aberta !== c.normalAberta;
          const seg = feeders.find((f) => f.a.id === c.alimentadorId)?.a.segmentos.find((g) => g.id === c.segmentoId)?.coords;
          const rot = seg && seg.length > 1 ? rotacao(seg.at(-2)!, seg.at(-1)!) : 0;
          const html = c.tipo === "seccionadora" ? svgSeccionadora(c.aberta, manob, rot) : c.tipo === "fusivel" ? svgFusivel(c.aberta) : svgDisjuntor(c.aberta, manob, c.tipo === "religador");
          return (
            <Marker key={c.id} position={[c.lat, c.lng]} icon={icone(html, 24, 24)} zIndexOffset={500}>
              <Popup><b>{c.cod}</b> ({c.tipo})<br />Estado: {c.aberta ? "ABERTA" : "FECHADA"} · Normal: {c.normalAberta ? "NA" : "NF"}{manob ? " · MANOBRADA" : ""}<br />{c.alimentadorBId ? `Interliga ${codDe(c.alimentadorId)} ↔ ${codDe(c.alimentadorBId)}` : `Alimentador ${codDe(c.alimentadorId)}`}</Popup>
            </Marker>
          );
        })}
        {ativas["at"] && subestacoes.map((s) => {
          const p = perdasPorNivel(s);
          const al = alertaRegulatorio(s);
          return (
            <Marker key={s.id} position={[s.lat, s.lng]} icon={icone(svgSubestacao(s.tensaoATkV, s.tensaoMTkV, al), 46, 40)} zIndexOffset={1000}>
              <Popup><b>{s.nome}</b><br />{s.municipio} · {s.regional}<br />{s.tensaoATkV} / {s.tensaoMTkV} kV · {s.alimentadores.length} alimentadores<br />Perdas AT {fmt(p.at)} · MT {fmt(p.mt)} · BT {fmt(p.bt)} MWh{al ? <><br /><b>⚠ Acima da meta regulatória ({s.alvoPT + s.alvoPNT}%)</b></> : null}</Popup>
            </Marker>
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
          <button className="panel-h w-full" onClick={() => setLegAberta(!legAberta)} aria-label="Legenda operacional">
            <span className="flex items-center gap-2"><BookOpen size={14} /> Legenda Operacional (COS · ABNT/CIM)</span>
            <ChevronDown size={14} className={legAberta ? "rotate-180" : ""} />
          </button>
          {legAberta && (
            <div className="max-h-72 space-y-1.5 overflow-y-auto p-3 text-xs">
              {legenda.map((x) => (
                <div key={x.l} className="flex items-center gap-2"><span className="flex w-12 justify-center" dangerouslySetInnerHTML={{ __html: x.svg }} />{x.l}</div>
              ))}
              <div className="flex items-center gap-2"><span className="flex w-12 justify-center"><span className="h-1 w-10 rounded" style={{ background: "oklch(0.55 0.17 250)" }} /></span>Trecho MT energizado (cor do alimentador)</div>
              <div className="flex items-center gap-2"><span className="flex w-12 justify-center"><span className="w-10 border-t-4 border-dotted" style={{ borderColor: COS.desenergizado }} /></span>Trecho desenergizado (jusante de chave aberta)</div>
              <div className="flex items-center gap-2"><span className="flex w-12 justify-center"><span className="h-2.5 w-10 rounded" style={{ background: COS.sobrecarga, opacity: 0.35 }} /></span>Trecho com sobrecarga (I &gt; ampacidade)</div>
              <p className="pt-1 text-muted-foreground">Vermelho = fechado/energizado · Verde = aberto/seguro.</p>
            </div>
          )}
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
