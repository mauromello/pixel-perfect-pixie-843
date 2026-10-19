CREATE TABLE public.areas_subbalanco (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  elementos jsonb NOT NULL DEFAULT '{"alimentadores":[],"trafos":[],"medidoresFronteira":[],"chavesCorte":[]}'::jsonb,
  usuario_id uuid NOT NULL DEFAULT auth.uid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT areas_subbalanco_nome_valido CHECK (length(btrim(nome)) BETWEEN 1 AND 120)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.areas_subbalanco TO authenticated;
GRANT ALL ON public.areas_subbalanco TO service_role;
ALTER TABLE public.areas_subbalanco ENABLE ROW LEVEL SECURITY;
CREATE POLICY "areas authenticated read" ON public.areas_subbalanco FOR SELECT TO authenticated USING (true);
CREATE POLICY "areas permitted insert" ON public.areas_subbalanco FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid() AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador') OR public.has_role(auth.uid(), 'planejamento')));
CREATE POLICY "areas permitted update" ON public.areas_subbalanco FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador') OR public.has_role(auth.uid(), 'planejamento')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador') OR public.has_role(auth.uid(), 'planejamento'));
CREATE POLICY "areas permitted delete" ON public.areas_subbalanco FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador') OR public.has_role(auth.uid(), 'planejamento'));
CREATE INDEX areas_subbalanco_criado_em_idx ON public.areas_subbalanco (criado_em DESC);