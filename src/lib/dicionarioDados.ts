import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EntradaDicionario } from "./dicionarioSeed";

export function dicionarioQuery(usuarioId: string) {
  return queryOptions({
    queryKey: ["dicionario_dados", usuarioId],
    queryFn: async (): Promise<{ rows: EntradaDicionario[]; erro: boolean }> => {
      if (usuarioId === "avaliador") return { rows: [], erro: false };
      const rows: EntradaDicionario[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("dicionario_dados").select("*").order("entidade").order("variavel").range(offset, offset + 499);
        if (error) return { rows: [], erro: true };
        rows.push(...(data ?? []));
        if (!data || data.length < 500) break;
      }
      return { rows, erro: false };
    },
    staleTime: 30_000,
  });
}