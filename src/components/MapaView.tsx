import { useEffect, useMemo, useState } from "react";
import { Circle, CircleMarker, MapContainer, Polygon, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Layers, PenTool, Search, X } from "lucide-react";
import { cidadesMG, hash, pontosMapa } from "@/lib/mock-data";

const camadas = [
  { k: "pt", l: "Perdas Técnicas", c: "oklch(0.55 0.15 230)" },
  { k: "pnt", l: "Perdas Não Técnicas", c: "oklch(0.6 0.2 27)" },
  { k: "inad", l: "Inadimplência", c: "oklch(0.7 0.15 70)" },
  { k: "fraude", l: "Fraudes", c: "oklch(0.5 0.22 0)" },
  { k: "clan", l: "Ligações Clandestinas", c: "oklch(0.55 0.18 300)" },
  { k: "risco", l: "Áreas de Risco", c: "oklch(0.45 0.15 40)" },
  { k: "rede", l: "Tecnologias de Combate (AMI, NB-IoT, QMB)", c: "oklch(0.55 0.14 155)" },
];

const centro: [number, number] = [-18.5, -44.5];

function zonas(k: string) {
  const h = hash(k);
  return cidadesMG.flatMap((c, ci) =>
    Array.from({ length: 2 }, (_, i) => ({
      lat: c.lat + (((h * (i + ci + 3)) % 200) - 100) / 1500,
      lng: c.lng + (((h * (i + ci + 7)) % 200) - 100) / 1500,
      r: 1500 + ((h * (i + ci + 1)) % 5000),
      v: 5 + ((h + i * 13 + ci * 7) % 30),
      cidade: c.nome,
    })),
  );
}

// Instalações fictícias distribuídas em torno das cidades (para a contagem do polígono)
const instalacoes = cidadesMG.flatMap((c, ci) =>
  Array.from({ length: 400 }, (_, i) => {
    const a = ((i * 137.5 + ci * 31) * Math.PI) / 180;
    const d = Math.sqrt(((i * 7919 + ci * 104729) % 1000) / 1000) * 0.12;
    return { lat: c.lat + Math.sin(a) * d, lng: c.lng + Math.cos(a) * d, clientes: 1 + ((i * 13 + ci) % 4 === 0 ? 2 : 0), ami: (i + ci) % 3 === 0 };
  }),
);

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
  useEffect(() => { if (pos) map.flyTo(pos, 12); }, [pos, map]);
  return null;
}

function Desenho({ ativo, onPonto }: { ativo: boolean; onPonto: (p: [number, number]) => void }) {
  useMapEvents({ click: (e) => { if (ativo) onPonto([e.latlng.lat, e.latlng.lng]); } });
  return null;
}

export default function MapaView() {
  const [ativas, setAtivas] = useState<Record<string, boolean>>({ pnt: true, rede: true });
  const [tipo, setTipo] = useState("Município");
  const [q, setQ] = useState("");
  const [alvo, setAlvo] = useState<[number, number] | null>(null);
  const [erro, setErro] = useState("");
  const [desenhando, setDesenhando] = useState(false);
  const [poly, setPoly] = useState<[number, number][]>([]);
  const [fechado, setFechado] = useState(false);

  const buscar = () => {
    setErro("");
    if (tipo === "Coordenadas") {
      const [a = NaN, b = NaN] = q.split(",").map((s) => Number(s.trim()));
      if (isNaN(a) || isNaN(b)) return setErro("Use o formato: -19.92, -43.94");
      if (a < -23 || a > -14 || b < -51.1 || b > -39.8) return setErro("Coordenada fora de Minas Gerais.");
      return setAlvo([a, b]);
    }
    const t = tipo === "SE" ? "Subestação" : tipo;
    const p = pontosMapa.find((p) => p.tipo === t && p.nome.toLowerCase().includes(q.toLowerCase()));
    if (p) setAlvo([p.lat, p.lng]);
    else setErro("Nenhum resultado encontrado em MG.");
  };

  const resultado = useMemo(() => {
    if (!fechado || poly.length < 3) return null;
    const ins = instalacoes.filter((p) => dentro(p, poly));
    return { instalacoes: ins.length * 25, clientes: ins.reduce((s, i) => s + i.clientes, 0) * 25, ami: ins.filter((i) => i.ami).length * 25 };
  }, [fechado, poly]);

  const iniciar = () => { setPoly([]); setFechado(false); setDesenhando(true); };
  const concluir = () => { if (poly.length >= 3) { setFechado(true); setDesenhando(false); } };
  const limpar = () => { setPoly([]); setFechado(false); setDesenhando(false); };

  return (
    <div className={`relative h-screen ${desenhando ? "[&_.leaflet-container]:cursor-crosshair" : ""}`}>
      <MapContainer center={centro} zoom={6} className="h-full w-full" zoomControl={false}>
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        <FlyTo pos={alvo} />
        <Desenho ativo={desenhando} onPonto={(p) => setPoly((v) => [...v, p])} />
        {camadas.filter((c) => ativas[c.k] && c.k !== "rede").map((c) =>
          zonas(c.k).map((z, i) => (
            <Circle key={c.k + i} center={[z.lat, z.lng]} radius={z.r} pathOptions={{ color: c.c, fillColor: c.c, fillOpacity: 0.3, weight: 1 }}>
              <Popup>{c.l} — {z.cidade}<br />Índice: {z.v}%</Popup>
            </Circle>
          )),
        )}
        {ativas["rede"] && cidadesMG.map((c) => (
          <Polyline key={c.nome} positions={[[c.lat + 0.04, c.lng - 0.05], [c.lat, c.lng], [c.lat - 0.05, c.lng + 0.04], [c.lat - 0.02, c.lng + 0.08]]} pathOptions={{ color: "oklch(0.55 0.14 155)", weight: 3 }}>
            <Popup>Rede {c.nome}<br />AMI: {40 + (hash(c.nome) % 50)}% · NB-IoT: {10 + (hash(c.nome) % 30)}% · QMB: {hash(c.nome) % 12} km</Popup>
          </Polyline>
        ))}
        {pontosMapa.map((p) => (
          <CircleMarker key={p.nome} center={[p.lat, p.lng]} radius={p.tipo === "Município" ? 7 : 5} pathOptions={{ color: "oklch(0.2 0.035 245)", fillColor: p.tipo === "Município" ? "oklch(0.8 0.15 75)" : "oklch(0.95 0.02 245)", fillOpacity: 1, weight: 2 }}>
            <Popup><b>{p.nome}</b><br />{p.tipo}</Popup>
          </CircleMarker>
        ))}
        {poly.length > 1 && (fechado
          ? <Polygon positions={poly} pathOptions={{ color: "oklch(0.45 0.18 255)", weight: 2, fillOpacity: 0.15 }} />
          : <Polyline positions={poly} pathOptions={{ color: "oklch(0.45 0.18 255)", weight: 2, dashArray: "6 4" }} />)}
        {!fechado && poly.map((p, i) => <CircleMarker key={i} center={p} radius={4} pathOptions={{ color: "oklch(0.45 0.18 255)", fillOpacity: 1 }} />)}
        {alvo && <CircleMarker center={alvo} radius={12} pathOptions={{ color: "oklch(0.58 0.21 27)", weight: 3, fillOpacity: 0 }} />}
      </MapContainer>

      <div className="panel absolute left-1/2 top-4 z-[1000] flex w-[min(640px,90%)] -translate-x-1/2 items-center gap-2 p-2">
        <span className="hidden pl-1 text-xs font-semibold text-muted-foreground md:inline">Pesquisa espacial MG</span>
        <select className="inp" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {["Regional", "Município", "SE", "Alimentador", "Coordenadas"].map((t) => <option key={t}>{t}</option>)}
        </select>
        <input className="inp flex-1" placeholder={tipo === "Coordenadas" ? "-19.92, -43.94" : `Buscar ${tipo.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscar()} />
        <button className="btn-primary" onClick={buscar} aria-label="Pesquisar"><Search size={14} /></button>
      </div>
      {erro && <div className="panel absolute left-1/2 top-20 z-[1000] -translate-x-1/2 px-3 py-1.5 text-sm text-destructive">{erro}</div>}

      <div className="absolute right-4 top-20 z-[1000] w-80 space-y-3">
        <div className="panel">
          <div className="panel-h"><span className="flex items-center gap-2"><Layers size={14} /> Camadas Temáticas</span></div>
          <div className="space-y-1.5 p-3">
            {camadas.map((c) => (
              <label key={c.k} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={!!ativas[c.k]} onChange={(e) => setAtivas({ ...ativas, [c.k]: e.target.checked })} />
                <span className="h-3 w-3 rounded-sm" style={{ background: c.c }} />
                {c.l}
              </label>
            ))}
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
                  <div className="rounded bg-muted p-2"><div className="text-xs text-muted-foreground">Clientes</div><div className="kpi text-lg">{resultado.clientes.toLocaleString("pt-BR")}</div></div>
                  <div className="rounded bg-muted p-2"><div className="text-xs text-muted-foreground">Instalações</div><div className="kpi text-lg">{resultado.instalacoes.toLocaleString("pt-BR")}</div></div>
                </div>
                <div className="text-xs text-muted-foreground">Com medição AMI: {resultado.ami.toLocaleString("pt-BR")}</div>
                <button className="btn w-full justify-center" onClick={iniciar}>Nova área</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
