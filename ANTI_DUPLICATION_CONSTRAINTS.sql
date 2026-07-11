-- =====================================================================
-- SCRIPT DE BLINDAGEM DE DUPLICIDADE (SUPABASE)
-- =====================================================================
-- Rode este script UMA VEZ no SQL Editor do Supabase para adicionar
-- bloqueios que impedirão dois registros iguais (como lotes ou notas)
-- de serem criados ao mesmo tempo.

-- 1. Evitar Lotes Duplicados no Estoque
-- Isso impede que dois materiais sejam salvos com o MESMO número de lote interno.
ALTER TABLE public.stock_items
ADD CONSTRAINT unique_internal_lot UNIQUE (internal_lot);

-- 2. Evitar Conferências com Números Iguais
-- Impede que uma mesma conferência seja criada mais de uma vez
ALTER TABLE public.conferences
ADD CONSTRAINT unique_conference_number UNIQUE (conference_number);

-- 3. Evitar Ordens de Produção (OP) Duplicadas
ALTER TABLE public.production_orders
ADD CONSTRAINT unique_order_number UNIQUE (order_number);

-- 4. Evitar Ordens de Máquina Duplicadas
ALTER TABLE public.machine_orders
ADD CONSTRAINT unique_machine_order_number UNIQUE (order_code);

-- =====================================================================
-- COMO FUNCIONA:
-- Ao rodar este script, se o sistema tentar salvar (por erro de internet
-- ou clique duplo) uma informação já existente, o Supabase irá REJEITAR
-- a duplicidade e proteger os seus dados!
