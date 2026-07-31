-- LIMPAR E RECRIOAR TABELAS (Execute isso no SQL Editor do Supabase)

-- Dropar tabelas existentes (em ordem de dependência)
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS cases CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;

-- Recriar tabela de casos (conversas)
CREATE TABLE cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Nova Conversa',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recriar tabela de mensagens
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  compressed_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recriar tabela de configuração do sistema
CREATE TABLE system_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  character TEXT DEFAULT '',
  strategy TEXT DEFAULT '',
  reasoning TEXT DEFAULT '',
  system_prompt TEXT DEFAULT 'Você é um assistente pessoal útil e eficiente.',
  google_ai_key TEXT DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Criar políticas permissivas
DROP POLICY IF EXISTS "cases_enable_all" ON cases;
CREATE POLICY "cases_enable_all" ON cases FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "messages_enable_all" ON messages;
CREATE POLICY "messages_enable_all" ON messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "system_config_enable_all" ON system_config;
CREATE POLICY "system_config_enable_all" ON system_config FOR ALL USING (true) WITH CHECK (true);

-- Criar índices
CREATE INDEX idx_messages_case_id ON messages(case_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_cases_updated_at ON cases(updated_at);

-- Inserir configuração padrão
INSERT INTO system_config (character, strategy, reasoning, system_prompt)
VALUES (
  'Amigável e prestativo',
  'Sempre ajudar com eficiência',
  'Pensar passo a passo antes de responder',
  'Você é um assistente pessoal útil e eficiente.'
);

-- Confirmar
SELECT 'Tabelas recriadas com sucesso!' as status;