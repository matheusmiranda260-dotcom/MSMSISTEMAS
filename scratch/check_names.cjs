const { createClient } = require('@supabase/supabase-js');

const url = 'https://uakwypgyajcxdvktoauc.supabase.co';
const key = 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F';

const supabase = createClient(url, key);

async function checkAllNames() {
    const { data: shifts } = await supabase
        .from('operator_shifts')
        .select('machine, start_time, end_time')
        .order('start_time', { ascending: false })
        .limit(10);
        
    console.log('--- ALL SHIFTS ---');
    console.log(JSON.stringify(shifts, null, 2));

    const { data: stops } = await supabase
        .from('machine_stops')
        .select('id, machine, reason, start_time, end_time')
        .order('start_time', { ascending: false })
        .limit(20);

    console.log('--- ALL STOPS ---');
    console.log(JSON.stringify(stops, null, 2));
}

checkAllNames();
