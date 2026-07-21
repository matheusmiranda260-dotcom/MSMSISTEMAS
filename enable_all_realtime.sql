-- Script para habilitar Realtime em todas as tabelas usadas pelo frontend no useSupabaseRealtime.ts
-- Isso corrige a necessidade de recarregar a página para ver alterações de outros usuários.

DO $$
DECLARE
    t_name text;
    tables_to_add text[] := ARRAY[
        'stock_items',
        'production_orders',
        'conferences',
        'finished_goods',
        'pontas_stock',
        'transfers',
        'parts_requests',
        'shift_reports',
        'finished_goods_transfers',
        'sticky_notes',
        'meetings',
        'meeting_categories',
        'downtime_configs',
        'app_users',
        'user_access_logs',
        'stock_gauges',
        'gauge_components',
        'production_records',
        'machine_orders',
        'customers',
        'commercial_orders',
        'machine_current_states'
    ];
BEGIN
    -- Certifica de que a publicação existe
    -- CREATE PUBLICATION supabase_realtime; -- Normalmente já existe no Supabase

    FOREACH t_name IN ARRAY tables_to_add
    LOOP
        -- Se a tabela existir no schema public
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t_name) THEN
            -- E se não estiver na publicação do realtime
            IF NOT EXISTS (
                SELECT 1 FROM pg_publication_tables 
                WHERE pubname = 'supabase_realtime' AND tablename = t_name
            ) THEN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t_name);
                RAISE NOTICE 'Tabela % adicionada ao supabase_realtime', t_name;
            ELSE
                RAISE NOTICE 'Tabela % já estava no supabase_realtime', t_name;
            END IF;
        ELSE
            RAISE NOTICE 'A tabela % não foi encontrada no banco', t_name;
        END IF;
    END LOOP;
END $$;
