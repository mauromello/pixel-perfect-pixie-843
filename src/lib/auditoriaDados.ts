import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mesesAnteriores, type LeituraMensal } from "./historico";

export function parametrosCriticasQuery(usuario: string) {
  return queryOptions({ queryKey: ["criticas_parametros", usuario], queryFn: async () => {
    const { data, error } = await supabase.from("criticas_parametros").select("*").order("regra").order("parametro");
    if (error) throw new Error("Não foi possível carregar os parâmetros de críticas.");
    return data;
  }, staleTime: 30_000 });
}
export function historicoQuery(usuario: string, competencia: string) {
  return queryOptions({ queryKey: ["serie_mensal", usuario, competencia], queryFn: async (): Promise<LeituraMensal[]> => {
    const inicio = mesesAnteriores(competencia, 36).at(-1);
    if (!inicio) return [];
    const select = () => supabase.from("serie_mensal").select("*", { count: "exact" }).gte("competencia", inicio).lte("competencia", competencia).order("elemento_id").order("competencia");
    const first = await select().range(0, 999);
    if (first.error) throw new Error("Não foi possível carregar a série histórica.");
    const rows = [...(first.data ?? [])];
    const pages = Math.ceil((first.count ?? 0) / 1000);
    for (let p = 1; p < pages; p += 8) {
      const results = await Promise.all(Array.from({ length: Math.min(8, pages - p) }, (_, j) => select().range((p + j) * 1000, (p + j + 1) * 1000 - 1)));
      for (const r of results) { if (r.error) throw new Error("Não foi possível carregar a série histórica."); rows.push(...(r.data ?? [])); }
    }
    return rows;
  }, staleTime: 60_000 });
}