-- Create the stock_gauges table
CREATE TABLE IF NOT EXISTS public.stock_gauges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_type TEXT NOT NULL,
    gauge TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(material_type, gauge)
);

-- Enable RLS
ALTER TABLE public.stock_gauges ENABLE ROW LEVEL SECURITY;

-- Create policy for all actions (simple for now)
CREATE POLICY "Enable all for authenticated users" ON public.stock_gauges
    FOR ALL USING (true) WITH CHECK (true);

