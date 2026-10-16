// Simbologia unifilar ABNT/CIM em SVG + convenção COS (vermelho = fechado/energizado, verde = aberto).
// Módulo só de strings: seguro para SSR; o mapa transforma em L.divIcon.
export const COS = {
  fechado: "#dc2626",
  aberto: "#16a34a",
  desenergizado: "#6b7280",
  nucleo: "#f59e0b",
  se: "#1e293b",
  alerta: "#f59e0b",
  sobrecarga: "#dc2626",
};

const svg = (w: number, h: number, body: string, rot = 0) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="transform:rotate(${rot}deg);overflow:visible">${body}</svg>`;

/** Disjuntor/religador: quadrado (cheio vermelho fechado, vazado verde aberto); halo se manobrado. */
export function svgDisjuntor(aberta: boolean, manobrada: boolean, religador = false) {
  const c = aberta ? COS.aberto : COS.fechado;
  const halo = manobrada ? `<circle cx="11" cy="11" r="10.5" fill="none" stroke="#3b82f6" stroke-width="2" stroke-dasharray="3 2"/>` : "";
  const r = religador ? `<text x="11" y="14.5" font-size="9" font-weight="700" text-anchor="middle" fill="${aberta ? c : "#fff"}">R</text>` : "";
  return svg(22, 22, `${halo}<rect x="5" y="5" width="12" height="12" fill="${aberta ? "#fff" : c}" stroke="${c}" stroke-width="2.5"/>${r}`);
}

/** Seccionadora: lâmina articulada (alinhada = fechada, levantada = aberta). */
export function svgSeccionadora(aberta: boolean, manobrada: boolean, rot: number) {
  const c = aberta ? COS.aberto : COS.fechado;
  const lamina = aberta ? `<line x1="6" y1="12" x2="18" y2="4" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>` : `<line x1="6" y1="12" x2="19" y2="12" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`;
  const halo = manobrada ? `<circle cx="12" cy="12" r="11.5" fill="none" stroke="#3b82f6" stroke-width="2" stroke-dasharray="3 2"/>` : "";
  return svg(24, 24, `${halo}<circle cx="12" cy="12" r="10" fill="#fff" fill-opacity="0.85"/><line x1="1" y1="12" x2="6" y2="12" stroke="${c}" stroke-width="2"/><line x1="19" y1="12" x2="23" y2="12" stroke="${c}" stroke-width="2"/><circle cx="6" cy="12" r="2" fill="${c}"/><circle cx="19" cy="12" r="2" fill="${aberta ? "#fff" : c}" stroke="${c}" stroke-width="1.5"/>${lamina}`, rot);
}

/** Fusível: retângulo com filamento. */
export function svgFusivel(aberta: boolean) {
  const c = aberta ? COS.aberto : COS.fechado;
  return svg(22, 22, `<rect x="3" y="7" width="16" height="8" rx="1" fill="#fff" stroke="${c}" stroke-width="2"/>${aberta ? "" : `<line x1="3" y1="11" x2="19" y2="11" stroke="${c}" stroke-width="2"/>`}`);
}

/** Transformador: duas bobinas entrelaçadas; núcleo âmbar; borda vermelha em sobrecarga; cinza tracejado se desenergizado. */
export function svgTrafo(corAlim: string, sobrecarga: boolean, desenergizado: boolean) {
  const c = desenergizado ? COS.desenergizado : corAlim;
  const dash = desenergizado ? `stroke-dasharray="2 2"` : "";
  const borda = sobrecarga && !desenergizado ? `<rect x="0.5" y="0.5" width="27" height="19" rx="4" fill="none" stroke="${COS.sobrecarga}" stroke-width="2"/>` : "";
  const nucleo = desenergizado ? "#d1d5db" : COS.nucleo;
  return svg(28, 20, `${borda}<circle cx="10" cy="10" r="6.5" fill="${nucleo}" fill-opacity="0.35" stroke="${c}" stroke-width="2" ${dash}/><circle cx="18" cy="10" r="6.5" fill="${nucleo}" fill-opacity="0.35" stroke="${c}" stroke-width="2" ${dash}/>`);
}

/** Subestação: pórtico com barramento + rótulo de tensão; selo âmbar se acima da meta regulatória. */
export function svgSubestacao(at: number, mt: number, alerta: boolean) {
  const selo = alerta ? `<circle cx="40" cy="6" r="6" fill="${COS.alerta}" stroke="#fff" stroke-width="1.5"/><text x="40" y="9.5" font-size="9" font-weight="700" text-anchor="middle" fill="#fff">!</text>` : "";
  return svg(46, 40, `<rect x="2" y="4" width="36" height="24" rx="2" fill="#f1f5f9" stroke="${COS.se}" stroke-width="2.5"/><line x1="8" y1="4" x2="8" y2="28" stroke="${COS.se}" stroke-width="2"/><line x1="32" y1="4" x2="32" y2="28" stroke="${COS.se}" stroke-width="2"/><line x1="6" y1="11" x2="34" y2="11" stroke="${COS.fechado}" stroke-width="3"/><line x1="6" y1="21" x2="34" y2="21" stroke="${COS.se}" stroke-width="2"/><rect x="0" y="30" width="40" height="10" rx="2" fill="${COS.se}"/><text x="20" y="38" font-size="6.5" font-weight="700" text-anchor="middle" fill="#fff">${at}/${mt} kV</text>${selo}`);
}

/** Azimute (graus, tela) entre dois pontos lat/lng. */
export function rotacao(a: [number, number], b: [number, number]) {
  return (Math.atan2(-(b[0] - a[0]), b[1] - a[1]) * 180) / Math.PI;
}
