'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Case {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export default function Home() {
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Verificar se está logado
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();
        if (!data.authenticated) {
          router.push('/login');
        } else {
          setIsLoggedIn(true);
          fetchCases();
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const fetchCases = async () => {
    try {
      const response = await fetch('/api/cases');
      const data = await response.json();
      setCases(data);
    } catch (error) {
      console.error('Erro ao buscar casos:', error);
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
      window.location.href = `/chat/${data.id}`;
    } catch (error) {
      console.error('Erro ao criar caso:', error);
      alert('Erro ao criar conversa');
    }
  };

  const deleteCase = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta conversa?')) return;

    try {
      await fetch(`/api/cases/${id}`, { method: 'DELETE' });
      setCases(cases.filter(c => c.id !== id));
    } catch (error) {
      console.error('Erro ao deletar caso:', error);
      alert('Erro ao excluir conversa');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center">
        <div className="text-zinc-500">Carregando...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return null; // Redirecionou no useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
              IAS Pracinha
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              Seu assistente pessoal com memória longa
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"
          >
            Sair
          </button>
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

        {cases.length === 0 ? (
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
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <Link
                      href={`/chat/${caseItem.id}`}
                      className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      {caseItem.title}
                    </Link>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                      Criado em {new Date(caseItem.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteCase(caseItem.id)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                    title="Excluir conversa"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}