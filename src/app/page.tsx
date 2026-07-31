'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Case {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export default function Home() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      const response = await fetch('/api/cases');
      const data = await response.json();
      setCases(data);
    } catch (error) {
      console.error('Erro ao buscar casos:', error);
    } finally {
      setLoading(false);
    }
  };

  const createCase = async () => {
    try {
      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Nova Conversa' })
      });
      const data = await response.json();
      setCases([data, ...cases]);
    } catch (error) {
      console.error('Erro ao criar caso:', error);
    }
  };

  const deleteCase = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta conversa? Isso apagará todas as mensagens também.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/cases/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json();
        alert('Erro ao excluir: ' + (error.error || 'Erro desconhecido'));
        return;
      }
      setCases(cases.filter(c => c.id !== id));
    } catch (error) {
      console.error('Erro ao deletar caso:', error);
      alert('Erro ao excluir conversa');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
            IAS Pracinha
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Seu assistente pessoal com memória longa
          </p>
        </header>

        <div className="flex gap-4 mb-6">
          <button
            onClick={createCase}
            className="px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            + Nova Conversa
          </button>
          <Link
            href="/config"
            className="px-6 py-3 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            ⚙️ Configuração
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12 text-zinc-500">Carregando...</div>
        ) : cases.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <p className="mb-4">Nenhuma conversa ainda</p>
            <p className="text-sm">Clique em "Nova Conversa" para começar</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {cases.map((caseItem) => (
              <div
                key={caseItem.id}
                className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <Link
                    href={`/chat/${caseItem.id}`}
                    className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    {caseItem.title}
                  </Link>
                  <button
                    onClick={() => deleteCase(caseItem.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Atualizado: {new Date(caseItem.updated_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
