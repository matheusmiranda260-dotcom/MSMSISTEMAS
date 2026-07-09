UPDATE public.customers
SET credit_generated = 0, 
    credit_used = 0, 
    credit_history = '[]'::jsonb;
