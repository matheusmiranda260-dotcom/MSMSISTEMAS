const { createClient } = require('@supabase/supabase-js');

const url = 'https://uakwypgyajcxdvktoauc.supabase.co';
const key = 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F';

const supabase = createClient(url, key);

async function testInsert() {
    console.log('Testing insert into machine_stops...');
    const { data, error } = await supabase.from('machine_stops').insert({
        machine: 'SCHNELL-PRIMA',
        user_id: null,
        username: 'test_script',
        start_time: new Date().toISOString(),
        reason: 'Aguardando O.S.'
    }).select('*');
    
    console.log('Insert error:', error);
    console.log('Inserted data:', data);
}

testInsert();
