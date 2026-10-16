// Matriz de acesso por perfil (RBAC). Pura e testada.
export type Perfil = "admin" | "operador" | "planejamento" | "consulta";
export type Area = "balanco" | "manobras" | "rede" | "projecao" | "mapas" | "ia" | "admin" | "metodologia" | "guia";

export const PERFIS: { id: Perfil; nome: string; descricao: string }[] = [
  { id: "admin", nome: "Administrador", descricao: "Acesso total, incluindo gestão de usuários" },
  { id: "operador", nome: "Operador / Engenharia", descricao: "Balanço, manobras, modelo de rede, mapas e IA" },
  { id: "planejamento", nome: "Planejamento", descricao: "Balanço, manobras, projeção, mapas e IA" },
  { id: "consulta", nome: "Consulta", descricao: "Visualização de balanço, projeção e mapas" },
];

export const MATRIZ: Record<Perfil, Area[]> = {
  admin: ["balanco", "manobras", "metodologia", "rede", "projecao", "mapas", "ia", "admin", "guia"],
  operador: ["balanco", "manobras", "metodologia", "rede", "projecao", "mapas", "ia", "guia"],
  planejamento: ["balanco", "manobras", "metodologia", "projecao", "mapas", "ia", "guia"],
  consulta: ["balanco", "projecao", "mapas", "guia"],
};

export function areaDoCaminho(path: string): Area {
  const seg = path.split("/").filter(Boolean)[0] ?? "";
  if (seg === "rede" || seg === "projecao" || seg === "mapas" || seg === "ia" || seg === "admin" || seg === "metodologia" || seg === "manobras" || seg === "guia") return seg;
  return "balanco";
}

export function podeAcessar(perfis: Perfil[], area: Area): boolean {
  return perfis.some((p) => MATRIZ[p]?.includes(area));
}

export const nomePerfil = (p: Perfil) => PERFIS.find((x) => x.id === p)?.nome ?? p;
