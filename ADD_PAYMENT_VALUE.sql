-- Adicionar coluna para salvar o valor do pagamento informado no anexo de comprovante
ALTER TABLE commercial_orders
ADD COLUMN IF NOT EXISTS payment_value NUMERIC;
