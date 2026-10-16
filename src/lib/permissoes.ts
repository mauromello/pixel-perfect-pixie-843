// Matriz de acesso por perfil (RBAC). Pura e testada.
export type Perfil = "admin" | "operador" | "planejamento" | "consulta";
export type Area = "balanco" | "rede" | "projecao" | "mapas" | "ia" | "admin" | "metodologia";

export const PERFIS: { id: Perfil; nome: string; descricao: string }[] = [
  { id: "admin", nome: "Administrador", descricao: "Acesso total, incluindo gestão de usuários" },
  { id: "operador", nome: "Operador / Engenharia", descricao: "Balanço, manobras, modelo de rede, mapas e IA" },
  { id: "planejamento", nome: "Planejamento", descricao: "Balanço, projeção, mapas e IA" },
  { id: "consulta", nome: "Consulta", descricao: "Visualização de balanço, projeção e mapas" },
];

export const MATRIZ: Record<Perfil, Area[]> = {
  admin: ["balanco", "metodologia", "rede", "projecao", "mapas", "ia", "admin"],
  operador: ["balanco", "metodologia", "rede", "projecao", "mapas", "ia"],
  planejamento: ["balanco", "metodologia", "projecao", "mapas", "ia"],
  consulta: ["balanco", "projecao", "mapas"],
};

export function areaDoCaminho(path: string): Area {
  const seg = path.split("/").filter(Boolean)[0] ?? "";
  if (seg === "rede" || seg === "projecao" || seg === "mapas" || seg === "ia" || seg === "admin" || seg === "metodologia") return seg;
  return "balanco";
}

export function podeAcessar(perfis: Perfil[], area: Area): boolean {
  return perfis.some((p) => MATRIZ[p]?.includes(area));
}

export const nomePerfil = (p: Perfil) => PERFIS.find((x) => x.id === p)?.nome ?? p;
