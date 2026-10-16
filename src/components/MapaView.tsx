import { useState } from "react";
import { Circle, CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { Layers, Search } from "lucide-react";
import { hash, pontosMapa } from "@/lib/mock-data";

const camadas = [
  { k: "pt", l: "Perdas Técnicas (PT)", c: "oklch(0.55 0.15 230)" },
  { k: "pnt", l: "Perdas Não Técnicas (PNT)", c: "oklch(0.6 0.2 27)" },
  { k: "inad", l: "Inadimplência", c: "oklch(0.7 0.15 70)" },
  { k: "fraude", l: "Concentração de Fraudes", c: "oklch(0.5 0.22 0)" },
  { k: "clan", l: "Ligações Clandestinas", c: "oklch(0.55 0.18 300)" },
  { k: "leit", l: "Impedimento de Leitura", c: "oklch(0.6 0.05 250)" },
  { k: "risco", l: "Áreas de Risco", c: "oklch(0.45 0.15 40)" },
  { k: "rede", l: "Mapeamento de Rede (QMB, AMI, NB-IoT)", c: "oklch(0.55 0.14 155)" },
];

const centro: [number, number] = [-22.9, -47.06];
function zonas(k: string) {
  const h = hash(k);
  return Array.from({ length: 6 }, (_, i) => ({
    lat: centro[0] + (((h * (i + 3)) % 200) - 100) / 900,
    lng: centro[1] + (((h * (i + 7)) % 200) - 100) / 900,
    r: 600 + ((h * (i + 1)) % 1400),
    v: 5 + ((h + i * 13) % 30),
  }));
}

function FlyTo({ pos }: { pos: [number, number] | null }) {
  const map = useMap();
  if (pos) map.flyTo(pos, 14);
  return null;
}

export default function MapaView() {
  const [ativas, setAtivas] = useState<Record<string, boolean>>({ pnt: true, rede: true });
  const [tipo, setTipo] = useState("Subestação");
  const [q, setQ] = useState("");
  const [alvo, setAlvo] = useState<[number, number] | null>(null);
  const [erro, setErro] = useState("");

  const buscar = () => {
    setErro("");
    if (tipo === "Coordenadas") {
      const [a = NaN, b = NaN] = q.split(",").map((s) => Number(s.trim()));
      if (isNaN(a) || isNaN(b)) return setErro("Use o formato: -22.90, -47.06");
      return setAlvo([a, b]);
    }
    const p = pontosMapa.find((p) => p.tipo === tipo && p.nome.toLowerCase().includes(q.toLowerCase()));
    if (p) setAlvo([p.lat, p.lng]);
    else setErro("Nenhum resultado encontrado.");
  };

  return (
    <div className="relative h-screen">
      <MapContainer center={centro} zoom={12} className="h-full w-full" zoomControl={false}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution="&copy; OpenStreetMap &copy; CARTO" />
        <FlyTo pos={alvo} />
        {camadas.filter((c) => ativas[c.k] && c.k !== "rede").map((c) =>
          zonas(c.k).map((z, i) => (
            <Circle key={c.k + i} center={[z.lat, z.lng]} radius={z.r} pathOptions={{ color: c.c, fillColor: c.c, fillOpacity: 0.25, weight: 1 }}>
              <Popup>{c.l}<br />Índice: {z.v}%</Popup>
            </Circle>
          )),
        )}
        {ativas.rede && (
          <>
            <Polyline positions={[[-22.875, -47.05], [-22.89, -47.04], [-22.9, -47.07], [-22.915, -47.055]]} pathOptions={{ color: "oklch(0.55 0.14 155)", weight: 3 }} />
            <Polyline positions={[[-22.83, -47.08], [-22.86, -47.1], [-22.88, -47.09]]} pathOptions={{ color: "oklch(0.55 0.14 155)", weight: 3 }} />
          </>
        )}
        {pontosMapa.map((p) => (
          <CircleMarker key={p.nome} center={[p.lat, p.lng]} radius={6} pathOptions={{ color: "oklch(0.2 0.035 245)", fillColor: "oklch(0.8 0.15 75)", fillOpacity: 1, weight: 2 }}>
            <Popup><b>{p.nome}</b><br />{p.tipo}</Popup>
          </CircleMarker>
        ))}
        {alvo && <CircleMarker center={alvo} radius={12} pathOptions={{ color: "oklch(0.58 0.21 27)", weight: 3, fillOpacity: 0 }} />}
      </MapContainer>

      <div className="panel absolute left-1/2 top-4 z-[1000] flex w-[min(640px,90%)] -translate-x-1/2 items-center gap-2 p-2">
        <span className="hidden pl-1 text-xs font-semibold text-muted-foreground md:inline">Consultas e Pesquisas</span>
        <select className="inp" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {["Regional", "Município", "Subestação", "Alimentador", "Religador", "Transformador", "Coordenadas"].map((t) => <option key={t}>{t}</option>)}
        </select>
        <input className="inp flex-1" placeholder={tipo === "Coordenadas" ? "-22.90, -47.06" : `Buscar ${tipo.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscar()} />
        <button className="btn-primary" onClick={buscar}><Search size={14} /></button>
      </div>
      {erro && <div className="panel absolute left-1/2 top-20 z-[1000] -translate-x-1/2 px-3 py-1.5 text-sm text-destructive">{erro}</div>}

      <div className="panel absolute right-4 top-20 z-[1000] w-72">
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
    </div>
  );
}
