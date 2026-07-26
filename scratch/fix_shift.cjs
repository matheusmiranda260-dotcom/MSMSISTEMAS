const { createClient } = require('@supabase/supabase-js');

const url = 'https://uakwypgyajcxdvktoauc.supabase.co';
const key = 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F';

const supabase = createClient(url, key);

async function fixShift() {
    // O turno atual tem end_time errado (anterior ao start_time), vamos corrigir
    // fechando o turno corrompido e criando um novo para hoje
    
    const userId = '4d4df428-26b7-44e2-bda7-29dc7cc821bd'; // matheus
    const machine = 'Schnell-PRIMA';
    
    // 1. Fechar todos os turnos abertos (end_time = null)
    const { error: closeErr } = await supabase
        .from('operator_shifts')
        .update({ end_time: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('machine', machine)
        .is('end_time', null);
    
    console.log('Fechar turnos abertos:', closeErr);
    
    // 2. Corrigir o turno corrompido (end_time < start_time) 
    const { error: fixErr } = await supabase
        .from('operator_shifts')
        .update({ end_time: '2026-07-24T17:32:26.662+00:00' })
        .eq('id', '3690968e-4f65-4a06-9c0f-0aaf50c12819');
    
    console.log('Corrigir turno corrompido:', fixErr);

    // 3. Criar novo turno para hoje (início às 15:30 hora local = 18:30 UTC)
    const todayShiftStart = '2026-07-25T18:30:00.000+00:00'; // 15:30 horário de Brasilia
    
    const { data: newShift, error: newErr } = await supabase
        .from('operator_shifts')
        .insert({
            user_id: userId,
            username: 'matheus',
            machine: machine,
            start_time: todayShiftStart
        })
        .select('*');
    
    console.log('Criar novo turno:', newErr);
    console.log('Novo turno:', newShift);
}

fixShift();
