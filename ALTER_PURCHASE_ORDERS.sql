-- Execute este script no SQL Editor do Supabase

ALTER TABLE public.machine_purchase_orders
ADD COLUMN IF NOT EXISTS deadline_date DATE,
ADD COLUMN IF NOT EXISTS maintenance_task_id UUID REFERENCES public.machine_maintenance_tasks(id) ON DELETE SET NULL;
