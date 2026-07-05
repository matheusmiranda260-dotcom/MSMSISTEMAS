-- Adicionar colunas de reajuste à tabela de orçamentos (commercial_orders)
ALTER TABLE public.commercial_orders 
ADD COLUMN IF NOT EXISTS adjustment_percentage numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS adjustment_value numeric(10,2) DEFAULT 0;
