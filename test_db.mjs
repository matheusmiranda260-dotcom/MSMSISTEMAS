import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://uakwypgyajcxdvktoauc.supabase.co', 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F');

async function test() {
  const payload = {
    machine_name: 'Schnell-PRIMA',
    title: 'eletrico',
    file_url: 'https://test.com/file.pdf'
  };
  const { data, error } = await supabase.from('machine_manuals').insert([payload]);
  console.log('Insert machine_manuals:', { data, error });
}
test();
