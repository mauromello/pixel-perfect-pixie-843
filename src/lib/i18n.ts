import { create } from "zustand";

export type Idioma = "pt-BR" | "en-US";
export const IDIOMAS: { id: Idioma; rotulo: string }[] = [
  { id: "pt-BR", rotulo: "PT-BR" },
  { id: "en-US", rotulo: "EN-US" },
];

// Portuguese text is the key; missing entries fall back to Portuguese.
const EN: Record<string, string> = {
  "Balanço e Manobras": "Balance & Switching",
  "Gestão do Modelo de Rede": "Network Model Management",
  "Projeção e Simulação": "Forecast & Simulation",
  "Mapas Geoespaciais": "Geospatial Maps",
  "IA, ML e Data Lake": "AI, ML & Data Lake",
  "Configurações e Segurança": "Settings & Security",
  "Combate a Perdas": "Loss Reduction",
  "Sair": "Sign out",
  "Sem perfil": "No profile",
  "Idioma": "Language",
  "Administrador": "Administrator",
  "Operador": "Operator",
  "Planejamento": "Planning",
  "Consulta": "Viewer",
  "Topologia Subestação → Alimentador → Transformador → Instalação e parâmetros técnicos":
    "Topology Substation → Feeder → Transformer → Installation and technical parameters",
  "Projeção Automatizada de Perdas e Simulação": "Automated Loss Forecast and Simulation",
  "Análise de Sensibilidade e Simulação de Cenários — Minas Gerais": "Sensitivity Analysis and Scenario Simulation — Minas Gerais",
  "Cálculo e Gestão do Balanço Energético": "Energy Balance Calculation and Management",
  "Controle de medições: Regional → Município → SE → Alimentador → Religador → Trafo → Medidor → Instalação":
    "Metering control: Region → City → Substation → Feeder → Recloser → Transformer → Meter → Installation",
  "Saúde dos Dados e Algoritmos": "Data and Algorithm Health",
  "Módulo de IA, ML e Data Lake — status de integração": "AI, ML and Data Lake module — integration status",
  "Configurações, Dicionário de Dados e Segurança": "Settings, Data Dictionary and Security",
  "Documentação do modelo de rede elétrica e controlo de acessos": "Electrical network model documentation and access control",
  "Variação de consumo": "Consumption change",
  "Geração Distribuída": "Distributed Generation",
  "Geração Convencional": "Conventional Generation",
  "Fiscalização": "Inspection",
  "Temperatura média": "Average temperature",
  "Reajuste tarifário": "Tariff adjustment",
  "PIB regional": "Regional GDP",
  "Entrada de Geração Distribuída (GD)": "Distributed Generation input (DG)",
  "Entrada de Geração Convencional (GC)": "Conventional Generation input (GC)",
  "Intensidade de fiscalização": "Inspection intensity",
  "Variação de temperatura média": "Average temperature change",
  "Variação do PIB regional": "Regional GDP change",
  "Variável −Δ": "Variable −Δ",
  "Variável +Δ": "Variable +Δ",
  "Entrar": "Sign in",
  "Senha": "Password",
  "E-mail": "Email",
};

const DIC: Record<Idioma, Record<string, string>> = { "pt-BR": {}, "en-US": EN };

export function traduzir(idioma: Idioma, texto: string): string {
  return DIC[idioma][texto] ?? texto;
}

type S = { idioma: Idioma; setIdioma: (i: Idioma) => void };
const CHAVE = "perdazero_idioma";
function inicial(): Idioma {
  if (typeof window === "undefined") return "pt-BR";
  const v = window.localStorage.getItem(CHAVE);
  return v === "en-US" ? "en-US" : "pt-BR";
}
export const useIdioma = create<S>()((set) => ({
  idioma: inicial(),
  setIdioma: (idioma) => {
    if (typeof window !== "undefined") window.localStorage.setItem(CHAVE, idioma);
    set({ idioma });
  },
}));

export function useT() {
  const idioma = useIdioma((s) => s.idioma);
  return (texto: string) => traduzir(idioma, texto);
}

export function formatarNumero(idioma: Idioma, n: number, casas = 2) {
  return new Intl.NumberFormat(idioma, { maximumFractionDigits: casas }).format(n);
}
