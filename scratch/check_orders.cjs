const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase
        .from('production_orders')
        .select('id, machine, creation_date, status, order_number')
        .eq('machine', 'Schnell-PRIMA')
        .order('created_at', { ascending: false })
        .limit(10);
    console.log(error || data);
}
check();
