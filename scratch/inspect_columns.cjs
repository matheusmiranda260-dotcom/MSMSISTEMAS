const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uakwypgyajcxdvktoauc.supabase.co';
const supabaseAnonKey = 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
    try {
        const { data, error } = await supabase.from('stock_gauges').select('*').limit(1);
        if (error) throw error;
        console.log("Keys in stock_gauges row:", data.length > 0 ? Object.keys(data[0]) : "No rows found");
        console.log("Row data:", data[0]);
    } catch (e) {
        console.error("Error inspecting columns:", e);
    }
}

inspect();
