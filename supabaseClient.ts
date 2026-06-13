/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables!");
}

export const supabase = createClient(supabaseUrl || 'https://uakwypgyajcxdvktoauc.supabase.co', supabaseAnonKey || 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F');
