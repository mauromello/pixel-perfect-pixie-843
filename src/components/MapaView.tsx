import { Fragment, useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { BookOpen, Flame, Layers, PanelRightClose, PanelRightOpen, PenTool, Search, X } from "lucide-react";

const BASES = [
  { id: "osm", l: "Ruas (padrão)", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attr: "&copy; OpenStreetMap" },
  { id: "sat", l: "Satélite", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "&copy; Esri" },
  { id: "dark", l: "Noturno", url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", attr: "&copy; OpenStreetMap &copy; CARTO" },
  { id: "light", l: "Claro", url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", attr: "&copy; OpenStreetMap &copy; CARTO" },
];
const ABAS = [
  { id: "camadas", l: "Camadas", icon: Layers },
  { id: "temas", l: "Temas", icon: Flame },
  { id: "ferr", l: "Polígono", icon: PenTool },
  { id: "leg", l: "Legenda", icon: BookOpen },
] as const;
import { balancoAlimentador, perdasPorNivel, type Coord } from "@/lib/calculationEngine";
import { useRede } from "@/lib/network-store";
import { alertaRegulatorio, carregamentoTrafo, sobrecargaAlimentador, trechosDesenergizados } from "@/lib/estadoRede";
import { COS, rotacao, svgDisjuntor, svgFusivel, svgSeccionadora, svgSubestacao, svgTrafo } from "@/lib/simbologia";
import { areasCriticas, areasRisco, COR_TEC, indicadoresTrafos, TECNOLOGIAS, TEMAS, type TemaId } from "@/lib/tematicos";

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
  const [tema, setTema] = useState<TemaId | "">("");
  const [risco, setRisco] = useState(false);
  const [tecs, setTecs] = useState<Record<string, boolean>>({});
  const indicadores = useMemo(() => subestacoes.flatMap((s) => s.alimentadores.flatMap(indicadoresTrafos)), [subestacoes]);
  const riscos = useMemo(() => areasRisco(subestacoes), [subestacoes]);
  const temaInfo = TEMAS.find((t) => t.id === tema);
  const maxTema = tema ? Math.max(1e-9, ...indicadores.map((i) => i[tema])) : 1;
  const criticas = tema ? areasCriticas(indicadores, tema) : [];
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
  const [painel, setPainel] = useState(true);
  const [aba, setAba] = useState<(typeof ABAS)[number]["id"]>("camadas");
  const [base, setBase] = useState("osm");
  const [filtroAl, setFiltroAl] = useState("");
  const baseInfo = BASES.find((b) => b.id === base)!;

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
        <TileLayer key={baseInfo.id} url={baseInfo.url} attribution={baseInfo.attr} maxZoom={19} />
        <Ajustar pts={todosPts} />
        <FlyTo pos={alvo} />
        <Desenho ativo={desenhando} onPonto={(p) => setPoly((v) => [...v, p])} />

        {risco && riscos.map((r) => (
          <Polygon key={r.nome} positions={r.poly} pathOptions={{ color: COS.sobrecarga, weight: 2, dashArray: "6 4", fillOpacity: 0.12 }}><Popup>{r.nome}</Popup></Polygon>
        ))}
        {temaInfo && indicadores.map((i) => {
          const v = i[temaInfo.id] / maxTema;
          return (
            <CircleMarker key={"tm" + i.id} center={[i.lat, i.lng]} radius={8 + v * 28} pathOptions={{ color: temaInfo.cor, fillColor: temaInfo.cor, fillOpacity: 0.15 + v * 0.45, weight: 1 }}>
              <Popup><b>{i.nome}</b> ({i.alimentador})<br />{temaInfo.nome}: {fmt(i[temaInfo.id])} {temaInfo.unidade}<br />PT {fmt(i.pt)} MWh · PNT {fmt(i.pnt)} MWh<br />Inadimplência {fmt(i.inadimplencia)}% · Fraudes {i.fraude} · Clandestinas {i.clandestina}<br />Impedimento de leitura {fmt(i.impedimento)}% · Clientes {i.clientes}</Popup>
            </CircleMarker>
          );
        })}
        {indicadores.filter((i) => i.tecnologia && tecs[i.tecnologia]).map((i) => (
          <CircleMarker key={"tc" + i.id} center={[i.lat + 0.0025, i.lng + 0.0025]} radius={6} pathOptions={{ color: "#fff", weight: 2, fillColor: COR_TEC[i.tecnologia!], fillOpacity: 1 }}>
            <Popup><b>{i.tecnologia}</b> instalado em {i.nome} ({i.alimentador})</Popup>
          </CircleMarker>
        ))}

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

      <div className="panel absolute left-4 top-4 z-[1000] flex w-[min(520px,calc(100%-24rem))] items-center gap-2 p-1.5">
        <select className="inp" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {["Regional", "Município", "Subestação", "Alimentador", "Transformador", "Coordenadas"].map((t) => <option key={t}>{t}</option>)}
        </select>
        <input className="inp flex-1" placeholder={tipo === "Coordenadas" ? "-19.92, -43.94" : `Buscar ${tipo.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscar()} />
        <button className="btn-primary" onClick={buscar} aria-label="Pesquisar"><Search size={14} /></button>
      </div>
      {erro && <div className="panel absolute left-1/2 top-20 z-[1000] -translate-x-1/2 px-3 py-1.5 text-sm text-destructive">{erro}</div>}

      <div className="absolute right-4 top-4 z-[1000] flex flex-col items-end gap-2">
        <button className="panel flex items-center gap-2 px-3 py-2 text-sm font-medium" onClick={() => setPainel(!painel)} aria-label={painel ? "Recolher painel" : "Abrir painel"}>
          {painel ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />} {painel ? "Recolher" : "Painel do mapa"}
        </button>
        {painel && (
          <div className="panel flex max-h-[calc(100vh-7rem)] w-80 flex-col overflow-hidden">
            <div className="grid grid-cols-4 border-b border-border">
              {ABAS.map((x) => (
                <button key={x.id} onClick={() => setAba(x.id)} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${aba === x.id ? "border-b-2 border-primary font-semibold text-primary" : "text-muted-foreground hover:bg-muted"}`}>
                  <x.icon size={15} />{x.l}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-3 text-sm">
              {aba === "camadas" && (
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 text-xs font-semibold">Mapa de fundo</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {BASES.map((b) => (
                        <button key={b.id} onClick={() => setBase(b.id)} className={`rounded border px-2 py-1.5 text-xs ${base === b.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>{b.l}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5 border-t border-border pt-2">
                    <p className="text-xs text-muted-foreground">Fonte: {origemModelo}</p>
                    {camadas.map((c) => (
                      <label key={c.k} className="flex cursor-pointer items-center gap-2 text-xs">
                        <input type="checkbox" checked={!!ativas[c.k]} onChange={(e) => setAtivas({ ...ativas, [c.k]: e.target.checked })} />
                        <span className="h-3 w-3 rounded-sm" style={{ background: c.c }} />{c.l}
                      </label>
                    ))}
                  </div>
                  <div className="border-t border-border pt-2">
                    <div className="mb-1 text-xs font-semibold">Alimentadores ({feeders.length})</div>
                    <input className="inp mb-1 w-full text-xs" placeholder="Filtrar alimentador…" value={filtroAl} onChange={(e) => setFiltroAl(e.target.value)} />
                    <div className="max-h-48 space-y-0.5 overflow-y-auto">
                      {feeders.filter(({ a }) => a.cod.toLowerCase().includes(filtroAl.toLowerCase())).map(({ a }) => (
                        <button key={a.id} className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-muted" onClick={() => { const p = a.segmentos[Math.floor(a.segmentos.length / 2)]?.coords[0]; if (p) setAlvo(p); }}>
                          <span className="h-1.5 w-5 rounded" style={{ background: a.cor }} />{a.cod}<span className="ml-auto font-mono text-muted-foreground">{a.tensaoKV} kV</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {aba === "temas" && (
                <div className="space-y-2">
                  <select className="inp w-full" aria-label="Tema" value={tema} onChange={(e) => setTema(e.target.value as TemaId | "")}>
                    <option value="">— Sem tema —</option>
                    {TEMAS.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                  <label className="flex cursor-pointer items-center gap-2 text-xs"><input type="checkbox" checked={risco} onChange={(e) => setRisco(e.target.checked)} /><span className="h-3 w-3 rounded-sm border-2 border-dashed" style={{ borderColor: COS.sobrecarga }} />Áreas de risco</label>
                  <div className="text-xs text-muted-foreground">Tecnologias de combate a perdas:</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {TECNOLOGIAS.map((t) => (
                      <label key={t} className="flex cursor-pointer items-center gap-1 text-xs"><input type="checkbox" checked={!!tecs[t]} onChange={(e) => setTecs({ ...tecs, [t]: e.target.checked })} /><span className="h-2.5 w-2.5 rounded-full" style={{ background: COR_TEC[t] }} />{t}</label>
                    ))}
                  </div>
                  {temaInfo && (
                    <div className="border-t border-border pt-2">
                      <div className="mb-1 text-xs font-semibold">Áreas críticas — {temaInfo.nome}</div>
                      {criticas.map((c) => (
                        <button key={c.id} className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-muted" onClick={() => setAlvo([c.lat, c.lng])}>
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: temaInfo.cor }} />{c.nome}<span className="text-muted-foreground">{c.alimentador}</span>
                          <span className="ml-auto font-mono">{fmt(c[temaInfo.id])} {temaInfo.unidade}</span>
                        </button>
                      ))}
                      <p className="pt-1 text-[11px] text-muted-foreground">PT/PNT calculadas do modelo de rede; indicadores comerciais simulados até integração CCS/SAP.</p>
                    </div>
                  )}
                </div>
              )}
              {aba === "ferr" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">Seleção por polígono{poly.length > 0 && <button onClick={limpar} aria-label="Limpar"><X size={14} /></button>}</div>
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
              )}
              {aba === "leg" && (
                <div className="space-y-1.5 text-xs">
                  {legenda.map((x) => (
                    <div key={x.l} className="flex items-center gap-2"><span className="flex w-12 justify-center" dangerouslySetInnerHTML={{ __html: x.svg }} />{x.l}</div>
                  ))}
                  <div className="flex items-center gap-2"><span className="flex w-12 justify-center"><span className="h-1 w-10 rounded" style={{ background: "oklch(0.55 0.17 250)" }} /></span>Trecho MT energizado</div>
                  <div className="flex items-center gap-2"><span className="flex w-12 justify-center"><span className="w-10 border-t-4 border-dotted" style={{ borderColor: COS.desenergizado }} /></span>Trecho desenergizado</div>
                  <div className="flex items-center gap-2"><span className="flex w-12 justify-center"><span className="h-2.5 w-10 rounded" style={{ background: COS.sobrecarga, opacity: 0.35 }} /></span>Trecho com sobrecarga</div>
                  <p className="pt-1 text-muted-foreground">Vermelho = fechado/energizado · Verde = aberto/seguro.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
