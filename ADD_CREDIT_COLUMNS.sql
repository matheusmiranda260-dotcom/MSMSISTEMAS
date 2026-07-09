ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS credit_generated numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_used numeric DEFAULT 0;
