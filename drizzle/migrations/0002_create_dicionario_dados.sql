CREATE TABLE public.dicionario_dados (
 grupo text NOT NULL,
 entidade text NOT NULL,
 variavel text NOT NULL,
 tipo text NOT NULL,
 unidade text NOT NULL DEFAULT '—',
 nivel_hierarquia text NOT NULL,
 sistema_origem text NOT NULL,
 periodicidade text NOT NULL DEFAULT 'Sob alteração',
 obrigatoria boolean NOT NULL DEFAULT true,
 chave boolean NOT NULL DEFAULT false,
 regra_critica text NOT NULL DEFAULT '',
 descricao text NOT NULL DEFAULT '',
 PRIMARY KEY (entidade, variavel)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dicionario_dados TO authenticated;
GRANT ALL ON public.dicionario_dados TO service_role;
ALTER TABLE public.dicionario_dados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dictionary authenticated read" ON public.dicionario_dados FOR SELECT TO authenticated USING (true);
CREATE POLICY "dictionary admin insert" ON public.dicionario_dados FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "dictionary admin update" ON public.dicionario_dados FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "dictionary admin delete" ON public.dicionario_dados FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX dicionario_dados_grupo_idx ON public.dicionario_dados (grupo);
COMMENT ON TABLE public.dicionario_dados IS 'Extraction metadata for existing application fields. Missing entities are explicitly documented as gaps, not implemented sources.';