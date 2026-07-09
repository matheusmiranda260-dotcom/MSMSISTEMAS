-- Adicionar coluna para salvar a URL do comprovante de pagamento
ALTER TABLE commercial_orders
ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT;
