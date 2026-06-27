-- Update commercial_orders table
ALTER TABLE commercial_orders 
ADD COLUMN IF NOT EXISTS project_ident TEXT,
ADD COLUMN IF NOT EXISTS payment_condition TEXT,
ADD COLUMN IF NOT EXISTS total_weight NUMERIC;

-- Create commercial_order_items table
CREATE TABLE IF NOT EXISTS commercial_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES commercial_orders(id) ON DELETE CASCADE,
    codigo TEXT,
    folha TEXT,
    descricao TEXT,
    tipo TEXT,
    peso NUMERIC,
    valor NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies for commercial_order_items
ALTER TABLE commercial_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access for commercial_order_items"
ON commercial_order_items FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow anonymous insert access for commercial_order_items"
ON commercial_order_items FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow anonymous update access for commercial_order_items"
ON commercial_order_items FOR UPDATE
TO anon, authenticated
USING (true);

CREATE POLICY "Allow anonymous delete access for commercial_order_items"
ON commercial_order_items FOR DELETE
TO anon, authenticated
USING (true);

-- Enable Realtime
alter publication supabase_realtime add table commercial_order_items;
