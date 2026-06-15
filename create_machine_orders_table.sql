-- Tabela de Programação de Máquinas (Programar Máquinas)
CREATE TABLE IF NOT EXISTS public.machine_orders (
    id TEXT PRIMARY KEY,
    client_name TEXT NOT NULL,
    machine_id TEXT NOT NULL,
    gauge TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 0,
    quantity_unit TEXT NOT NULL DEFAULT 'kg',
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'paused')),
    notes TEXT,
    created_at TEXT NOT NULL,
    order_code TEXT,
    os_quantity NUMERIC DEFAULT 1,
    weight NUMERIC DEFAULT 0
);

-- Index for faster queries by machine and date
CREATE INDEX IF NOT EXISTS idx_machine_orders_machine_id ON public.machine_orders(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_orders_dates ON public.machine_orders(start_date, end_date);

-- RLS
ALTER TABLE public.machine_orders ENABLE ROW LEVEL SECURITY;

-- Allow all access policies (same pattern as other tables)
CREATE POLICY "Allow all access on machine_orders"
    ON public.machine_orders
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Add to realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND tablename = 'machine_orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.machine_orders;
    END IF;
END $$;
