'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { GeminiLiveService } from '@/lib/gemini-live';

export default function VoiceLivePage() {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const geminiService = useRef<GeminiLiveService | null>(null);

  useEffect(() => {
    // Verificar autenticação
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();
        if (!data.authenticated) {
          router.push('/login');
        } else {
          loadConfig();
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/live-config');
      const data = await response.json();
      
      if (data.success) {
        setSystemPrompt(data.systemPrompt);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Erro ao carregar configuração:', error);
      setError('Erro ao carregar configuração: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const connect = async () => {
    try {
      setLoading(true);
      setError('');

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY || '';
      if (!apiKey) {
        throw new Error('API Key não configurada');
      }

      geminiService.current = new GeminiLiveService({
        apiKey,
        systemPrompt
      });

      await geminiService.current.connect();
      setIsConnected(true);
    } catch (error: any) {
      console.error('Erro ao conectar:', error);
      setError('Erro ao conectar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleRecording = async () => {
    if (!geminiService.current) return;

    try {
      if (isRecording) {
        geminiService.current.stopRecording();
        setIsRecording(false);
      } else {
        await geminiService.current.startRecording();
        setIsRecording(true);
      }
    } catch (error: any) {
      console.error('Erro ao controlar gravação:', error);
      setError('Erro ao controlar gravação: ' + error.message);
    }
  };

  const disconnect = () => {
    if (geminiService.current) {
      geminiService.current.disconnect();
      setIsConnected(false);
      setIsRecording(false);
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-700 flex items-center justify-center">
        <div className="text-white text-xl">Carregando configuração...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-700 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border-4 border-green-800">
          {/* Cabeçalho */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🎙️</div>
            <h1 className="text-3xl font-bold text-green-900 dark:text-green-400 mb-2">
              Modo Voz Nativo
            </h1>
            <p className="text-lg text-green-800 dark:text-green-300 font-semibold">
              Conversa em Tempo Real com Gemini Live API
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
              Áudio direto (Audio-to-Audio) com latência mínima
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Status */}
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className={`text-2xl font-bold ${isConnected ? 'text-green-600' : 'text-zinc-400'}`}>
                  {isConnected ? '✓' : '○'}
                </div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">Conectado</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${isRecording ? 'text-red-600' : 'text-zinc-400'}`}>
                  {isRecording ? '🎙️' : '○'}
                </div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">Gravando</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${isPlaying ? 'text-blue-600' : 'text-zinc-400'}`}>
                  {isPlaying ? '🔊' : '○'}
                </div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">Falando</div>
              </div>
            </div>
          </div>

          {/* Controles */}
          <div className="space-y-4">
            {!isConnected ? (
              <button
                onClick={connect}
                disabled={loading}
                className="w-full py-4 bg-green-700 hover:bg-green-800 text-white rounded-lg font-bold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-2 border-green-800"
              >
                {loading ? 'Conectando...' : '🎖️ Conectar ao Gemini Live'}
              </button>
            ) : (
              <>
                <button
                  onClick={toggleRecording}
                  disabled={loading}
                  className={`w-full py-4 rounded-lg font-bold text-lg transition-colors border-2 ${
                    isRecording 
                      ? 'bg-red-700 hover:bg-red-800 text-white border-red-800' 
                      : 'bg-blue-700 hover:bg-blue-800 text-white border-blue-800'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isRecording ? '⏹️ Parar Gravação' : '🎙️ Iniciar Gravação'}
                </button>

                <button
                  onClick={disconnect}
                  className="w-full py-3 bg-zinc-700 hover:bg-zinc-800 text-white rounded-lg font-medium transition-colors border-2 border-zinc-800"
                >
                  📡 Desconectar
                </button>
              </>
            )}
          </div>

          {/* Informações */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 className="font-bold text-blue-900 dark:text-blue-400 mb-2">ℹ️ Como Funciona</h3>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
              <li>• Áudio é processado diretamente pelo Gemini (Audio-to-Audio)</li>
              <li>• Latência mínima com WebSockets</li>
              <li>• Entonações naturais e respostas expressivas</li>
              <li>• System prompt do Pracinha da FEB configurado</li>
            </ul>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"
            >
              ← Voltar para o início
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}