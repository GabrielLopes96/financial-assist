'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName || 'Usuário',
            }
          }
        });
        if (error) throw error;
        alert('Cadastro realizado! Faça login com a conta criada.');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Ocorreu um erro.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-900">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl">
        <h2 className="text-3xl font-extrabold text-center text-slate-800 mb-2">
          🏠 Dividir Contas
        </h2>
        <p className="text-sm text-center text-slate-500 mb-8">
          Gerencie despesas individuais e de casal sem planilhas chatas.
        </p>

        {error && (
          <div className="p-3 mb-6 text-sm text-red-600 bg-red-50 rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          {isSignUp && (
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                Seu Nome
              </label>
              <input
                type="text"
                className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Lucas"
                required
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
              E-mail
            </label>
            <input
              type="email"
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@exemplo.com"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
              Senha
            </label>
            <input
              type="password"
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full p-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-md focus:outline-none disabled:opacity-50"
          >
            {loading ? 'Processando...' : isSignUp ? 'Criar Conta' : 'Entrar no App'}
          </button>
        </form>

        <div className="mt-8 text-center text-sm">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-emerald-600 hover:underline font-semibold"
          >
            {isSignUp ? 'Já tem uma conta? Conecte-se' : 'Primeira vez aqui? Crie uma conta'}
          </button>
        </div>
      </div>
    </div>
  );
}
