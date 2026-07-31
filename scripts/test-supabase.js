const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hkzhksauilonqppipjyc.supabase.co';
const supabaseAnonKey = 'sb_publishable_qT04tnP1_XEbAZ5EHw02FQ_CFDtX_LM';

console.log('Testando conexão com Supabase...');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseAnonKey.substring(0, 20) + '...');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  try {
    // Testar 1: Verificar se a tabela cases existe
    console.log('\n1. Testando tabela cases...');
    const { data: cases, error: casesError } = await supabase
      .from('cases')
      .select('*')
      .limit(1);

    if (casesError) {
      console.error('❌ Erro na tabela cases:', casesError.message);
      console.error('   Código:', casesError.code);
    } else {
      console.log('✅ Tabela cases OK');
    }

    // Testar 2: Verificar se a tabela system_config existe
    console.log('\n2. Testando tabela system_config...');
    const { data: config, error: configError } = await supabase
      .from('system_config')
      .select('*')
      .limit(1);

    if (configError) {
      console.error('❌ Erro na tabela system_config:', configError.message);
      console.error('   Código:', configError.code);
    } else {
      console.log('✅ Tabela system_config OK');
    }

    // Testar 3: Verificar se a tabela messages existe
    console.log('\n3. Testando tabela messages...');
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .limit(1);

    if (messagesError) {
      console.error('❌ Erro na tabela messages:', messagesError.message);
      console.error('   Código:', messagesError.code);
    } else {
      console.log('✅ Tabela messages OK');
    }

    console.log('\n=== RESUMO ===');
    if (casesError || configError || messagesError) {
      console.log('❌ Conexão OK, mas tabelas não existem ou têm erro');
      console.log('SOLUÇÃO: Execute o SQL do arquivo supabase-reset.sql no painel do Supabase');
    } else {
      console.log('✅ Tudo OK! Supabase configurado corretamente');
    }

  } catch (error) {
    console.error('❌ Erro na conexão:', error.message);
    console.log('SOLUÇÃO: Verifique se as credenciais estão corretas');
  }
}

testConnection();