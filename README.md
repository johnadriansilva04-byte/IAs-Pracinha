# IAS Pracinha 🤖

Assistente pessoal AI com memória longa, chat de voz ao vivo, economia de tokens e filtro inteligente de salvamento.

## 🚀 Funcionalidades

- **Chat de Voz ao Vivo**: Reconhecimento e síntese de voz em português
- **Memória Inteligente**: Compressão automática de contexto para economia de tokens
- **Filtro Inteligente de Salvamento**: Não salva saudações irrelevantes, economizando espaço no banco
- **Criação Automática de Conversas**: Nova conversa criada automaticamente ao enviar primeira mensagem
- **Tratamento Gracioso de Erros**: App nunca quebra a UX mesmo com erros de banco
- **Sistema de Casos**: Organize conversas por temas/projetos
- **Configuração Livre**: System prompt personalizado sem restrições
- **PWA**: Instalável como aplicativo nativo
- **Antiloop**: Sistema de prevenção de requisições duplicadas
- **Logs Detalhados**: Tratamento de erros completo em português
- **Suporte a RAG**: Estrutura preparada para embeddings e pgvector

## 🛠️ Tecnologias

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4
- **Backend**: Next.js API Routes
- **Banco de Dados**: Supabase (PostgreSQL) com pgvector
- **IA**: Google Gemini Flash
- **Voz**: Web Speech API (nativa do browser)

## 📋 Pré-requisitos

- Node.js 20+
- Conta no Supabase (gratuita)
- Chave API do Google AI (Gemini)

## 🔧 Configuração

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar Supabase

1. Crie um projeto em https://supabase.com
2. Vá em SQL Editor
3. Execute o SQL do arquivo `supabase-reset.sql`
4. Este script cria:
   - Tabelas `conversations` e `cases` (para compatibilidade)
   - Tabela `messages` com filtro inteligente
   - Tabela `document_chunks` para futuros embeddings RAG
   - Extensão `pgvector` habilitada
5. Copie a URL e a chave anon do projeto

### 3. Configurar credenciais

Edite `src/lib/supabase.ts` com suas credenciais do Supabase:
```typescript
const supabaseUrl = 'SUA_URL_SUPABASE';
const supabaseAnonKey = 'SUA_CHAVE_ANON';
```

### 4. Configurar Google AI

A API key já está integrada no `.env.local`. Para produção (Vercel), configure a variável de ambiente:
- Nome: `GOOGLE_AI_API_KEY`
- Valor: Sua chave do Google AI

## 🚀 Rodar o projeto

```bash
npm run dev
```

Acesse http://localhost:3000

## 📱 Como usar

1. **Criar Conversa**: Clique em "+ Nova Conversa" ou simplesmente envie uma mensagem
2. **Configurar Assistente**: Vá em "⚙️ Configuração" e defina:
   - Caráter do assistente
   - Estratégia de atuação
   - Raciocínio
   - System prompt (livre)
3. **Conversar**: Digite ou use o microfone para falar
4. **Salvamento Inteligente**: O sistema salva automaticamente mensagens relevantes
   - Saudações curtas não são salvas (economia de espaço)
   - Mensagens úteis são salvas automaticamente
5. **Excluir**: Você pode excluir conversas e configurações do banco

## 🔒 Segurança

- As chaves API ficam no código (para uso pessoal)
- RLS do Supabase configurado para acesso local
- System prompt sem validações (responsabilidade do usuário)

## 📝 Estrutura do Projeto

```
src/
├── app/
│   ├── api/          # API Routes
│   ├── chat/         # Página de chat
│   ├── config/       # Página de configuração
│   └── page.tsx      # Home (lista de conversas)
├── hooks/            # Hooks customizados (voz)
├── lib/              # Utilitários (Supabase, antiloop, compressor, filtro)
└── types/            # Tipos TypeScript
```

## 🐛 Troubleshooting

**Erro ao salvar configuração:**
- Execute o SQL `supabase-reset.sql` no painel do Supabase
- Verifique se as políticas RLS foram criadas

**Chat não funciona:**
- Verifique se a chave Google AI foi configurada
- Confira os logs no console do navegador e servidor

**Voz não funciona:**
- Verifique se o browser suporta Web Speech API
- Chrome/Edge recomendados

**Erro na primeira mensagem:**
- O sistema agora cria conversa automaticamente
- Verifique os logs para mais detalhes

## 📄 Licença

Uso pessoal - Não distribuir