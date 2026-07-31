# IAS Pracinha 🤖

Assistente pessoal AI com memória longa, chat de voz ao vivo e economia de tokens.

## 🚀 Funcionalidades

- **Chat de Voz ao Vivo**: Reconhecimento e síntese de voz em português
- **Memória Inteligente**: Compressão automática de contexto para economia de tokens
- **Salvação Manual**: Você controla o que é importante salvar
- **Sistema de Casos**: Organize conversas por temas/projetos
- **Configuração Livre**: System prompt personalizado sem restrições
- **PWA**: Instalável como aplicativo nativo
- **Antiloop**: Sistema de prevenção de requisições duplicadas
- **Logs Detalhados**: Tratamento de erros completo em português

## 🛠️ Tecnologias

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4
- **Backend**: Next.js API Routes
- **Banco de Dados**: Supabase (PostgreSQL)
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
4. Copie a URL e a chave anon do projeto

### 3. Configurar credenciais

Edite `src/lib/supabase.ts` com suas credenciais do Supabase:
```typescript
const supabaseUrl = 'SUA_URL_SUPABASE';
const supabaseAnonKey = 'SUA_CHAVE_ANON';
```

### 4. Configurar Google AI

1. Acesse https://makersuite.google.com/app/apikey
2. Crie uma chave API
3. No app, vá em Configuração e cole a chave

## 🚀 Rodar o projeto

```bash
npm run dev
```

Acesse http://localhost:3000

## 📱 Como usar

1. **Criar Conversa**: Clique em "+ Nova Conversa"
2. **Configurar Assistente**: Vá em "⚙️ Configuração" e defina:
   - Caráter do assistente
   - Estratégia de atuação
   - Raciocínio
   - System prompt (livre)
   - Chave API Google AI
3. **Conversar**: Digite ou use o microfone para falar
4. **Salvar**: Quando a conversa for importante, clique em "💾 Salvar"

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
├── lib/              # Utilitários (Supabase, antiloop, compressor)
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

## 📄 Licença

Uso pessoal - Não distribuir