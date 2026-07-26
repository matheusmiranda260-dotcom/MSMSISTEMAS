const { createClient } = require('@supabase/supabase-js');

const url = 'https://uakwypgyajcxdvktoauc.supabase.co';
const key = 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F';

const supabase = createClient(url, key);

async function checkAllData() {
    const { data: shifts } = await supabase
        .from('operator_shifts')
        .select('*')
        .eq('machine', 'Schnell-PRIMA')
        .order('start_time', { ascending: false })
        .limit(5);
        
    console.log('--- RECENT SHIFTS for Schnell-PRIMA ---');
    console.log(JSON.stringify(shifts, null, 2));

    // Check stops from today onwards (current UTC time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: stops } = await supabase
        .from('machine_stops')
        .select('id, machine, reason, start_time, end_time')
        .eq('machine', 'Schnell-PRIMA')
        .gte('start_time', today.toISOString())
        .order('start_time', { ascending: false });

    console.log('--- STOPS TODAY for Schnell-PRIMA ---');
    console.log(JSON.stringify(stops, null, 2));
}

checkAllData();
