-- Adicionar coluna para armazenar os detalhes das bitolas inseridas via calculadora
ALTER TABLE commercial_order_items
ADD COLUMN IF NOT EXISTS bitolas_details JSONB;
