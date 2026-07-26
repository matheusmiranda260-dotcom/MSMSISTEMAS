const { createClient } = require('@supabase/supabase-js');

const url = 'https://uakwypgyajcxdvktoauc.supabase.co';
const key = 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F';

const supabase = createClient(url, key);

async function checkUsers() {
    const { data: users } = await supabase.from('app_users').select('*');
    console.log('--- APP USERS ---');
    console.log(JSON.stringify(users, null, 2));
}

checkUsers();
