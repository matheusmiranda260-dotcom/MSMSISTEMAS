-- Adicionar coluna sub_items_progress para rastrear tempo e conclusão de cada "mini OS"
ALTER TABLE production_orders
ADD COLUMN IF NOT EXISTS sub_items_progress JSONB DEFAULT '{}'::jsonb;
