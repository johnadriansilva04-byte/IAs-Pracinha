'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/login' : '/api/signup';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (isLogin) {
        router.push('/');
      } else {
        setError('✅ ' + data.message);
        setIsLogin(true);
      }
    } catch (error: any) {
      console.error('Erro:', error);
      setError(error.message || 'Erro ao processar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-700 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Fundo com elementos da bandeira */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-full h-1/3 bg-yellow-400"></div>
        <div className="absolute top-1/3 left-0 w-full h-1/3 bg-blue-600"></div>
        <div className="absolute top-2/3 left-0 w-full h-1/3 bg-white"></div>
      </div>

      <div className="max-w-md w-full relative z-10">
        <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border-4 border-green-800">
          {/* Cabeçalho militar */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🎖️</div>
            <h1 className="text-3xl font-bold text-green-900 dark:text-green-400 mb-2">
              IAS Pracinha
            </h1>
            <p className="text-lg text-green-800 dark:text-green-300 font-semibold">
              Bem-vindo à Cidadela
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
              Força Expedicionária Brasileira
            </p>
          </div>

          {error && (
            <div className={`p-3 rounded-lg mb-6 ${
              error.includes('✅') 
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
            }`}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-green-900 dark:text-green-400 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-green-600 dark:border-green-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:ring-2 focus:ring-green-500 focus:border-transparent font-medium"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-green-900 dark:text-green-400 mb-2">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-green-600 dark:border-green-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:ring-2 focus:ring-green-500 focus:border-transparent font-medium"
                placeholder="•••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-green-700 hover:bg-green-800 text-white rounded-lg font-bold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-2 border-green-800"
            >
              {loading ? 'Processando...' : isLogin ? '🎖️ Entrar' : '📋 Cadastrar'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-zinc-700 dark:text-zinc-300 font-medium">
              {isLogin ? 'Novo na cidadela?' : 'Já faz parte da FEB?'}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                disabled={loading}
                className="ml-2 text-green-700 dark:text-green-400 hover:underline font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLogin ? 'Cadastre-se' : 'Faça login'}
              </button>
            </p>
          </div>

          <div className="mt-8 pt-6 border-t-2 border-green-200 dark:border-green-800 text-center">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Protegido pelo Sistema Autêntico da FEB
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}