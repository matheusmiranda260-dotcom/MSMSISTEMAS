-- Adicionar coluna para salvar a URL do arquivo de solicitação de crédito
ALTER TABLE commercial_orders
ADD COLUMN IF NOT EXISTS credit_request_url TEXT;
