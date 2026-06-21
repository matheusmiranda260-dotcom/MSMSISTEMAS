-- Cole este código no SQL Editor do Supabase e clique em RUN
-- Isso irá desativar as políticas de segurança de linha (RLS) que estão bloqueando a inserção dos orçamentos

ALTER TABLE public.quotes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_product_ferros DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_history DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.model_estribos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_ferros DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_travas DISABLE ROW LEVEL SECURITY;
