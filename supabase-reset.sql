-- LIMPAR E RECRIOAR TABELAS (Execute isso no SQL Editor do Supabase)

-- Dropar tabelas existentes (em ordem de dependência)
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS cases CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS document_chunks CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;

-- Habilitar extensão pgvector para embeddings futuros (RAG)
CREATE EXTENSION IF NOT EXISTS vector;

-- Recriar tabela de conversas (usando nome correto)
CREATE TABLE conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Nova Conversa',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Manter tabela cases como alias para compatibilidade (pode ser removido depois)
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
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  compressed_summary TEXT,
  should_save BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para chunks de documentos (futuros embeddings RAG)
CREATE TABLE document_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recriar tabela de configuração do sistema
CREATE TABLE system_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  character TEXT DEFAULT '',
  strategy TEXT DEFAULT '',
  reasoning TEXT DEFAULT '',
  system_prompt TEXT DEFAULT 'Você é um assistente pessoal útil e eficiente.',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Se a tabela já existe e tem a coluna antiga, remover
ALTER TABLE system_config DROP COLUMN IF EXISTS google_ai_key;

-- Habilitar RLS
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Criar políticas permissivas
DROP POLICY IF EXISTS "cases_enable_all" ON cases;
CREATE POLICY "cases_enable_all" ON cases FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "conversations_enable_all" ON conversations;
CREATE POLICY "conversations_enable_all" ON conversations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "messages_enable_all" ON messages;
CREATE POLICY "messages_enable_all" ON messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "document_chunks_enable_all" ON document_chunks;
CREATE POLICY "document_chunks_enable_all" ON document_chunks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "system_config_enable_all" ON system_config;
CREATE POLICY "system_config_enable_all" ON system_config FOR ALL USING (true) WITH CHECK (true);

-- Criar índices
CREATE INDEX idx_messages_case_id ON messages(case_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_should_save ON messages(should_save);
CREATE INDEX idx_cases_updated_at ON cases(updated_at);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at);
CREATE INDEX idx_document_chunks_conversation_id ON document_chunks(conversation_id);
CREATE INDEX idx_document_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops);

-- Criar índice para busca de similaridade (RAG)
CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Inserir configuração padrão
INSERT INTO system_config (character, strategy, reasoning, system_prompt)
VALUES (
  'Amigável e prestativo',
  'Sempre ajudar com eficiência',
  'Pensar passo a passo antes de responder',
  'Você é um assistente pessoal útil e eficiente.'
);

-- Confirmar
SELECT 'Tabelas recriadas com sucesso! pgvector habilitado para RAG.' as status;