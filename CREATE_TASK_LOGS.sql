-- Execute este script no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.machine_maintenance_task_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    maintenance_task_id UUID REFERENCES public.machine_maintenance_tasks(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.machine_maintenance_task_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura para todos" ON public.machine_maintenance_task_logs FOR SELECT USING (true);
CREATE POLICY "Permitir inserção" ON public.machine_maintenance_task_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualização" ON public.machine_maintenance_task_logs FOR UPDATE USING (true);
CREATE POLICY "Permitir deleção" ON public.machine_maintenance_task_logs FOR DELETE USING (true);
