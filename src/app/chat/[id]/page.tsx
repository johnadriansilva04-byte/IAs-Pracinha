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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isListening, transcript, startListening, stopListening, isSupported: speechRecognitionSupported } = useSpeechRecognition();
  const { speak, stop: stopSpeaking, isSpeaking, isSupported: speechSynthesisSupported } = useSpeechSynthesis();

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
      if (autoVoice && !data.saved) {
        speak(data.response);
      }
    } catch (error: any) {
      console.error('[FRONTEND] Erro ao enviar mensagem:', error);
      alert('❌ Erro ao enviar mensagem: ' + (error.message || 'Tente novamente'));
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
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800 flex flex-col">
      <header className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link
            href="/"
            className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"
          >
            ← Voltar
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
              className="flex-1 px-3 py-1 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50"
              autoFocus
            />
          ) : (
            <h1
              className="flex-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50 cursor-pointer hover:opacity-80"
              onClick={() => setEditingTitle(true)}
            >
              {caseTitle || 'Nova Conversa'}
            </h1>
          )}
          <button
            onClick={saveConversation}
            disabled={sessionMessages.length === 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            💾 Salvar ({sessionMessages.length})
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {sessionMessages.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ {sessionMessages.length} mensagens não salvas na memória. Clique em "Salvar" para persistir no banco.
              </p>
            </div>
          )}
          
          {allMessages.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <p className="mb-4">Comece a conversa!</p>
              <p className="text-sm">Digite sua mensagem abaixo ou use o microfone</p>
            </div>
          ) : (
            allMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900'
                      : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs mt-2 opacity-60">
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

      <div className="bg-white dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex gap-2">
            {speechRecognitionSupported && (
              <button
                onClick={toggleVoice}
                className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                  isListening
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600'
                }`}
              >
                {isListening ? '🎙️ Parar' : '🎙️ Falar'}
              </button>
            )}
            
            {speechSynthesisSupported && (
              <button
                onClick={() => setAutoVoice(!autoVoice)}
                className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                  autoVoice
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600'
                }`}
              >
                {autoVoice ? '🔊 Auto-Voz ON' : '🔊 Auto-Voz OFF'}
              </button>
            )}

            {isSpeaking && (
              <button
                onClick={stopSpeaking}
                className="px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
              >
                🔇 Parar fala
              </button>
            )}
          </div>

          <div className="flex gap-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Digite sua mensagem ou use o microfone..."
              className="flex-1 px-4 py-3 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 resize-none"
              rows={1}
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '...' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}