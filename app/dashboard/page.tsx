'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { PlusCircle, FileText, Mic, AlertCircle, TrendingUp, CheckCircle, Trash2, LogOut, Loader2, Calendar, BarChart2, PieChart as PieIcon } from 'lucide-react';

// Importação dos componentes do Recharts para os gráficos visuais
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as ChartTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis
} from 'recharts';

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Profile {
  id: string;
  full_name: string;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  is_shared: boolean;
  is_fixed: boolean;
  paid_by_id: string;
  category_id: string;
  month_reference: string;
  categories?: Category;
  profiles?: Profile;
}

export default function Dashboard() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = useState<any>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'entries' | 'charts'>('entries');
  const [isMounted, setIsMounted] = useState(false);
  
  // Controle de Visualização do Dashboard (Mês exibido)
  const [selectedMonth, setSelectedMonth] = useState('');
  
  // Form State (Lançamento Manual)
  const [desc, setDesc] = useState('');
  const [val, setVal] = useState('');
  const [cat, setCat] = useState('');
  const [isShared, setIsShared] = useState(true);
  const [isFixed, setIsFixed] = useState(false);
  const [paidBy, setPaidBy] = useState('');
  const [targetMonth, setTargetMonth] = useState('');

  // Estados de IA e Arquivos
  const [inputText, setInputText] = useState('');
  const [processingFile, setProcessingFile] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Gerador dinâmico de faturas mensais (3 meses atrás até 12 meses no futuro)
  const getMonthOptions = () => {
    const options = [];
    const date = new Date();
    for (let i = -3; i <= 12; i++) {
      const d = new Date(date.getFullYear(), date.getMonth() + i, 1);
      const value = d.toISOString().slice(0, 7); // 'YYYY-MM'
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return options;
  };

  const monthOptions = getMonthOptions();

  useEffect(() => {
    setIsMounted(true);
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    setSelectedMonth(currentMonthStr);
    setTargetMonth(currentMonthStr);

    const fetchSessionAndData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);
      setPaidBy(session.user.id);

      // Buscar parceiro
      const { data: profiles } = await supabase.from('profiles').select('id, full_name');
      if (profiles) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const other = profiles.find((p: any) => p.id !== session.user.id);
        if (other) setPartner(other);
      }

      // Buscar categorias
      const { data: cats } = await supabase.from('categories').select('*');
      if (cats) {
        setCategories(cats);
        if (cats.length > 0) setCat(cats[0].id);
      }

      setLoading(false);
    };

    fetchSessionAndData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recarregar transações quando o mês ativo mudar
  useEffect(() => {
    if (user?.id && selectedMonth) {
      fetchTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, user]);

  const fetchTransactions = async () => {
    const { data: txs } = await supabase
      .from('transactions')
      .select('*, categories(*), profiles(*)')
      .eq('month_reference', selectedMonth)
      .order('date', { ascending: false });

    if (txs) {
      setTransactions(txs.map(t => ({
        ...t,
        amount: Number(t.amount)
      })));
    }
  };

  // Funções de Cálculo dos Gráficos
  const getCategoryData = () => {
    const grouped: { [key: string]: { name: string; value: number; color: string } } = {};
    transactions.forEach(t => {
      const catName = t.categories?.name || 'Outros';
      const catColor = t.categories?.color || '#cbd5e1';
      if (!grouped[catName]) {
        grouped[catName] = { name: catName, value: 0, color: catColor };
      }
      grouped[catName].value += t.amount;
    });
    return Object.values(grouped);
  };

  const getComparisonData = () => {
    const myTotal = transactions
      .filter(t => t.paid_by_id === user?.id)
      .reduce((sum, t) => sum + t.amount, 0);

    const partnerTotal = transactions
      .filter(t => t.paid_by_id === partner?.id)
      .reduce((sum, t) => sum + t.amount, 0);

    return [
      { name: 'Você', 'Gasto': myTotal, fill: '#059669' },
      { name: partner?.full_name || 'Parceira', 'Gasto': partnerTotal, fill: '#0f766e' }
    ];
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc || !val) return;

    const baseAmount = parseFloat(val);
    const todayStr = new Date().toISOString().split('T')[0];

    if (isFixed) {
      const payloads = [];
      const [year, month] = targetMonth.split('-').map(Number);
      
      for (let i = 0; i < 12; i++) {
        const futureDate = new Date(year, (month - 1) + i, 15);
        const futureMonthRef = futureDate.toISOString().slice(0, 7);

        payloads.push({
          description: desc,
          amount: baseAmount,
          category_id: cat || null,
          paid_by_id: paidBy,
          is_shared: isShared,
          is_fixed: true,
          date: todayStr,
          month_reference: futureMonthRef
        });
      }

      const { error } = await supabase.from('transactions').insert(payloads);
      if (!error) {
        setDesc('');
        setVal('');
        fetchTransactions();
        alert('Gasto fixo agendado com sucesso!');
      } else {
        alert('Erro ao agendar.');
      }
    } else {
      const payload = {
        description: desc,
        amount: baseAmount,
        category_id: cat || null,
        paid_by_id: paidBy,
        is_shared: isShared,
        is_fixed: false,
        date: todayStr,
        month_reference: targetMonth
      };

      const { error } = await supabase.from('transactions').insert([payload]);
      if (!error) {
        setDesc('');
        setVal('');
        fetchTransactions();
      } else {
        alert('Erro ao salvar lançamento.');
      }
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (!error) {
      fetchTransactions();
    }
  };

  const processTextWithIA = async (text: string) => {
    setProcessingFile(true);
    try {
      const formData = new FormData();
      formData.append('text', text);
      formData.append('paid_by_id', user.id);
      formData.append('month_reference', targetMonth);

      const res = await fetch('/api/process-expense', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.expenses) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formattedExpenses = data.expenses.map((exp: any) => {
          const matchingCat = categories.find(c => c.name.toLowerCase().includes(exp.category.toLowerCase())) || categories[0];
          return {
            description: exp.description,
            amount: exp.amount,
            category_id: matchingCat?.id || null,
            paid_by_id: user.id,
            is_shared: exp.is_shared,
            is_fixed: false,
            date: new Date().toISOString().split('T')[0],
            month_reference: targetMonth
          };
        });

        const { error } = await supabase.from('transactions').insert(formattedExpenses);
        if (error) throw error;
        alert(`${formattedExpenses.length} despesas lançadas pela IA!`);
        fetchTransactions();
      } else {
        alert(data.error || 'Erro na IA.');
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      alert('Falha na IA: ' + errorMsg);
    } finally {
      setProcessingFile(false);
      setInputText('');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingFile(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('paid_by_id', user.id);
    formData.append('month_reference', targetMonth);

    try {
      const res = await fetch('/api/process-expense', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.expenses) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formattedExpenses = data.expenses.map((exp: any) => {
          const matchingCat = categories.find(c => c.name.toLowerCase().includes(exp.category.toLowerCase())) || categories[0];
          return {
            description: exp.description,
            amount: exp.amount,
            category_id: matchingCat?.id || null,
            paid_by_id: user.id,
            is_shared: exp.is_shared,
            is_fixed: false,
            date: new Date().toISOString().split('T')[0],
            month_reference: targetMonth
          };
        });

        const { error } = await supabase.from('transactions').insert(formattedExpenses);
        if (error) throw error;
        alert(`Extrato importado com sucesso!`);
        fetchTransactions();
      } else {
        alert(data.error || 'Erro ao importar PDF.');
      }
    } catch {
      alert('Erro no envio do arquivo.');
    } finally {
      setProcessingFile(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Cálculos matemáticos das despesas compartilhadas
  const my_paid_shared_total = transactions
    .filter(t => t.paid_by_id === user?.id && t.is_shared)
    .reduce((sum, t) => sum + t.amount, 0);

  const partner_paid_shared_total = transactions
    .filter(t => t.paid_by_id === partner?.id && t.is_shared)
    .reduce((sum, t) => sum + t.amount, 0);

  const netDebt = (my_paid_shared_total / 2) - (partner_paid_shared_total / 2);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mb-4" />
        <p className="text-sm font-semibold text-slate-600">Carregando painel financeiro...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col pb-12">
      {/* Cabeçalho */}
      <header className="bg-slate-900 text-white p-6 rounded-b-3xl shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-xs text-slate-400">Olá,</p>
            <h1 className="text-lg font-bold text-slate-100">{user?.user_metadata?.full_name || 'Usuário'}</h1>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-slate-800 rounded-full text-slate-300">
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Seletor de Mês de Visualização */}
        <div className="mb-4 flex items-center gap-2 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
          <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold text-slate-300 mr-1 shrink-0">Fatura ativa:</span>
          <select
            className="w-full bg-transparent text-sm font-bold text-white focus:outline-none cursor-pointer"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {monthOptions.map(opt => (
              <option key={opt.value} value={opt.value} className="text-slate-900 font-medium">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Card de Acerto de Contas */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-5 rounded-2xl shadow-md">
          <p className="text-[10px] text-teal-100 font-bold uppercase tracking-widest">
            Ajuste de Contas — {monthOptions.find(o => o.value === selectedMonth)?.label}
          </p>
          <div className="mt-2">
            {netDebt > 0 ? (
              <div>
                <h2 className="text-2xl font-black text-white">R$ {netDebt.toFixed(2)}</h2>
                <p className="text-xs text-teal-50">
                  {partner?.full_name || 'Sua parceira'} te deve (metade dos compartilhados pagos por você).
                </p>
              </div>
            ) : netDebt < 0 ? (
              <div>
                <h2 className="text-2xl font-black text-white">R$ {Math.abs(netDebt).toFixed(2)}</h2>
                <p className="text-xs text-red-100 font-medium">
                  Você deve para {partner?.full_name || 'sua parceira'} (metade dos compartilhados pagos por ela).
                </p>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-black text-white">Contas Zeradas!</h2>
                <p className="text-xs text-teal-100">Vocês estão quites este mês.</p>
              </div>
            )}
          </div>

          <div className="flex justify-between border-t border-white/20 mt-4 pt-3 text-[10px] text-teal-50">
            <div>
              <span>Você pagou:</span>
              <p className="font-bold text-xs text-white">R$ {my_paid_shared_total.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <span>Ela pagou:</span>
              <p className="font-bold text-xs text-white">R$ {partner_paid_shared_total.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Container Principal */}
      <main className="px-4 py-6 space-y-6 flex-1">
        
        {/* Seletor de Abas (Navegação Interna) */}
        <div className="flex bg-slate-200/60 p-1 rounded-xl shadow-inner border border-slate-200/30">
          <button
            onClick={() => setActiveTab('entries')}
            className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-all ${
              activeTab === 'entries'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Lançamentos & Registro
          </button>
          <button
            onClick={() => setActiveTab('charts')}
            className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-all ${
              activeTab === 'charts'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Gráficos & Análise 📊
          </button>
        </div>

        {/* ABA DE LANÇAMENTOS */}
        {activeTab === 'entries' && (
          <div className="space-y-6">
            {/* Escolha da Fatura de Destino */}
            <section className="bg-slate-100 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
              <div className="text-xs">
                <p className="font-bold text-slate-700">Lançar gastos para qual fatura?</p>
                <p className="text-[10px] text-slate-400">Escolha o mês de vencimento correspondente.</p>
              </div>
              <select
                className="p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 cursor-pointer focus:outline-none"
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
              >
                {monthOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </section>

            {/* Lançamento Rápido com IA */}
            <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" /> Lançamento Rápido com IA
              </h3>

              <div className="space-y-3">
                <textarea
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-400"
                  rows={2}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Escreva ex: "Gastei 150 no mercado hoje compartilhado". Vai cair na fatura de ${monthOptions.find(o => o.value === targetMonth)?.label}...`}
                />

                <div className="flex gap-2">
                  {inputText.trim().length > 0 && (
                    <button
                      onClick={() => processTextWithIA(inputText)}
                      disabled={processingFile}
                      className="flex-1 p-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" /> Enviar para IA
                    </button>
                  )}

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="application/pdf, text/plain"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={processingFile}
                    className="flex-1 p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-slate-200"
                  >
                    <FileText className="w-4 h-4 text-teal-600" />
                    {processingFile ? 'Lendo PDF...' : 'Subir PDF'}
                  </button>

                  <button
                    onClick={() => {
                      const simulaAudio = prompt("O que você diria no áudio?", "Lança 45 reais na pizza ontem de noite compartilhada");
                      if (simulaAudio) {
                        processTextWithIA(simulaAudio);
                      }
                    }}
                    className="p-2.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-xl text-xs font-bold transition-all border border-teal-200"
                    title="Mandar Áudio"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </section>

            {/* Lançamento Manual */}
            <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <details className="group">
                <summary className="text-sm font-bold text-slate-700 cursor-pointer list-none flex justify-between items-center">
                  <span className="flex items-center gap-1.5">
                    <PlusCircle className="w-4 h-4 text-emerald-600" /> Lançar Manualmente
                  </span>
                  <span className="text-xs text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>

                <form onSubmit={handleManualAdd} className="space-y-4 mt-4 pt-4 border-t border-slate-100">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase">Descrição</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none text-slate-800"
                        placeholder="Ex: Combustível"
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase">Valor (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none text-slate-800"
                        placeholder="0.00"
                        value={val}
                        onChange={(e) => setVal(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase">Quem Pagou?</label>
                      <select
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-800"
                        value={paidBy}
                        onChange={(e) => setPaidBy(e.target.value)}
                      >
                        <option value={user?.id}>Você</option>
                        {partner && <option value={partner.id}>{partner.full_name}</option>}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase">Categoria</label>
                      <select
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-800"
                        value={cat}
                        onChange={(e) => setCat(e.target.value)}
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isShared}
                        onChange={(e) => setIsShared(e.target.checked)}
                        className="rounded text-emerald-600"
                      />
                      Dividir meio a meio?
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isFixed}
                        onChange={(e) => setIsFixed(e.target.checked)}
                        className="rounded text-emerald-600"
                      />
                      Replicar por 12 meses?
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full p-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm"
                  >
                    Inserir na fatura de {monthOptions.find(o => o.value === targetMonth)?.label}
                  </button>
                </form>
              </details>
            </section>
          </div>
        )}

        {/* ABA DE GRÁFICOS VISUAIS */}
        {activeTab === 'charts' && isMounted && (
          <div className="space-y-6">
            
            {/* Gráfico 1: Despesas por Categoria */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <PieIcon className="w-4 h-4 text-emerald-600" /> Distribuição por Categoria
              </h4>
              {getCategoryData().length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs text-slate-400 font-medium">Sem dados de gastos para gerar o gráfico de pizza.</p>
                </div>
              ) : (
                <div>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={getCategoryData()}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={3}
                        >
                          {getCategoryData().map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <ChartTooltip formatter={(value) => `R$ ${Number(value).toFixed(2)}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legenda Customizada */}
                  <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-50 mt-2">
                    {getCategoryData().map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                        <span className="text-slate-600 truncate font-semibold">{entry.name}:</span>
                        <span className="text-slate-800 font-black ml-auto">R$ {entry.value.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Gráfico 2: Comparativo Quem Gastou Mais */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-teal-600" /> Comparativo: Quem Gastou Mais?
              </h4>
              
              {transactions.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs text-slate-400 font-medium">Sem dados de gastos para comparar este mês.</p>
                </div>
              ) : (
                <>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getComparisonData()} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <ChartTooltip formatter={(value) => `R$ ${Number(value).toFixed(2)}`} />
                        <Bar dataKey="Gasto" radius={[6, 6, 0, 0]}>
                          {getComparisonData().map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Estatísticas de Apoio */}
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100/50">
                    <div className="text-xs">
                      <span className="text-slate-500 font-medium">Gasto Total Geral:</span>
                      <p className="text-slate-800 font-black text-sm">
                        R$ {(getComparisonData().reduce((acc, curr) => acc + curr['Gasto'], 0)).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-xs text-right">
                      <span className="text-slate-500 font-medium">Média por Pessoa:</span>
                      <p className="text-teal-700 font-black text-sm">
                        R$ {((getComparisonData().reduce((acc, curr) => acc + curr['Gasto'], 0)) / 2).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>
        )}

        {/* LISTA DE LANÇAMENTOS (Sempre visível como auditoria rápida) */}
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-slate-700 px-1">
            Histórico — {monthOptions.find(o => o.value === selectedMonth)?.label}
          </h3>
          <div className="space-y-2.5">
            {transactions.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl text-center border border-slate-100 text-slate-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">Nenhum lançamento agendado para esta fatura.</p>
              </div>
            ) : (
              transactions.map((t) => (
                <div key={t.id} className="bg-white p-4 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-2.5 h-10 rounded-full"
                      style={{ backgroundColor: t.categories?.color || '#cbd5e1' }}
                    />
                    <div>
                      <p className="font-bold text-sm text-slate-800">{t.description}</p>
                      <div className="flex gap-2 items-center text-[10px] text-slate-400 font-semibold mt-0.5">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 uppercase">
                          {t.categories?.name || 'Outros'}
                        </span>
                        {t.is_shared && (
                          <span className="bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded">
                            Dividido
                          </span>
                        )}
                        {t.is_fixed && (
                          <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">
                            Fixo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-sm text-slate-800">R$ {t.amount.toFixed(2)}</p>
                      <p className="text-[9px] text-slate-400 font-medium">
                        Pago por {t.paid_by_id === user?.id ? 'Você' : partner?.full_name || 'Parceira'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
