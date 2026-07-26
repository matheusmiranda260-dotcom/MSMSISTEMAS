import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uakwypgyajcxdvktoauc.supabase.co';
const supabaseKey = 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Fetching all production_orders...');
    const { data: poData, error: poErr } = await supabase
        .from('production_orders')
        .select('id, machine, status, order_number')
        .limit(10);
    console.log(`Found ${poData?.length || 0} production orders:`, poData, 'Error:', poErr);
    
    console.log('Fetching operator_shifts...');
    const { data: shiftData, error: shiftErr } = await supabase
        .from('operator_shifts')
        .select('id, machine, start_time, end_time')
        .order('start_time', { ascending: false })
        .limit(5);
    console.log(`Found ${shiftData?.length || 0} shifts:`, shiftData, 'Error:', shiftErr);

    console.log('Fetching machine_stops...');
    const { data: stopsData, error: stopsErr } = await supabase
        .from('machine_stops')
        .select('id, machine, reason, start_time, end_time')
        .order('start_time', { ascending: false })
        .limit(5);
    console.log(`Found ${stopsData?.length || 0} stops:`, stopsData, 'Error:', stopsErr);
}

run();
