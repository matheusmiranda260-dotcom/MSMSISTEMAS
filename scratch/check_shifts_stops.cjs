const { createClient } = require('@supabase/supabase-js');

const url = 'https://uakwypgyajcxdvktoauc.supabase.co';
const key = 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F';

const supabase = createClient(url, key);

async function checkShiftsAndStops() {
    const { data: shifts } = await supabase
        .from('operator_shifts')
        .select('*')
        .eq('machine', 'SCHNELL-PRIMA')
        .order('start_time', { ascending: false })
        .limit(5);
        
    console.log('--- SHIFTS ---');
    console.log(JSON.stringify(shifts, null, 2));

    const { data: stops } = await supabase
        .from('machine_stops')
        .select('*')
        .eq('machine', 'SCHNELL-PRIMA')
        .order('start_time', { ascending: false })
        .limit(10);

    console.log('--- RECENT STOPS ---');
    console.log(JSON.stringify(stops, null, 2));
}

checkShiftsAndStops();
