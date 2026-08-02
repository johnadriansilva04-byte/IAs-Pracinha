'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  // No Next.js 16, params pode ser Promise, mas no client component já é resolvido
  const caseId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionMessages, setSessionMessages] = useState<Array<{role: string, content: string}>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [caseTitle, setCaseTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [autoVoice, setAutoVoice] = useState(true);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isListening, transcript, startListening, stopListening, isSupported: speechRecognitionSupported } = useSpeechRecognition();
  const { speak, stop: stopSpeaking, isSpeaking, isSupported: speechSynthesisSupported } = useSpeechSynthesis();

  useEffect(() => {
    // Verificar autenticação
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();
        if (!data.authenticated) {
          router.push('/login');
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    fetchMessages();
  }, [caseId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sessionMessages]);

  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/messages?case_id=${caseId}`);
      const data = await response.json();
      setMessages(data);
      
      // Buscar título do caso
      const casesResponse = await fetch('/api/cases');
      const cases = await casesResponse.json();
      const currentCase = cases.find((c: any) => c.id === caseId);
      if (currentCase) {
        setCaseTitle(currentCase.title);
      }
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    console.log('[FRONTEND] Enviando mensagem:', { length: userMessage.length, caseId });

    // Adicionar mensagem do usuário à sessão
    const newSessionMessages = [...sessionMessages, { role: 'user', content: userMessage }];
    setSessionMessages(newSessionMessages);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          case_id: caseId || null, // Enviar null se não tiver case_id
          message: userMessage 
        })
      });

      const data = await response.json();
      
      console.log('[FRONTEND] Resposta do chat:', { status: response.status, data });
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Se foi criado um novo case_id, redirecionar para a nova URL
      if (data.case_id && data.case_id !== caseId) {
        console.log('[FRONTEND] Nova conversa criada, redirecionando:', data.case_id);
        router.push(`/chat/${data.case_id}`);
        return;
      }

      // Adicionar resposta do assistente à sessão
      setSessionMessages([...newSessionMessages, { role: 'assistant', content: data.response }]);

      // Falar a resposta se auto-voice estiver ativado
      if (autoVoice) {
        speak(data.response);
      }
    } catch (error: any) {
      console.error('[FRONTEND-ERROR] Erro ao enviar mensagem:', {
        message: error.message,
        stack: error.stack
      });
      
      let errorMessage = 'Erro ao enviar mensagem';
      if (error.message?.includes('Gemini')) {
        errorMessage = 'Erro na API do Google Gemini. Verifique sua chave API.';
      } else if (error.message?.includes('banco') || error.message?.includes('database')) {
        errorMessage = 'Erro no banco de dados. Tente novamente.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert('❌ ' + errorMessage + '. Tente novamente.');
      // Remover mensagem do usuário em caso de erro
      setSessionMessages(sessionMessages);
    } finally {
      setLoading(false);
    }
  };

  const saveConversation = async () => {
    if (sessionMessages.length === 0) {
      alert('Não há mensagens para salvar');
      return;
    }

    console.log('[FRONTEND] Salvando conversa:', { count: sessionMessages.length });

    try {
      const response = await fetch('/api/save-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, messages: sessionMessages })
      });

      const data = await response.json();
      
      console.log('[FRONTEND] Resposta do salvamento:', { status: response.status, data });
      
      if (data.success) {
        if (data.warning) {
          alert(`⚠️ ${data.warning}\n✅ ${data.count} mensagens salvas com sucesso!`);
        } else {
          alert(`✅ ${data.count} mensagens salvas com sucesso!`);
        }
        setSessionMessages([]);
        await fetchMessages();
      } else {
        throw new Error(data.error || 'Erro ao salvar');
      }
    } catch (error: any) {
      console.error('[FRONTEND] Erro ao salvar conversa:', error);
      alert('❌ Erro ao salvar conversa: ' + (error.message || 'Tente novamente'));
    }
  };

  const updateTitle = async (newTitle: string) => {
    try {
      await fetch(`/api/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });
      setCaseTitle(newTitle);
      setEditingTitle(false);
    } catch (error) {
      console.error('Erro ao atualizar título:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Verificar se caseId existe antes de fazer upload
    if (!caseId) {
      alert('❌ Erro: ID da conversa não encontrado. Recarregue a página e tente novamente.');
      return;
    }

    console.log('[UPLOAD-FRONTEND] Iniciando upload:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      caseId
    });

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('case_id', caseId);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      console.log('[UPLOAD-FRONTEND] Resposta do servidor:', data);

      if (data.success) {
        alert(`✅ Documento "${data.document_name}" enviado com sucesso!\n📊 ${data.chunks_saved} partes processadas para RAG.`);
      } else {
        throw new Error(data.error || 'Erro desconhecido ao fazer upload');
      }
    } catch (error: any) {
      console.error('[UPLOAD-FRONTEND] Erro detalhado:', error);
      let errorMessage = 'Erro ao enviar documento';
      
      if (error.message?.includes('Tipo de arquivo não suportado')) {
        errorMessage = '❌ Formato não suportado. Use: PDF, DOC, DOCX ou TXT';
      } else if (error.message?.includes('muito grande')) {
        errorMessage = '❌ Arquivo muito grande. Máximo 50MB';
      } else if (error.message) {
        errorMessage = '❌ ' + error.message;
      }
      
      alert(errorMessage + '\n\nDetalhes: ' + (error.message || 'Tente novamente'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const toggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const allMessages = [...messages, ...sessionMessages.map((m, i) => ({
    id: `session-${i}`,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    created_at: new Date().toISOString()
  }))];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900 flex flex-col">
      <header className="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-700 p-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          {editingTitle ? (
            <input
              type="text"
              value={caseTitle}
              onChange={(e) => setCaseTitle(e.target.value)}
              onBlur={() => updateTitle(caseTitle)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') updateTitle(caseTitle);
              }}
              className="flex-1 px-4 py-2 border-2 border-emerald-500 dark:border-emerald-600 rounded-xl bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-700"
              autoFocus
            />
          ) : (
            <h1
              className="flex-1 text-xl font-bold text-zinc-900 dark:text-zinc-50 cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-2"
              onClick={() => setEditingTitle(true)}
            >
              <span className="text-2xl">🎖️</span>
              {caseTitle || 'Nova Conversa'}
            </h1>
          )}
          <div className="flex gap-2">
            <button
              onClick={saveConversation}
              disabled={sessionMessages.length === 0}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span>💾</span>
              <span className="hidden sm:inline">Salvar</span>
              {sessionMessages.length > 0 && (
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{sessionMessages.length}</span>
              )}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span>{uploading ? '⏳' : '📎'}</span>
              <span className="hidden sm:inline">Documento</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              accept="*"
            />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {sessionMessages.length > 0 && (
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-2 border-amber-300 dark:border-amber-700 p-4 rounded-xl shadow-sm animate-pulse">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    {sessionMessages.length} mensagens não salvas
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">Clique em "Salvar" para persistir no banco</p>
                </div>
              </div>
            </div>
          )}
          
          {allMessages.length === 0 ? (
            <div className="text-center py-16">
              <div className="mb-6">
                <div className="text-6xl mb-4">🎖️</div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">Bem-vindo ao Pracinha</h2>
                <p className="text-zinc-600 dark:text-zinc-400">Seu assistente da Força Expedicionária Brasileira</p>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-2xl p-6 shadow-lg max-w-md mx-auto">
                <p className="text-zinc-700 dark:text-zinc-300 mb-4">Comece a conversa!</p>
                <div className="flex justify-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span>⌨️</span>
                    <span>Digite sua mensagem</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>🎤</span>
                    <span>Use o microfone</span>
                  </div>
                </div>
                {loading && (
                  <div className="flex justify-center mt-6">
                    <div className="bg-gradient-to-r from-emerald-100 to-emerald-200 dark:from-emerald-900/30 dark:to-emerald-800/30 px-6 py-4 rounded-2xl flex items-center gap-3 shadow-md">
                      <div className="flex gap-1">
                        <div className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Pracinha está pensando...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            allMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] p-5 rounded-2xl shadow-md ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-br-none'
                      : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 rounded-bl-none border border-zinc-200 dark:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-lg">{message.role === 'user' ? '👤' : '🎖️'}</span>
                    <span className="text-xs font-semibold opacity-70">
                      {message.role === 'user' ? 'VOCÊ' : 'PRACINHA'}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  <p className="text-xs mt-3 opacity-60">
                    {new Date(message.created_at).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="bg-white/90 dark:bg-zinc-800/90 backdrop-blur-lg border-t border-zinc-200 dark:border-zinc-700 p-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua mensagem para o Pracinha..."
                disabled={loading}
                className="w-full px-5 py-4 border-2 border-zinc-300 dark:border-zinc-600 rounded-2xl bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 focus:border-transparent transition-all shadow-sm"
              />
              {input && (
                <button
                  onClick={() => setInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            {speechRecognitionSupported && (
              <button
                onClick={toggleVoice}
                disabled={loading}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-md ${
                  isListening
                    ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white scale-105'
                    : 'bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-600 text-zinc-700 dark:text-zinc-300 hover:from-zinc-300 hover:to-zinc-400 dark:hover:from-zinc-600 dark:hover:to-zinc-500'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isListening ? 'Parar de ouvir' : 'Falar'}
              >
                {isListening ? (
                  <div className="flex gap-1">
                    <div className="w-1 h-4 bg-white rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1 h-6 bg-white rounded-full animate-pulse" style={{ animationDelay: '100ms' }}></div>
                    <div className="w-1 h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></div>
                  </div>
                ) : (
                  <span className="text-2xl">🎤</span>
                )}
              </button>
            )}
            
            {speechSynthesisSupported && (
              <button
                onClick={() => setAutoVoice(!autoVoice)}
                disabled={loading}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-md ${
                  autoVoice
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white'
                    : 'bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-600 text-zinc-700 dark:text-zinc-300 hover:from-zinc-300 hover:to-zinc-400 dark:hover:from-zinc-600 dark:hover:to-zinc-500'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={autoVoice ? 'Auto-voz ligado' : 'Auto-voz desligado'}
              >
                <span className="text-2xl">{autoVoice ? '🔊' : '🔇'}</span>
              </button>
            )}

            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="px-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-2xl font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              ) : (
                <>
                  <span>Enviar</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}