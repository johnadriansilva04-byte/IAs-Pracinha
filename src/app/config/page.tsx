'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface SystemConfig {
  id: string;
  character: string;
  strategy: string;
  reasoning: string;
  system_prompt: string;
  google_ai_key: string;
  updated_at: string;
}

export default function ConfigPage() {
  const [config, setConfig] = useState<SystemConfig>({
    id: '',
    character: '',
    strategy: '',
    reasoning: '',
    system_prompt: '',
    google_ai_key: '',
    updated_at: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Erro ao buscar configuração:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      console.log('[FRONTEND] Salvando configuração...');
      const response = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character: config.character,
          strategy: config.strategy,
          reasoning: config.reasoning,
          system_prompt: config.system_prompt, // SEM VALIDAÇÃO - usuário escreve do jeito que quiser
          google_ai_key: config.google_ai_key
        })
      });

      const data = await response.json() as { error?: string };
      
      console.log('[FRONTEND] Resposta do servidor:', { status: response.status, data });
      
      if (response.ok) {
        alert('✅ Configuração salva com sucesso!');
      } else {
        throw new Error(data.error || 'Erro ao salvar');
      }
    } catch (error: any) {
      console.error('[FRONTEND] Erro ao salvar configuração:', error);
      alert('❌ Erro ao salvar configuração: ' + (error.message || 'Verifique se as tabelas do Supabase foram criadas'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center">
        <div className="text-zinc-500">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-8 flex items-center gap-4">
          <Link
            href="/"
            className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"
          >
            ← Voltar
          </Link>
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">
            Configuração do Assistente
          </h1>
        </header>

        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Caráter
            </label>
            <textarea
              value={config.character}
              onChange={(e) => setConfig({ ...config, character: e.target.value })}
              className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 resize-none"
              rows={3}
              placeholder="Ex: Amigável e prestativo, profissional e direto, etc."
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Defina a personalidade do assistente
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Estratégia
            </label>
            <textarea
              value={config.strategy}
              onChange={(e) => setConfig({ ...config, strategy: e.target.value })}
              className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 resize-none"
              rows={3}
              placeholder="Ex: Sempre ajudar com eficiência, priorizar segurança, etc."
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Como o assistente deve abordar as tarefas
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Raciocínio
            </label>
            <textarea
              value={config.reasoning}
              onChange={(e) => setConfig({ ...config, reasoning: e.target.value })}
              className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 resize-none"
              rows={3}
              placeholder="Ex: Pensar passo a passo antes de responder, considerar múltiplas perspectivas, etc."
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Como o assistente deve processar informações
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              System Prompt (Livre)
            </label>
            <textarea
              value={config.system_prompt}
              onChange={(e) => setConfig({ ...config, system_prompt: e.target.value })}
              className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 resize-none"
              rows={8}
              placeholder="Escreva o system prompt do jeito que quiser. Sem validações. Você é responsável pelo conteúdo."
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Escreva livremente. Sem validações ou restrições.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Chave API Google AI (Gemini) *
            </label>
            <input
              type="password"
              value={config.google_ai_key}
              onChange={(e) => setConfig({ ...config, google_ai_key: e.target.value })}
              className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50"
              placeholder="Cole sua chave de API do Google AI aqui"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Necessário para o assistente funcionar. Obtenha em: https://makersuite.google.com/app/apikey
            </p>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
            <Link
              href="/"
              className="px-6 py-3 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            >
              Cancelar
            </Link>
            <button
              onClick={saveConfig}
              disabled={saving}
              className="px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Salvando...' : 'Salvar Configuração'}
            </button>
          </div>
        </div>

        <div className="mt-6 bg-zinc-100 dark:bg-zinc-700 rounded-lg p-4">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
            Como isso funciona:
          </h3>
          <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-1">
            <li>• <strong>Caráter:</strong> Define a personalidade e tom do assistente</li>
            <li>• <strong>Estratégia:</strong> Define como o assistente aborda as tarefas</li>
            <li>• <strong>Raciocínio:</strong> Define como o assistente processa informações</li>
            <li>• <strong>System Prompt:</strong> Instruções principais que guiam todas as interações</li>
            <li>• <strong>Chave API Google AI:</strong> Necessária para o funcionamento do Gemini Flash</li>
          </ul>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2">
            Obtenha sua chave em: https://makersuite.google.com/app/apikey
          </p>
        </div>
      </div>
    </div>
  );
}