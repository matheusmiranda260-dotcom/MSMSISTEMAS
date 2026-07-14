ALTER TABLE commercial_orders
ADD COLUMN IF NOT EXISTS delivery_location TEXT;
