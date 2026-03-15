import React, { useState, useMemo, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { auth, loginWithGoogle, logout, User, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  updateDoc,
  orderBy,
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import Markdown from 'react-markdown';
import { 
  LayoutDashboard, 
  ListPlus, 
  TrendingUp, 
  Wallet, 
  Percent, 
  BarChart3, 
  PlusCircle, 
  Trash2, 
  Code2, 
  Copy, 
  CheckCircle2,
  ChevronRight,
  PieChart as PieChartIcon,
  Target,
  AlertTriangle,
  Award,
  Calculator,
  TrendingUp as TrendingUpIcon,
  Coins,
  Calendar,
  ArrowRightLeft,
  History,
  Filter,
  Activity,
  Zap,
  LineChart as LucideLineChart,
  Info,
  HelpCircle,
  Trophy,
  ShieldAlert,
  ShieldCheck,
  Dices,
  BarChartHorizontal,
  Download,
  Share2,
  FileText,
  Clock,
  Bell,
  X,
  Search,
  Settings,
  Lock,
  ChevronLeft,
  ChevronDown,
  PlayCircle,
  PauseCircle,
  Volume2,
  Maximize2,
  Menu,
  SkipBack,
  SkipForward,
  Star,
  Bookmark,
  List,
  LogOut,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  BarChart,
  Bar,
  Cell,
  Legend,
  PieChart,
  Pie
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Lancamento, Resultado, BankrollStats, MERCADOS_FUTEBOL, LIGAS_TIMES, BacktestFilter, BacktestResult } from './types';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const GAS_SCRIPT = `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Script para Gestão de Banca de Trader Esportivo Profissional
 */

function setupBankrollSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Criar Abas
  let dashSheet = ss.getSheetByName('DASHBOARD');
  if (!dashSheet) dashSheet = ss.insertSheet('DASHBOARD');
  
  let lancSheet = ss.getSheetByName('LANÇAMENTOS');
  if (!lancSheet) lancSheet = ss.insertSheet('LANÇAMENTOS');
  
  // 2. Design Dashboard
  dashSheet.clear();
  dashSheet.setGridlinesGraphicallyHidden(true);
  dashSheet.getRange('A1:Z100').setBackground('#212121');
  
  // Cards no Dashboard
  const cards = [
    ['BANCA INICIAL', 'BANCA ATUAL', 'ROI%', 'YIELD%'],
    [1000, '=B2+SUM(LANÇAMENTOS!H:H)', '=IF(SUM(LANÇAMENTOS!F:F)>0; (SUM(LANÇAMENTOS!H:H)/SUM(LANÇAMENTOS!F:F))*100; 0)', '=IF(COUNT(LANÇAMENTOS!H:H)>0; (SUM(LANÇAMENTOS!H:H)/COUNT(LANÇAMENTOS!H:H)); 0)']
  ];
  
  const cardRange = dashSheet.getRange('B2:E3');
  cardRange.setValues(cards);
  cardRange.setFontColor('#FFFFFF');
  cardRange.setHorizontalAlignment('center');
  cardRange.setVerticalAlignment('middle');
  
  // Estilo dos Títulos dos Cards
  dashSheet.getRange('B2:E2').setFontSize(12).setFontWeight('bold').setBackground('#2d2d2d');
  // Estilo dos Valores dos Cards
  dashSheet.getRange('B3:E3').setFontSize(24).setFontWeight('bold').setBackground('#333333').setNumberFormat('0.00"%"');
  dashSheet.getRange('B3:C3').setNumberFormat('"R$ "#,##0.00');
  
  // 3. Estrutura Lançamentos
  lancSheet.clear();
  const headers = [['Data', 'Competição', 'Evento', 'Mercado', 'Odd', 'Stake', 'Resultado', 'Lucro Líquido']];
  lancSheet.getRange(1, 1, 1, 8).setValues(headers)
    .setBackground('#000000')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  
  // 4. Automação de Fórmulas e Validação
  const lastRow = 1000;
  
  // Fórmula Lucro Líquido
  // Coluna G = Resultado, E = Odd, F = Stake
  const formulaRange = lancSheet.getRange(2, 8, lastRow - 1, 1);
  formulaRange.setFormulaR1C1('=IF(RC[-1]="Green"; (RC[-3]*RC[-2])-RC[-2]; IF(RC[-1]="Red"; -RC[-2]; IF(RC[-1]="Meio Green"; ((RC[-3]*RC[-2])-RC[-2])/2; IF(RC[-1]="Meio Red"; -RC[-2]/2; 0))))');
  
  // Validação de Dados - Resultado
  const resValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Green', 'Red', 'Meio Green', 'Meio Red', 'Void'], true)
    .build();
  lancSheet.getRange(2, 7, lastRow - 1, 1).setDataValidation(resValidation);
  
  // Validação de Dados - Mercado
  const mercados = ['Match Odds (1X2)', 'Over 0.5 HT', 'Over 1.5 FT', 'Over 2.5 FT', 'Under 2.5 FT', 'Ambas Marcam', 'Handicap Asiático', 'DNB', 'Cantos'];
  const mercValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList(mercados, true)
    .build();
  lancSheet.getRange(2, 4, lastRow - 1, 1).setDataValidation(mercValidation);
  
  // 6. Formatação Condicional
  const rangeLucro = lancSheet.getRange(2, 8, lastRow - 1, 1);
  
  const ruleGreen = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(0)
    .setFontColor('#00FF00')
    .setRanges([rangeLucro])
    .build();
    
  const ruleRed = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(0)
    .setFontColor('#FF0000')
    .setRanges([rangeLucro])
    .build();
    
  const rules = lancSheet.getConditionalFormatRules();
  rules.push(ruleGreen);
  rules.push(ruleRed);
  lancSheet.setConditionalFormatRules(rules);
  
  SpreadsheetApp.getUi().alert('Planilha Profissional Gerada com Sucesso!');
}`;

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Ocorreu um erro inesperado.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error && parsed.error.includes("Missing or insufficient permissions")) {
          errorMessage = "Você não tem permissão para realizar esta operação ou acessar estes dados.";
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-brand-card p-8 rounded-3xl border border-brand-danger/20 shadow-2xl">
            <div className="w-20 h-20 bg-brand-danger/10 rounded-2xl flex items-center justify-center mx-auto mb-8">
              <ShieldAlert className="text-brand-danger w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold mb-4 text-white">Ops! Algo deu errado</h1>
            <p className="text-white/40 mb-8">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-brand-accent text-brand-bg rounded-xl font-bold hover:bg-brand-accent/90 transition-all"
            >
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'lancamentos' | 'analise' | 'calculadora' | 'backtest' | 'probabilidades' | 'agenda' | 'script'>('dashboard');
  const [bancaInicial, setBancaInicial] = useState<number>(1000);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [agenda, setAgenda] = useState<{id: string, data: string, titulo: string, comentario: string, lembrete: boolean, diasAntecedencia: number, horarioLembrete: string, quantidadeLembretes: number}[]>([]);
  const [notifications, setNotifications] = useState<{id: string, type: 'mensagem' | 'aviso' | 'agenda' | 'sistema', title: string, content: string, date: string, read: boolean}[]>([]);
  const [notifSettings, setNotifSettings] = useState({ global: true, dias: 3, horario: '09:00', quantidade: 1 });
  const [lastLogin, setLastLogin] = useState<string>(new Date().toISOString());
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifTab, setNotifTab] = useState<'novas' | 'historico'>('novas');
  const [showFunctionsDropdown, setShowFunctionsDropdown] = useState(false);
  const [copied, setCopied] = useState(false);

  // Test Firestore Connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Data Sync
  useEffect(() => {
    if (!user) {
      setLancamentos([]);
      setAgenda([]);
      return;
    }

    setIsLoadingData(true);

    // Sync User Profile
    const userDocRef = doc(db, 'users', user.uid);
    const unsubProfile = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.bancaInicial !== undefined) setBancaInicial(data.bancaInicial);
        if (data.notifSettings) setNotifSettings(data.notifSettings);
      } else {
        // Initialize user profile if it doesn't exist
        setDoc(userDocRef, {
          email: user.email,
          displayName: user.displayName,
          bancaInicial: 1000,
          notifSettings: { global: true, dias: 3, horario: '09:00', quantidade: 1 },
          createdAt: Timestamp.now()
        }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`));
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`));

    // Sync Lancamentos
    const lancamentosRef = collection(db, 'users', user.uid, 'lancamentos');
    const qLancamentos = query(lancamentosRef, orderBy('data', 'desc'));
    const unsubLancamentos = onSnapshot(qLancamentos, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lancamento));
      setLancamentos(data);
      setIsLoadingData(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/lancamentos`));

    // Sync Agenda
    const agendaRef = collection(db, 'users', user.uid, 'agenda');
    const qAgenda = query(agendaRef, orderBy('data', 'asc'));
    const unsubAgenda = onSnapshot(qAgenda, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setAgenda(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/agenda`));

    return () => {
      unsubProfile();
      unsubLancamentos();
      unsubAgenda();
    };
  }, [user]);

  // Agenda Notification Check
  useEffect(() => {
    const checkAgendaNotifications = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      agenda.forEach(event => {
        if (!event.lembrete) return;

        const dias = notifSettings.global ? notifSettings.dias : event.diasAntecedencia;
        const horario = notifSettings.global ? notifSettings.horario : event.horarioLembrete;
        
        const [targetHour, targetMinute] = horario.split(':').map(Number);
        
        const eventDate = new Date(event.data);
        const triggerDate = new Date(eventDate);
        triggerDate.setDate(eventDate.getDate() - dias);
        triggerDate.setHours(targetHour, targetMinute, 0, 0);

        // If now is past the trigger time and within the event window
        if (now >= triggerDate && now <= new Date(new Date(event.data).setHours(23, 59, 59, 999))) {
          const exists = notifications.find(n => n.id === `agenda-${event.id}`);
          if (!exists) {
            setNotifications(prev => [{
              id: `agenda-${event.id}`,
              type: 'agenda',
              title: 'Lembrete de Evento',
              content: `O evento "${event.titulo}" está programado para ${new Date(event.data).toLocaleDateString()}.`,
              date: new Date().toISOString(),
              read: false
            }, ...prev]);
          }
        }
      });
    };

    const interval = setInterval(checkAgendaNotifications, 60000); // Check every minute
    checkAgendaNotifications();
    return () => clearInterval(interval);
  }, [agenda, notifSettings, notifications]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const activeNotifications = notifications.filter(n => !n.read);
  const historyNotifications = notifications.filter(n => n.read);
  const displayNotifications = notifTab === 'novas' ? activeNotifications : historyNotifications;

  // Form state
  const [formData, setFormData] = useState({
    data: new Date().toISOString().split('T')[0],
    competicao: Object.keys(LIGAS_TIMES)[0],
    timeCasa: '',
    timeFora: '',
    eventoManual: '',
    mercado: MERCADOS_FUTEBOL[0],
    odd: 2.0,
    stake: 50,
    resultado: 'Green' as Resultado
  });

  const availableTeams = useMemo(() => {
    return LIGAS_TIMES[formData.competicao] || [];
  }, [formData.competicao]);

  // Calculate stats
  const stats = useMemo((): BankrollStats => {
    const totalStake = lancamentos.reduce((acc, curr) => acc + curr.stake, 0);
    const totalProfit = lancamentos.reduce((acc, curr) => acc + curr.lucroLiquido, 0);
    const bancaAtual = bancaInicial + totalProfit;
    const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
    const yieldVal = lancamentos.length > 0 ? (totalProfit / lancamentos.length) : 0;

    return {
      bancaInicial,
      bancaAtual,
      roi,
      yield: yieldVal,
      totalStake,
      totalProfit
    };
  }, [lancamentos, bancaInicial]);

  const chartData = useMemo(() => {
    let currentBanca = bancaInicial;
    return [
      { name: 'Início', banca: bancaInicial },
      ...lancamentos.map((l, i) => {
        currentBanca += l.lucroLiquido;
        return { name: `Op ${i + 1}`, banca: currentBanca };
      })
    ];
  }, [lancamentos, bancaInicial]);

  const marketStats = useMemo(() => {
    const stats: Record<string, { 
      mercado: string, 
      profit: number, 
      count: number, 
      stake: number, 
      greens: number,
      roi: number 
    }> = {};

    lancamentos.forEach(l => {
      if (!stats[l.mercado]) {
        stats[l.mercado] = { mercado: l.mercado, profit: 0, count: 0, stake: 0, greens: 0, roi: 0 };
      }
      stats[l.mercado].profit += l.lucroLiquido;
      stats[l.mercado].count += 1;
      stats[l.mercado].stake += l.stake;
      if (l.resultado === 'Green' || l.resultado === 'Meio Green') {
        stats[l.mercado].greens += 1;
      }
    });

    return Object.values(stats).map(s => ({
      ...s,
      roi: s.stake > 0 ? (s.profit / s.stake) * 100 : 0,
      winRate: (s.greens / s.count) * 100
    })).sort((a, b) => b.profit - a.profit);
  }, [lancamentos]);

  const bestMarket = useMemo(() => marketStats[0] || null, [marketStats]);
  const worstMarket = useMemo(() => marketStats[marketStats.length - 1] || null, [marketStats]);

  const handleAddLancamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    let lucro = 0;
    const { odd, stake, resultado, timeCasa, timeFora, eventoManual } = formData;
    
    if (resultado === 'Green') lucro = (stake * odd) - stake;
    else if (resultado === 'Red') lucro = -stake;
    else if (resultado === 'Meio Green') lucro = ((stake * odd) - stake) / 2;
    else if (resultado === 'Meio Red') lucro = -stake / 2;
    else lucro = 0;

    const evento = (timeCasa && timeFora) ? `${timeCasa} vs ${timeFora}` : eventoManual;

    const newLancamento = {
      data: formData.data,
      competicao: formData.competicao,
      evento: evento || 'Evento Desconhecido',
      mercado: formData.mercado,
      odd: formData.odd,
      stake: formData.stake,
      resultado: formData.resultado,
      lucroLiquido: lucro,
      createdAt: Timestamp.now()
    };

    try {
      const lancamentosRef = collection(db, 'users', user.uid, 'lancamentos');
      await addDoc(lancamentosRef, newLancamento);
      // Reset some fields but keep context
      setFormData(prev => ({ ...prev, timeCasa: '', timeFora: '', eventoManual: '' }));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/lancamentos`);
    }
  };

  const removeLancamento = async (id: string) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'lancamentos', id);
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/lancamentos/${id}`);
    }
  };

  const updateBancaInicial = async (novaBanca: number) => {
    if (!user) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { bancaInicial: novaBanca });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const updateNotifSettings = async (newSettings: any) => {
    if (!user) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { notifSettings: newSettings });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(GAS_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-brand-card p-8 rounded-3xl border border-white/5 shadow-2xl text-center"
        >
          <div className="w-20 h-20 bg-brand-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-8">
            <Lock className="text-brand-accent w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Scout Pro AI</h1>
          <p className="text-white/40 mb-10">
            Acesse a plataforma de gestão e análise de trading esportivo mais avançada do mercado.
          </p>
          
          <button 
            onClick={loginWithGoogle}
            className="w-full py-4 bg-white text-black rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-white/90 transition-all shadow-lg"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Entrar com Google
          </button>
          
          <p className="mt-8 text-[10px] text-white/20 uppercase tracking-widest">
            Ao entrar, você concorda com nossos termos de uso.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sidebar / Navigation */}
      <nav className="bg-brand-card border-b border-white/5 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-50 gap-4">
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-brand-accent rounded-xl flex items-center justify-center shadow-lg shadow-brand-accent/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-bg w-5 h-5 md:w-6 md:h-6">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <circle cx="12" cy="12" r="3" />
              <path d="M9 3c0 1.5 1.5 3 3 3s3-1.5 3-3" />
              <path d="M9 21c0-1.5 1.5-3 3-3s3 1.5 3 3" />
            </svg>
          </div>
          <div className="hidden sm:block">
            <h1 className="font-bold text-sm md:text-lg tracking-tight leading-none">SCOUT PRO</h1>
            <p className="text-[8px] md:text-[10px] uppercase tracking-widest text-white/40 font-semibold mt-0.5">Advanced Sports Analytics</p>
          </div>
        </div>

        <div className="flex gap-0.5 md:gap-1 bg-black/20 p-1 rounded-xl items-center">
          <NavButton 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
            icon={<LayoutDashboard size={18} />}
            label="Dashboard"
          />
          <NavButton 
            active={activeTab === 'lancamentos'} 
            onClick={() => setActiveTab('lancamentos')}
            icon={<ListPlus size={18} />}
            label="Lançamentos"
          />
          <NavButton 
            active={activeTab === 'calculadora'} 
            onClick={() => setActiveTab('calculadora')}
            icon={<Calculator size={18} />}
            label="Calculadora"
          />

          <div className="relative ml-1">
            <button
              onClick={() => setShowFunctionsDropdown(!showFunctionsDropdown)}
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200",
                ['analise', 'backtest', 'probabilidades', 'agenda', 'script'].includes(activeTab)
                  ? "bg-brand-accent text-brand-bg shadow-lg shadow-brand-accent/20"
                  : "text-white/40 hover:text-white hover:bg-white/5"
              )}
              title="Mais Funções"
            >
              <Menu size={20} />
            </button>

            <AnimatePresence>
              {showFunctionsDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowFunctionsDropdown(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full right-0 mt-2 w-52 bg-brand-card border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                    style={{ transformOrigin: 'top right' }}
                  >
                    <div className="p-1.5 space-y-0.5">
                      <DropdownItem 
                        active={activeTab === 'probabilidades'}
                        onClick={() => { setActiveTab('probabilidades'); setShowFunctionsDropdown(false); }}
                        icon={<Zap size={16} className="text-brand-accent" />}
                        label="IA Scout"
                      />
                      <DropdownItem 
                        active={activeTab === 'analise'}
                        onClick={() => { setActiveTab('analise'); setShowFunctionsDropdown(false); }}
                        icon={<PieChartIcon size={16} />}
                        label="Análise"
                      />
                      <DropdownItem 
                        active={activeTab === 'backtest'}
                        onClick={() => { setActiveTab('backtest'); setShowFunctionsDropdown(false); }}
                        icon={<History size={16} />}
                        label="Backtest"
                      />
                      <DropdownItem 
                        active={activeTab === 'agenda'}
                        onClick={() => { setActiveTab('agenda'); setShowFunctionsDropdown(false); }}
                        icon={<Calendar size={16} />}
                        label="Agenda"
                      />
                      <div className="h-px bg-white/5 my-1" />
                      <DropdownItem 
                        active={activeTab === 'script'}
                        onClick={() => { setActiveTab('script'); setShowFunctionsDropdown(false); }}
                        icon={<Code2 size={16} />}
                        label="Planilha (GAS)"
                      />
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 hover:bg-white/5 rounded-lg transition-colors group"
            >
              <Bell size={20} className={cn(unreadCount > 0 ? "text-brand-accent animate-pulse" : "text-white/40 group-hover:text-white")} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-brand-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-brand-card">
                  {unreadCount}
                </span>
              )}
            </button>
            
            <AnimatePresence>
              {showNotifications && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-80 bg-brand-card border border-white/10 rounded-2xl shadow-2xl z-[60] overflow-hidden"
                >
                  <div className="p-4 border-b border-white/5 bg-black/20 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-white/80">Notificações</h3>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setNotifTab(notifTab === 'novas' ? 'historico' : 'novas')}
                        className="text-[10px] font-bold uppercase tracking-widest text-brand-accent hover:text-brand-accent/80 transition-colors"
                      >
                        {notifTab === 'novas' ? 'Ver Histórico' : 'Ver Novas'}
                      </button>
                      <button onClick={() => setShowNotifications(false)} className="text-white/20 hover:text-white">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-black/10 px-4 py-2 border-b border-white/5 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                      {notifTab === 'novas' ? 'Novas Mensagens' : 'Histórico de Mensagens'}
                    </span>
                    {notifTab === 'novas' && unreadCount > 0 && (
                      <button 
                        onClick={() => setNotifications(notifications.map(n => ({...n, read: true})))}
                        className="text-[9px] font-bold text-white/40 hover:text-white uppercase"
                      >
                        Limpar Tudo
                      </button>
                    )}
                  </div>

                  <div className="max-h-[400px] overflow-y-auto no-scrollbar">
                    {displayNotifications.length > 0 ? (
                      displayNotifications.map(n => (
                        <div 
                          key={n.id} 
                          onClick={() => {
                            if (!n.read) {
                              setNotifications(notifications.map(notif => notif.id === n.id ? {...notif, read: true} : notif));
                            }
                          }}
                          className={cn(
                            "p-4 border-b border-white/5 cursor-pointer transition-colors hover:bg-white/5",
                            !n.read && "bg-brand-accent/[0.03]"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                              n.type === 'aviso' ? "bg-brand-danger/10 text-brand-danger" : 
                              n.type === 'mensagem' ? "bg-brand-accent/10 text-brand-accent" :
                              "bg-blue-400/10 text-blue-400"
                            )}>
                              {n.type === 'aviso' ? <ShieldAlert size={16} /> : n.type === 'agenda' ? <Calendar size={16} /> : <Info size={16} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-white/90 mb-1">{n.title}</p>
                              <p className="text-[10px] text-white/40 leading-relaxed line-clamp-2">{n.content}</p>
                              <p className="text-[9px] text-white/20 mt-2">{new Date(n.date).toLocaleString()}</p>
                            </div>
                            {!n.read && <div className="w-1.5 h-1.5 bg-brand-accent rounded-full mt-1.5" />}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-12 text-center">
                        <Bell className="w-8 h-8 text-white/5 mx-auto mb-4" />
                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Nenhuma notificação</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="h-8 w-px bg-white/10 hidden sm:block" />

          <div className="flex items-center gap-3 pl-1">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold truncate max-w-[100px]">{user?.displayName}</p>
              <p className="text-[8px] text-white/40 uppercase tracking-widest">Premium</p>
            </div>
            <div className="relative group">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl overflow-hidden border border-white/10 group-hover:border-brand-accent/50 transition-colors">
                <img src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}`} alt="Profile" className="w-full h-full object-cover" />
              </div>
              <button 
                onClick={logout}
                className="absolute -bottom-1 -right-1 w-5 h-5 bg-brand-danger text-white rounded-lg flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                title="Sair"
              >
                <LogOut size={12} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                  title="Banca Inicial" 
                  value={stats.bancaInicial} 
                  icon={<Wallet className="text-blue-400" />}
                  isCurrency
                  editable
                  onEdit={(val) => updateBancaInicial(Number(val))}
                />
                <StatCard 
                  title="Banca Atual" 
                  value={stats.bancaAtual} 
                  icon={<TrendingUp className={stats.bancaAtual >= stats.bancaInicial ? "text-brand-accent" : "text-brand-danger"} />}
                  isCurrency
                  trend={stats.bancaAtual - stats.bancaInicial}
                />
                <StatCard 
                  title="ROI%" 
                  value={stats.roi} 
                  icon={<Percent className="text-purple-400" />}
                  isPercent
                />
                <StatCard 
                  title="Yield Médio" 
                  value={stats.yield} 
                  icon={<BarChart3 className="text-orange-400" />}
                  isCurrency
                />
              </div>

              {/* Market Summary row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-brand-card p-5 rounded-2xl border border-white/5 shadow-lg flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-accent/10 rounded-xl flex items-center justify-center shrink-0">
                    <Award className="text-brand-accent" size={24} />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Melhor Mercado</div>
                    <div className="text-lg font-bold">{bestMarket ? bestMarket.mercado : 'N/A'}</div>
                    <div className="text-xs text-brand-accent font-mono">
                      {bestMarket ? `+R$ ${bestMarket.profit.toFixed(2)} (${bestMarket.roi.toFixed(1)}% ROI)` : 'Sem dados'}
                    </div>
                  </div>
                </div>
                <div className="bg-brand-card p-5 rounded-2xl border border-white/5 shadow-lg flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-danger/10 rounded-xl flex items-center justify-center shrink-0">
                    <AlertTriangle className="text-brand-danger" size={24} />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Pior Mercado</div>
                    <div className="text-lg font-bold">{worstMarket ? worstMarket.mercado : 'N/A'}</div>
                    <div className="text-xs text-brand-danger font-mono">
                      {worstMarket ? `R$ ${worstMarket.profit.toFixed(2)} (${worstMarket.roi.toFixed(1)}% ROI)` : 'Sem dados'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Chart Section */}
              <div className="bg-brand-card rounded-2xl p-6 border border-white/5 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-semibold text-white/80 flex items-center gap-2">
                    <TrendingUp size={20} className="text-brand-accent" />
                    Evolução da Banca
                  </h2>
                  <div className="text-xs text-white/40 font-mono">
                    {lancamentos.length} operações registradas
                  </div>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorBanca" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00e676" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#00e676" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#ffffff20" 
                        fontSize={10} 
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="#ffffff20" 
                        fontSize={10} 
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => `R$${val}`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#2d2d2d', border: 'none', borderRadius: '8px', fontSize: '12px' }}
                        itemStyle={{ color: '#00e676' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="banca" 
                        stroke="#00e676" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorBanca)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'lancamentos' && (
            <motion.div 
              key="lancamentos"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Form Card */}
              <div className="bg-brand-card rounded-2xl p-6 border border-white/5 shadow-xl">
                <h2 className="font-semibold text-white/80 mb-6 flex items-center gap-2">
                  <PlusCircle size={20} className="text-brand-accent" />
                  Novo Lançamento
                </h2>
                <form onSubmit={handleAddLancamento} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <InputGroup label="Data">
                    <input 
                      type="date" 
                      className="form-input" 
                      value={formData.data}
                      onChange={e => setFormData({...formData, data: e.target.value})}
                      required
                    />
                  </InputGroup>
                  <InputGroup label="Competição (Liga)">
                    <select 
                      className="form-input"
                      value={formData.competicao}
                      onChange={e => setFormData({...formData, competicao: e.target.value, timeCasa: '', timeFora: ''})}
                    >
                      {Object.keys(LIGAS_TIMES).map(liga => <option key={liga} value={liga}>{liga}</option>)}
                    </select>
                  </InputGroup>
                  
                  {formData.competicao !== 'Outros' ? (
                    <>
                      <InputGroup label="Time da Casa">
                        <select 
                          className="form-input"
                          value={formData.timeCasa}
                          onChange={e => setFormData({...formData, timeCasa: e.target.value})}
                          required
                        >
                          <option value="">Selecione...</option>
                          {availableTeams.map(time => <option key={time} value={time}>{time}</option>)}
                        </select>
                      </InputGroup>
                      <InputGroup label="Time de Fora">
                        <select 
                          className="form-input"
                          value={formData.timeFora}
                          onChange={e => setFormData({...formData, timeFora: e.target.value})}
                          required
                        >
                          <option value="">Selecione...</option>
                          {availableTeams.map(time => <option key={time} value={time}>{time}</option>)}
                        </select>
                      </InputGroup>
                    </>
                  ) : (
                    <InputGroup label="Evento Manual">
                      <input 
                        type="text" 
                        placeholder="Ex: Arsenal vs Liverpool" 
                        className="form-input" 
                        value={formData.eventoManual}
                        onChange={e => setFormData({...formData, eventoManual: e.target.value})}
                        required
                      />
                    </InputGroup>
                  )}
                  <InputGroup label="Mercado">
                    <select 
                      className="form-input"
                      value={formData.mercado}
                      onChange={e => setFormData({...formData, mercado: e.target.value})}
                    >
                      {MERCADOS_FUTEBOL.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </InputGroup>
                  <InputGroup label="Odd">
                    <input 
                      type="number" 
                      step="0.01" 
                      className="form-input" 
                      value={formData.odd}
                      onChange={e => setFormData({...formData, odd: Number(e.target.value)})}
                      onFocus={(e) => e.target.select()}
                      required
                    />
                  </InputGroup>
                  <InputGroup label="Stake (R$)">
                    <input 
                      type="number" 
                      step="0.01" 
                      className="form-input" 
                      value={formData.stake}
                      onChange={e => setFormData({...formData, stake: Number(e.target.value)})}
                      onFocus={(e) => e.target.select()}
                      required
                    />
                  </InputGroup>
                  <InputGroup label="Resultado">
                    <select 
                      className="form-input"
                      value={formData.resultado}
                      onChange={e => setFormData({...formData, resultado: e.target.value as Resultado})}
                    >
                      <option value="Green">Green</option>
                      <option value="Red">Red</option>
                      <option value="Meio Green">Meio Green</option>
                      <option value="Meio Red">Meio Red</option>
                      <option value="Void">Void</option>
                    </select>
                  </InputGroup>
                  <div className="flex items-end">
                    <button 
                      type="submit" 
                      className="w-full bg-brand-accent hover:bg-brand-accent/90 text-brand-bg font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-accent/20"
                    >
                      <PlusCircle size={18} />
                      Lançar Operação
                    </button>
                  </div>
                </form>
              </div>

              {/* Table Card */}
              <div className="bg-brand-card rounded-2xl border border-white/5 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-black/40 text-[10px] uppercase tracking-widest font-bold text-white/40">
                        <th className="px-6 py-4">Data</th>
                        <th className="px-6 py-4">Evento / Competição</th>
                        <th className="px-6 py-4">Mercado</th>
                        <th className="px-6 py-4">Odd</th>
                        <th className="px-6 py-4">Stake</th>
                        <th className="px-6 py-4">Resultado</th>
                        <th className="px-6 py-4">Lucro Líquido</th>
                        <th className="px-6 py-4">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {lancamentos.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center text-white/20 italic">
                            Nenhuma operação registrada ainda.
                          </td>
                        </tr>
                      ) : (
                        lancamentos.map((l) => (
                          <tr key={l.id} className="hover:bg-white/5 transition-colors group">
                            <td className="px-6 py-4 text-sm font-mono opacity-60">{l.data}</td>
                            <td className="px-6 py-4">
                              <div className="font-medium text-sm">{l.evento}</div>
                              <div className="text-[10px] text-white/40">{l.competicao}</div>
                            </td>
                            <td className="px-6 py-4 text-xs font-semibold text-white/60">{l.mercado}</td>
                            <td className="px-6 py-4 text-sm font-mono">{l.odd.toFixed(2)}</td>
                            <td className="px-6 py-4 text-sm font-mono">R$ {l.stake.toFixed(2)}</td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-2 py-1 rounded text-[10px] font-bold uppercase",
                                l.resultado === 'Green' && "bg-brand-accent/10 text-brand-accent",
                                l.resultado === 'Red' && "bg-brand-danger/10 text-brand-danger",
                                l.resultado === 'Meio Green' && "bg-emerald-400/10 text-emerald-400",
                                l.resultado === 'Meio Red' && "bg-orange-400/10 text-orange-400",
                                l.resultado === 'Void' && "bg-white/10 text-white/40"
                              )}>
                                {l.resultado}
                              </span>
                            </td>
                            <td className={cn(
                              "px-6 py-4 text-sm font-bold font-mono",
                              l.lucroLiquido > 0 ? "text-brand-accent" : l.lucroLiquido < 0 ? "text-brand-danger" : "text-white/40"
                            )}>
                              {l.lucroLiquido > 0 ? '+' : ''}R$ {l.lucroLiquido.toFixed(2)}
                            </td>
                            <td className="px-6 py-4">
                              <button 
                                onClick={() => removeLancamento(l.id)}
                                className="p-2 hover:bg-brand-danger/10 text-white/20 hover:text-brand-danger rounded-lg transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'analise' && (
            <motion.div 
              key="analise"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Profit by Market Chart */}
                <div className="bg-brand-card rounded-2xl p-6 border border-white/5 shadow-xl">
                  <h2 className="font-semibold text-white/80 mb-6 flex items-center gap-2">
                    <Target size={20} className="text-brand-accent" />
                    Lucratividade por Mercado
                  </h2>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={marketStats} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={false} />
                        <XAxis type="number" stroke="#ffffff20" fontSize={10} tickFormatter={(val) => `R$${val}`} />
                        <YAxis dataKey="mercado" type="category" stroke="#ffffff20" fontSize={10} width={120} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#2d2d2d', border: 'none', borderRadius: '8px', fontSize: '12px' }}
                          formatter={(val: number) => [`R$ ${val.toFixed(2)}`, 'Lucro']}
                        />
                        <Bar dataKey="profit" radius={[0, 4, 4, 0]}>
                          {marketStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#00e676' : '#ff5252'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* ROI by Market Chart */}
                <div className="bg-brand-card rounded-2xl p-6 border border-white/5 shadow-xl">
                  <h2 className="font-semibold text-white/80 mb-6 flex items-center gap-2">
                    <Percent size={20} className="text-purple-400" />
                    ROI% por Mercado
                  </h2>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={marketStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                        <XAxis dataKey="mercado" stroke="#ffffff20" fontSize={8} interval={0} angle={-45} textAnchor="end" height={80} />
                        <YAxis stroke="#ffffff20" fontSize={10} tickFormatter={(val) => `${val}%`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#2d2d2d', border: 'none', borderRadius: '8px', fontSize: '12px' }}
                          formatter={(val: number) => [`${val.toFixed(2)}%`, 'ROI']}
                        />
                        <Bar dataKey="roi" fill="#a855f7" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Detailed Market Table */}
              <div className="bg-brand-card rounded-2xl border border-white/5 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-white/5">
                  <h2 className="font-semibold text-white/80 flex items-center gap-2">
                    <BarChart3 size={20} className="text-orange-400" />
                    Métricas Detalhadas por Mercado
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-black/40 text-[10px] uppercase tracking-widest font-bold text-white/40">
                        <th className="px-6 py-4">Mercado</th>
                        <th className="px-6 py-4">Operações</th>
                        <th className="px-6 py-4">Win Rate</th>
                        <th className="px-6 py-4">Volume (Stake)</th>
                        <th className="px-6 py-4">Lucro Total</th>
                        <th className="px-6 py-4">ROI%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {marketStats.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-white/20 italic">
                            Nenhum dado para análise.
                          </td>
                        </tr>
                      ) : (
                        marketStats.map((s) => (
                          <tr key={s.mercado} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4 font-medium text-sm">{s.mercado}</td>
                            <td className="px-6 py-4 text-sm font-mono">{s.count}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden min-w-[60px]">
                                  <div 
                                    className="h-full bg-brand-accent" 
                                    style={{ width: `${s.winRate}%` }}
                                  />
                                </div>
                                <span className="text-xs font-mono">{s.winRate.toFixed(1)}%</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm font-mono text-white/60">R$ {s.stake.toFixed(2)}</td>
                            <td className={cn(
                              "px-6 py-4 text-sm font-bold font-mono",
                              s.profit > 0 ? "text-brand-accent" : s.profit < 0 ? "text-brand-danger" : "text-white/40"
                            )}>
                              {s.profit > 0 ? '+' : ''}R$ {s.profit.toFixed(2)}
                            </td>
                            <td className={cn(
                              "px-6 py-4 text-sm font-bold font-mono",
                              s.roi > 0 ? "text-brand-accent" : s.roi < 0 ? "text-brand-danger" : "text-white/40"
                            )}>
                              {s.roi > 0 ? '+' : ''}{s.roi.toFixed(2)}%
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'calculadora' && (
            <CalculatorSection bancaAtual={stats.bancaAtual} />
          )}

          {activeTab === 'backtest' && (
            <BacktestSection bancaAtual={stats.bancaAtual} />
          )}

          {activeTab === 'probabilidades' && (
            <ProbabilitiesSection />
          )}

          {activeTab === 'agenda' && (
            <AgendaSection 
              user={user}
              db={db}
              agenda={agenda} 
              setNotifications={setNotifications} 
              notifSettings={notifSettings}
              updateNotifSettings={updateNotifSettings}
            />
          )}

          {activeTab === 'script' && (
            <motion.div 
              key="script"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-3xl mx-auto space-y-6"
            >
              <div className="bg-brand-card rounded-2xl p-8 border border-white/5 shadow-xl text-center">
                <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Code2 className="text-blue-400 w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Google Apps Script</h2>
                <p className="text-white/60 mb-8">
                  Use este script para automatizar a criação da sua planilha profissional diretamente no Google Sheets.
                </p>
                
                <div className="relative group">
                  <pre className="bg-black/40 p-6 rounded-xl text-left text-xs font-mono overflow-x-auto max-h-[400px] border border-white/5 text-blue-100/80">
                    {GAS_SCRIPT}
                  </pre>
                  <button 
                    onClick={copyToClipboard}
                    className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-semibold backdrop-blur-md border border-white/10"
                  >
                    {copied ? <CheckCircle2 size={14} className="text-brand-accent" /> : <Copy size={14} />}
                    {copied ? 'Copiado!' : 'Copiar Script'}
                  </button>
                </div>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                  <Step num="1" text="Abra uma nova Planilha Google" />
                  <Step num="2" text="Vá em Extensões > Apps Script" />
                  <Step num="3" text="Cole o código e clique em Executar" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="p-6 text-center text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold">
        Scout Pro Analytics © 2024 • Professional Grade Software
      </footer>
    </div>
  );
}

function BacktestSection({ bancaAtual }: { bancaAtual: number }) {
  const [filters, setFilters] = useState<BacktestFilter>({
    liga: 'Todas',
    minOdd: 1.50,
    maxOdd: 2.50,
    janelaTempo: 'HT',
    mando: 'Ambos',
    estrategiaPreset: 'personalizado',
    mercadoPersonalizado: 'Gols',
    tipoMercado: 'Mais de',
    valorMercado: 2.5,
    minutoEvento: 10,
    pressaoAlta: false,
    saidaQualificada: false,
    posseAlta: false
  });

  const [isTesting, setIsTesting] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const STRATEGY_PRESETS = [
    { id: 'personalizado', name: 'Personalizado', desc: 'Configure seus próprios filtros e mercados específicos.' },
    { id: 'fav_gol_cedido', name: 'Favorito Sofreu Gol (Início)', desc: 'Estratégia de valor: Apostar contra o favorito se ele sofrer gol nos primeiros 10 min, buscando a correção do mercado.' },
    { id: 'over_15_ht', name: 'Over 1.5 HT (Pressão)', desc: 'Estratégia de gols: Apostar em 2+ gols no 1º tempo quando há alta pressão ofensiva inicial.' },
    { id: 'late_corner', name: 'Canto Limite (85\'+)', desc: 'Estratégia de trading: Apostar em mais um escanteio nos minutos finais quando um time pressiona intensamente.' },
    { id: 'ltd', name: 'Lay the Draw (LTD)', desc: 'Estratégia clássica: Apostar contra o empate no 2º tempo esperando que o jogo não termine empatado.' },
    { id: 'over05ht', name: 'Over 0.5 HT', desc: 'Estratégia de gols: Buscar pelo menos um gol antes do intervalo em jogos com transições rápidas.' },
    { id: 'over25ft', name: 'Over 2.5 FT', desc: 'Estratégia de gols: Apostar em 3 ou mais gols em partidas com ataques dominantes.' },
    { id: 'btts', name: 'Ambas Marcam (BTTS)', desc: 'Estratégia de gols: Apostar que ambas as equipes marcam em jogos abertos.' },
    { id: 'back_fav', name: 'Back Favorito', desc: 'Estratégia conservadora: Apostar na vitória do time tecnicamente superior jogando em casa.' },
    { id: 'under25ft', name: 'Under 2.5 FT', desc: 'Estratégia defensiva: Apostar em jogos truncados com menos de 3 gols.' },
    { id: 'corners_over', name: 'Over Cantos (9.5+)', desc: 'Estratégia de volume: Apostar em alto número de escanteios em jogos com muitos cruzamentos.' },
  ];

  const TEAM_NAMES = [
    'Real Madrid', 'Man City', 'Bayern', 'Liverpool', 'PSG', 'Arsenal', 'Inter', 'Barcelona', 'Dortmund', 'Bayer Leverkusen',
    'Milan', 'Napoli', 'Juventus', 'Atlético Madrid', 'Benfica', 'Porto', 'Sporting', 'Ajax', 'PSV', 'Feyenoord',
    'Flamengo', 'Palmeiras', 'River Plate', 'Boca Juniors', 'São Paulo', 'Atlético-MG', 'Grêmio', 'Internacional'
  ];

  const handlePresetChange = (id: string) => {
    const preset = STRATEGY_PRESETS.find(p => p.id === id);
    if (!preset) return;

    let newFilters = { ...filters, estrategiaPreset: id };

    switch (id) {
      case 'fav_gol_cedido':
        newFilters = { ...newFilters, minOdd: 1.20, maxOdd: 1.60, janelaTempo: 'HT', minutoEvento: 10, pressaoAlta: true };
        break;
      case 'over_15_ht':
        newFilters = { ...newFilters, minOdd: 1.80, maxOdd: 2.50, janelaTempo: 'HT', pressaoAlta: true, posseAlta: true };
        break;
      case 'late_corner':
        newFilters = { ...newFilters, minOdd: 1.50, maxOdd: 2.00, janelaTempo: 'L10', posseAlta: true, pressaoAlta: true };
        break;
      case 'ltd':
        newFilters = { ...newFilters, minOdd: 3.00, maxOdd: 4.50, janelaTempo: 'FT', posseAlta: true };
        break;
      case 'over05ht':
        newFilters = { ...newFilters, minOdd: 1.30, maxOdd: 1.60, janelaTempo: 'HT', saidaQualificada: true };
        break;
      case 'over25ft':
        newFilters = { ...newFilters, minOdd: 1.70, maxOdd: 2.20, janelaTempo: 'FT', pressaoAlta: true };
        break;
      case 'btts':
        newFilters = { ...newFilters, minOdd: 1.80, maxOdd: 2.10, janelaTempo: 'FT', saidaQualificada: true };
        break;
      case 'back_fav':
        newFilters = { ...newFilters, minOdd: 1.40, maxOdd: 1.80, janelaTempo: 'FT', mando: 'Casa' };
        break;
      case 'under25ft':
        newFilters = { ...newFilters, minOdd: 1.80, maxOdd: 2.30, janelaTempo: 'FT', saidaQualificada: true };
        break;
      case 'corners_over':
        newFilters = { ...newFilters, minOdd: 1.80, maxOdd: 2.20, janelaTempo: 'FT', pressaoAlta: true };
        break;
      default:
        break;
    }

    setFilters(newFilters);
  };

  const runBacktest = () => {
    setIsTesting(true);
    setResult(null);

    // Simulação de processamento de Big Data (5 anos de dados)
    setTimeout(() => {
      const trades = 200 + Math.floor(Math.random() * 300);
      let currentBalance = bancaAtual;
      const curve = [];
      const monteCarloPaths = [];
      const log = [];
      let maxBalance = bancaAtual;
      let maxDD = 0;
      let wins = 0;
      let totalProfit = 0;

      // Base win rate depends on strategy and professional parameters
      let baseWinRate = 0.52;
      if (filters.estrategiaPreset === 'fav_gol_cedido') baseWinRate = 0.58;
      if (filters.estrategiaPreset === 'over_15_ht') baseWinRate = 0.48;
      if (filters.estrategiaPreset === 'late_corner') baseWinRate = 0.62;
      
      // Professional parameter boosts
      if (filters.pressaoAlta) baseWinRate += 0.03;
      if (filters.saidaQualificada) baseWinRate += 0.02;
      if (filters.posseAlta) baseWinRate += 0.01;
      if (filters.mando === 'Casa') baseWinRate += 0.02;
      if (filters.mando === 'Fora') baseWinRate -= 0.01;

      // Main Path
      for (let i = 0; i < trades; i++) {
        const isWin = Math.random() < baseWinRate; 
        const stake = bancaAtual * 0.02;
        const odd = filters.minOdd + Math.random() * (filters.maxOdd - filters.minOdd);
        const profit = isWin ? (stake * odd) - stake : -stake;
        
        currentBalance += profit;
        totalProfit += profit;
        if (isWin) wins++;

        if (currentBalance > maxBalance) maxBalance = currentBalance;
        const dd = ((maxBalance - currentBalance) / maxBalance) * 100;
        if (dd > maxDD) maxDD = dd;

        curve.push({
          date: `Trade ${i + 1}`,
          profit: Number(totalProfit.toFixed(2)),
          balance: Number(currentBalance.toFixed(2))
        });

        if (i < 15) {
          const homeTeam = TEAM_NAMES[Math.floor(Math.random() * TEAM_NAMES.length)];
          let awayTeam = TEAM_NAMES[Math.floor(Math.random() * TEAM_NAMES.length)];
          while (awayTeam === homeTeam) {
            awayTeam = TEAM_NAMES[Math.floor(Math.random() * TEAM_NAMES.length)];
          }

          let entryTime = 0;
          if (filters.janelaTempo === 'HT') entryTime = Math.floor(Math.random() * 45);
          else if (filters.janelaTempo === 'L10') entryTime = 80 + Math.floor(Math.random() * 10);
          else entryTime = Math.floor(Math.random() * 90);

          log.push({
            id: i,
            time: `${entryTime}'`,
            match: `${homeTeam} vs ${awayTeam}`,
            odd: odd.toFixed(2),
            result: isWin ? 'Green' : 'Red',
            profit: profit.toFixed(2)
          });
        }
      }

      // Monte Carlo Paths (10 simulations)
      for (let p = 0; p < 10; p++) {
        const pData = [{ x: 0, y: 0 }];
        let pProfit = 0;
        for (let i = 0; i < trades; i++) {
          const isWin = Math.random() < baseWinRate;
          const stake = bancaAtual * 0.02;
          const odd = filters.minOdd + Math.random() * (filters.maxOdd - filters.minOdd);
          pProfit += isWin ? (stake * odd) - stake : -stake;
          pData.push({ x: i + 1, y: Number(pProfit.toFixed(2)) });
        }
        monteCarloPaths.push({ id: p, data: pData });
      }

      setResult({
        equityCurve: curve,
        monteCarlo: monteCarloPaths,
        totalRoi: (totalProfit / (trades * (bancaAtual * 0.02))) * 100,
        maxDrawdown: maxDD,
        totalTrades: trades,
        winRate: (wins / trades) * 100,
        profitFactor: wins * (filters.minOdd - 1) / (trades - wins),
        expectedValue: (totalProfit / trades),
        log
      });
      setIsTesting(false);
    }, 2500);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Painel de Filtros */}
        <div className="lg:col-span-1 bg-brand-card p-6 rounded-2xl border border-white/5 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white/80 flex items-center gap-2">
              <Filter size={18} className="text-brand-accent" />
              Configurar Teoria
            </h3>
            <div className="text-[8px] font-bold text-white/20 uppercase tracking-widest bg-white/5 px-2 py-1 rounded">
              5 Anos de Dados
            </div>
          </div>
          
          <div className="space-y-4">
            <InputGroup label="Estratégia Pré-definida">
              <div className="flex items-center gap-2 mb-1">
                <select 
                  className="form-input flex-1"
                  value={filters.estrategiaPreset}
                  onChange={e => handlePresetChange(e.target.value)}
                >
                  {STRATEGY_PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div title="Selecione uma estratégia validada por profissionais para carregar filtros automáticos." className="cursor-help">
                  <HelpCircle size={16} className="text-white/20 hover:text-white/60 transition-colors" />
                </div>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="flex items-start gap-2">
                  <Info size={14} className="text-brand-accent shrink-0 mt-0.5" />
                  <p className="text-[10px] text-white/60 leading-relaxed italic">
                    {STRATEGY_PRESETS.find(p => p.id === filters.estrategiaPreset)?.desc}
                  </p>
                </div>
              </div>
            </InputGroup>

            {filters.estrategiaPreset === 'personalizado' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4 pt-2 border-t border-white/5"
              >
                <InputGroup label="Mercado para Validar">
                  <select 
                    className="form-input"
                    value={filters.mercadoPersonalizado}
                    onChange={e => setFilters({...filters, mercadoPersonalizado: e.target.value as any})}
                  >
                    <option value="Gols">Gols (Over/Under)</option>
                    <option value="Escanteios">Escanteios (Cantos)</option>
                    <option value="Cartões">Cartões</option>
                  </select>
                </InputGroup>

                <div className="grid grid-cols-2 gap-2">
                  <InputGroup label="Tipo">
                    <select 
                      className="form-input"
                      value={filters.tipoMercado}
                      onChange={e => setFilters({...filters, tipoMercado: e.target.value as any})}
                    >
                      <option value="Mais de">Mais de (+)</option>
                      <option value="Menos de">Menos de (-)</option>
                    </select>
                  </InputGroup>
                  <InputGroup label="Valor (Linha)">
                    <input 
                      type="number" 
                      step="0.5" 
                      className="form-input" 
                      value={filters.valorMercado} 
                      onChange={e => setFilters({...filters, valorMercado: Number(e.target.value)})} 
                      onBlur={e => {
                        const val = Number(e.target.value);
                        if (Number.isInteger(val)) {
                          setFilters({...filters, valorMercado: val + 0.5});
                        }
                      }}
                      onFocus={e => e.target.select()} 
                    />
                  </InputGroup>
                </div>
              </motion.div>
            )}

            <InputGroup label="Liga / Competição">
              <select 
                className="form-input"
                value={filters.liga}
                onChange={e => setFilters({...filters, liga: e.target.value})}
              >
                <option value="Todas">Todas as Ligas</option>
                {Object.keys(LIGAS_TIMES).map(liga => <option key={liga} value={liga}>{liga}</option>)}
              </select>
            </InputGroup>

            <div className="grid grid-cols-2 gap-2">
              <InputGroup label="Odd Mín">
                <input type="number" step="0.1" className="form-input" value={filters.minOdd} onChange={e => setFilters({...filters, minOdd: Number(e.target.value)})} onFocus={e => e.target.select()} />
              </InputGroup>
              <InputGroup label="Odd Máx">
                <input type="number" step="0.1" className="form-input" value={filters.maxOdd} onChange={e => setFilters({...filters, maxOdd: Number(e.target.value)})} onFocus={e => e.target.select()} />
              </InputGroup>
            </div>

            <InputGroup label="Janela de Tempo">
              <select className="form-input" value={filters.janelaTempo} onChange={e => setFilters({...filters, janelaTempo: e.target.value})}>
                <option value="HT">Intervalo (HT)</option>
                <option value="FT">Jogo Todo (FT)</option>
                <option value="L10">Últimos 10 min</option>
              </select>
            </InputGroup>

            <div className="pt-4 border-t border-white/5 space-y-4">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/30">Parâmetros Profissionais</h4>
              
              <div className="grid grid-cols-2 gap-2">
                <InputGroup label="Minuto Evento">
                  <input type="number" className="form-input" value={filters.minutoEvento} onChange={e => setFilters({...filters, minutoEvento: Number(e.target.value)})} onFocus={e => e.target.select()} />
                </InputGroup>
                <InputGroup label="Mando de Campo">
                  <select 
                    className="form-input" 
                    value={filters.mando} 
                    onChange={e => setFilters({...filters, mando: e.target.value as any})}
                  >
                    <option value="Ambos">Ambos</option>
                    <option value="Casa">Casa</option>
                    <option value="Fora">Fora</option>
                  </select>
                </InputGroup>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-brand-accent focus:ring-brand-accent"
                    checked={filters.pressaoAlta}
                    onChange={e => setFilters({...filters, pressaoAlta: e.target.checked})}
                  />
                  <span className="text-[10px] font-bold uppercase text-white/40 group-hover:text-white/60 transition-colors">Time favorito marca pressão?</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-brand-accent focus:ring-brand-accent"
                    checked={filters.saidaQualificada}
                    onChange={e => setFilters({...filters, saidaQualificada: e.target.checked})}
                  />
                  <span className="text-[10px] font-bold uppercase text-white/40 group-hover:text-white/60 transition-colors">Saída qualificada?</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-brand-accent focus:ring-brand-accent"
                    checked={filters.posseAlta}
                    onChange={e => setFilters({...filters, posseAlta: e.target.checked})}
                  />
                  <span className="text-[10px] font-bold uppercase text-white/40 group-hover:text-white/60 transition-colors">Alta posse de bola?</span>
                </label>
              </div>
            </div>

            <button 
              onClick={runBacktest}
              disabled={isTesting}
              className={cn(
                "w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg",
                isTesting ? "bg-white/10 text-white/20 cursor-not-allowed" : "bg-brand-accent text-brand-bg hover:bg-brand-accent/90 shadow-brand-accent/20"
              )}
            >
              {isTesting ? (
                <>
                  <Activity className="animate-spin" size={18} />
                  Simulando 5 Anos...
                </>
              ) : (
                <>
                  <Zap size={18} />
                  Validar Teoria
                </>
              )}
            </button>
          </div>
        </div>

        {/* Resultados e Gráfico */}
        <div className="lg:col-span-3 space-y-6">
          {!result && !isTesting && (
            <div className="h-full flex flex-col items-center justify-center bg-brand-card rounded-2xl border border-dashed border-white/10 p-12 text-center">
              <div className="w-20 h-20 bg-brand-accent/5 rounded-full flex items-center justify-center mb-6">
                <History size={40} className="text-brand-accent/40" />
              </div>
              <h3 className="text-2xl font-bold text-white/80">Validador de Hipóteses</h3>
              <p className="text-white/40 max-w-md mx-auto mt-2 leading-relaxed">
                Selecione uma teoria ou configure seus filtros. Nosso motor de simulação percorrerá 5 anos de dados históricos para provar se sua estratégia é lucrativa antes de você arriscar dinheiro real.
              </p>
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="text-brand-accent font-bold mb-1">50k+</div>
                  <div className="text-[10px] text-white/40 uppercase">Partidas Analisadas</div>
                </div>
                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="text-blue-400 font-bold mb-1">100%</div>
                  <div className="text-[10px] text-white/40 uppercase">Estatísticas Reais</div>
                </div>
                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="text-purple-400 font-bold mb-1">Instantâneo</div>
                  <div className="text-[10px] text-white/40 uppercase">Validação Técnica</div>
                </div>
              </div>
            </div>
          )}

          {isTesting && (
            <div className="h-full flex flex-col items-center justify-center bg-brand-card rounded-2xl border border-white/5 p-12 text-center">
              <div className="relative w-24 h-24 mb-6">
                <div className="absolute inset-0 border-4 border-brand-accent/10 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-brand-accent rounded-full border-t-transparent animate-spin"></div>
                <Activity className="absolute inset-0 m-auto text-brand-accent" size={32} />
              </div>
              <h3 className="text-xl font-bold animate-pulse">Processando Big Data Histórico</h3>
              <p className="text-white/40 mt-2">Cruzando odds de abertura com eventos in-play (2019-2024)...</p>
              <div className="w-64 h-1.5 bg-white/5 rounded-full mt-6 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2.5, ease: "linear" }}
                  className="h-full bg-brand-accent"
                />
              </div>
            </div>
          )}

          {result && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              {/* Hypothesis Summary */}
              <div className="bg-brand-accent/5 border border-brand-accent/20 p-4 rounded-xl flex items-start gap-3">
                <div className="bg-brand-accent/20 p-2 rounded-lg">
                  <Zap size={16} className="text-brand-accent" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-brand-accent uppercase tracking-wider">Hipótese Validada</h4>
                  <p className="text-sm text-white/70 mt-1">
                    {filters.estrategiaPreset === 'fav_gol_cedido' && `Apostar contra o favorito que sofreu gol até os ${filters.minutoEvento} minutos.`}
                    {filters.estrategiaPreset === 'over_15_ht' && `Apostar em Over 1.5 HT com alta pressão e posse de bola no início.`}
                    {filters.estrategiaPreset === 'late_corner' && `Apostar em Canto Limite após os 85' com alta pressão ofensiva.`}
                    {filters.estrategiaPreset === 'ltd' && `Estratégia Lay the Draw: Apostar contra o empate em jogos com posse qualificada.`}
                    {filters.estrategiaPreset === 'over05ht' && `Estratégia Over 0.5 HT: Buscar pelo menos um gol no primeiro tempo com saída qualificada.`}
                    {filters.estrategiaPreset === 'over25ft' && `Estratégia Over 2.5 FT: Jogos com tendência de 3 ou mais gols e pressão alta.`}
                    {filters.estrategiaPreset === 'btts' && `Estratégia Ambas Marcam: Validar jogos com saída qualificada e ataques ativos.`}
                    {filters.estrategiaPreset === 'back_fav' && `Estratégia Back Favorito: Vitória do time favorito jogando em ${filters.mando === 'Ambos' ? 'qualquer mando' : filters.mando}.`}
                    {filters.estrategiaPreset === 'under25ft' && `Estratégia Under 2.5 FT: Jogos com tendência de poucos gols e saída qualificada.`}
                    {filters.estrategiaPreset === 'corners_over' && `Estratégia Over Cantos: Jogos com alta tendência de escanteios e pressão alta.`}
                    {filters.estrategiaPreset === 'personalizado' && `Estratégia personalizada: ${filters.tipoMercado} ${filters.valorMercado} ${filters.mercadoPersonalizado} com filtros de odd ${filters.minOdd}-${filters.maxOdd}.`}
                  </p>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-brand-card p-4 rounded-xl border border-white/5 group relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[10px] font-bold text-white/40 uppercase flex items-center gap-1">
                      <TrendingUp size={12} className="text-brand-accent" />
                      Lucro (ROI)
                    </div>
                    <div title="Retorno sobre o Investimento: Quanto você ganhou em relação ao valor apostado." className="cursor-help">
                      <Info size={12} className="text-white/20 hover:text-white/60 transition-colors" />
                    </div>
                  </div>
                  <div className={cn("text-xl font-bold", result.totalRoi >= 0 ? "text-brand-accent" : "text-brand-danger")}>
                    {result.totalRoi.toFixed(2)}%
                  </div>
                </div>

                <div className="bg-brand-card p-4 rounded-xl border border-white/5 group relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[10px] font-bold text-white/40 uppercase flex items-center gap-1">
                      <Trophy size={12} className="text-blue-400" />
                      Acertos
                    </div>
                    <div title="Taxa de Acerto (Win Rate): Porcentagem de apostas ganhas sobre o total." className="cursor-help">
                      <Info size={12} className="text-white/20 hover:text-white/60 transition-colors" />
                    </div>
                  </div>
                  <div className="text-xl font-bold text-blue-400">{result.winRate.toFixed(1)}%</div>
                </div>

                <div className="bg-brand-card p-4 rounded-xl border border-white/5 group relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[10px] font-bold text-white/40 uppercase flex items-center gap-1">
                      <ShieldAlert size={12} className="text-brand-danger" />
                      Risco Máx.
                    </div>
                    <div title="Drawdown Máximo: A maior queda que sua banca sofreu durante o teste." className="cursor-help">
                      <Info size={12} className="text-white/20 hover:text-white/60 transition-colors" />
                    </div>
                  </div>
                  <div className="text-xl font-bold text-brand-danger">{result.maxDrawdown.toFixed(1)}%</div>
                </div>

                <div className="bg-brand-card p-4 rounded-xl border border-white/5 group relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[10px] font-bold text-white/40 uppercase flex items-center gap-1">
                      <Dices size={12} className="text-white/60" />
                      Total Jogos
                    </div>
                    <div title="Amostragem: Quantidade total de partidas analisadas no período." className="cursor-help">
                      <Info size={12} className="text-white/20 hover:text-white/60 transition-colors" />
                    </div>
                  </div>
                  <div className="text-xl font-bold text-white">{result.totalTrades}</div>
                </div>

                <div className="bg-brand-card p-4 rounded-xl border border-white/5 group relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[10px] font-bold text-white/40 uppercase flex items-center gap-1">
                      <Coins size={12} className="text-brand-accent" />
                      Lucro Médio
                    </div>
                    <div title="Valor Esperado (EV): Quanto você ganha, em média, por cada aposta feita." className="cursor-help">
                      <Info size={12} className="text-white/20 hover:text-white/60 transition-colors" />
                    </div>
                  </div>
                  <div className="text-xl font-bold text-brand-accent">R$ {result.expectedValue.toFixed(2)}</div>
                </div>

                <div className="bg-brand-card p-4 rounded-xl border border-white/5 group relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[10px] font-bold text-white/40 uppercase flex items-center gap-1">
                      <BarChartHorizontal size={12} className="text-orange-400" />
                      Fator Lucro
                    </div>
                    <div title="Profit Factor: Relação entre o total ganho e o total perdido. Acima de 1.0 é lucrativo." className="cursor-help">
                      <Info size={12} className="text-white/20 hover:text-white/60 transition-colors" />
                    </div>
                  </div>
                  <div className="text-xl font-bold text-orange-400">{result.profitFactor.toFixed(2)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Equity Chart */}
                <div className="bg-brand-card p-6 rounded-2xl border border-white/5 shadow-xl">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-white/80 flex items-center gap-2">
                      <LucideLineChart size={18} className="text-brand-accent" />
                      Curva de Equity (Lucro)
                    </h3>
                    <div className={cn(
                      "text-[10px] font-bold px-2 py-1 rounded",
                      result.totalRoi > 0 ? "text-brand-accent bg-brand-accent/10" : "text-brand-danger bg-brand-danger/10"
                    )}>
                      {result.totalRoi > 0 ? 'ESTRATEGIA LUCRATIVA' : 'ESTRATEGIA NEGATIVA'}
                    </div>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={result.equityCurve}>
                        <defs>
                          <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={result.totalRoi > 0 ? "#00e676" : "#ff5252"} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={result.totalRoi > 0 ? "#00e676" : "#ff5252"} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                        <XAxis dataKey="date" stroke="#ffffff20" fontSize={8} tick={false} />
                        <YAxis stroke="#ffffff20" fontSize={10} tickFormatter={(val) => `R$${val}`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#2d2d2d', border: 'none', borderRadius: '8px', fontSize: '12px' }}
                          formatter={(val: number) => [`R$ ${val.toFixed(2)}`, 'Lucro']}
                        />
                        <Area type="monotone" dataKey="profit" stroke={result.totalRoi > 0 ? "#00e676" : "#ff5252"} strokeWidth={2} fillOpacity={1} fill="url(#colorEquity)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Monte Carlo Chart */}
                <div className="bg-brand-card p-6 rounded-2xl border border-white/5 shadow-xl">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-white/80 flex items-center gap-2">
                      <Activity size={18} className="text-blue-400" />
                      Variância (Monte Carlo)
                    </h3>
                    <div title="Simulação de 10 realidades alternativas para mostrar como a sorte/azar impactam o resultado a curto prazo." className="cursor-help">
                      <HelpCircle size={16} className="text-white/20 hover:text-white/60 transition-colors" />
                    </div>
                  </div>
                  <p className="text-[10px] text-white/40 mb-6 leading-relaxed">
                    Este gráfico mostra 10 simulações diferentes da mesma estratégia. Se a maioria das linhas for para cima, a estratégia é estatisticamente sólida.
                  </p>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                        <XAxis type="number" dataKey="x" stroke="#ffffff20" fontSize={8} domain={['auto', 'auto']} />
                        <YAxis stroke="#ffffff20" fontSize={10} tickFormatter={(val) => `R$${val}`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#2d2d2d', border: 'none', borderRadius: '8px', fontSize: '12px' }}
                          formatter={(val: number) => [`R$ ${val.toFixed(2)}`, 'Lucro']}
                        />
                        {result.monteCarlo.map((path) => (
                          <Line 
                            key={path.id}
                            data={path.data}
                            type="monotone"
                            dataKey="y"
                            stroke={path.id === 0 ? "#00e676" : "#ffffff10"}
                            strokeWidth={path.id === 0 ? 3 : 1}
                            dot={false}
                            activeDot={false}
                            opacity={path.id === 0 ? 1 : 0.3}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 flex items-center gap-4 justify-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-1 bg-brand-accent rounded-full"></div>
                      <span className="text-[10px] text-white/40 uppercase font-bold">Caminho Real</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-1 bg-white/20 rounded-full"></div>
                      <span className="text-[10px] text-white/40 uppercase font-bold">Simulações</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sample Log */}
              <div className="bg-brand-card rounded-2xl border border-white/5 shadow-xl overflow-hidden">
                <div className="p-4 border-b border-white/5 bg-black/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History size={16} className="text-brand-accent" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-white/80">Amostragem de Jogos Reais (2019-2024)</h3>
                  </div>
                  <div title="Exemplos de partidas que se encaixaram nos seus filtros durante o período analisado." className="cursor-help">
                    <HelpCircle size={14} className="text-white/20 hover:text-white/60 transition-colors" />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-white/20 border-b border-white/5 bg-white/[0.02]">
                        <th className="px-6 py-4 font-bold uppercase tracking-tighter">Minuto</th>
                        <th className="px-6 py-4 font-bold uppercase tracking-tighter">Partida / Confronto</th>
                        <th className="px-6 py-4 font-bold uppercase tracking-tighter">Odd Entrada</th>
                        <th className="px-6 py-4 font-bold uppercase tracking-tighter">Status</th>
                        <th className="px-6 py-4 font-bold uppercase tracking-tighter text-right">Resultado Financeiro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {result.log.map((l) => (
                        <tr key={l.id} className="hover:bg-white/5 transition-colors group">
                          <td className="px-6 py-4 font-mono text-white/40">{l.time}</td>
                          <td className="px-6 py-4 font-semibold text-white/90">{l.match}</td>
                          <td className="px-6 py-4 font-mono text-blue-400">{l.odd}</td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest",
                              l.result === 'Green' ? "bg-brand-accent/10 text-brand-accent border border-brand-accent/20" : "bg-brand-danger/10 text-brand-danger border border-brand-danger/20"
                            )}>
                              {l.result}
                            </span>
                          </td>
                          <td className={cn(
                            "px-6 py-4 font-bold font-mono text-right text-sm",
                            Number(l.profit) > 0 ? "text-brand-accent" : "text-brand-danger"
                          )}>
                            {Number(l.profit) > 0 ? '+' : ''}R$ {l.profit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 bg-black/40 border-t border-white/5">
                  <p className="text-[9px] text-white/20 uppercase font-bold tracking-[0.2em] text-center">
                    Exibindo amostragem técnica de 15 partidas representativas do período de 5 anos.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function AgendaSection({ user, db, agenda, setNotifications, notifSettings, updateNotifSettings }: { 
  user: User | null,
  db: any,
  agenda: any[], 
  setNotifications: React.Dispatch<React.SetStateAction<any[]>>,
  notifSettings: any,
  updateNotifSettings: (newSettings: any) => Promise<void>
}) {
  const [formData, setFormData] = useState({ 
    data: '', 
    titulo: '', 
    comentario: '', 
    lembrete: true,
    diasAntecedencia: 3,
    horarioLembrete: '09:00',
    quantidadeLembretes: 1
  });

  const addEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const newEvent = { 
      ...formData, 
      createdAt: Timestamp.now()
    };

    try {
      const agendaRef = collection(db, 'users', user.uid, 'agenda');
      await addDoc(agendaRef, newEvent);
      setFormData({ 
        data: '', 
        titulo: '', 
        comentario: '', 
        lembrete: true,
        diasAntecedencia: notifSettings.dias,
        horarioLembrete: notifSettings.horario,
        quantidadeLembretes: notifSettings.quantidade
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/agenda`);
    }
  };

  const removeEvent = async (id: string) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'agenda', id);
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/agenda/${id}`);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Configurações Globais de Notificação */}
      <div className="bg-brand-card p-6 rounded-2xl border border-white/5 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Bell className="text-brand-accent" size={20} />
            Configurações de Notificação
          </h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-white/40">Usar mesma regra para todos</span>
            <input 
              type="checkbox" 
              checked={notifSettings.global} 
              onChange={e => updateNotifSettings({...notifSettings, global: e.target.checked})}
              className="w-4 h-4 rounded bg-white/5 border-white/10 text-brand-accent"
            />
          </label>
        </div>
        
        <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4 transition-opacity", !notifSettings.global && "opacity-50 pointer-events-none")}>
          <InputGroup label="Dias de Antecedência (Padrão)">
            <select 
              className="form-input" 
              value={notifSettings.dias} 
              onChange={e => updateNotifSettings({...notifSettings, dias: Number(e.target.value)})}
            >
              {[1, 2, 3, 5, 7, 15].map(d => <option key={d} value={d}>{d} dias antes</option>)}
            </select>
          </InputGroup>
          <InputGroup label="Horário do Lembrete (Padrão)">
            <input 
              type="time" 
              className="form-input" 
              value={notifSettings.horario} 
              onChange={e => updateNotifSettings({...notifSettings, horario: e.target.value})}
            />
          </InputGroup>
          <InputGroup label="Qtd. de Notificações (Padrão)">
            <select 
              className="form-input" 
              value={notifSettings.quantidade} 
              onChange={e => updateNotifSettings({...notifSettings, quantidade: Number(e.target.value)})}
            >
              {[1, 2, 3, 4, 5].map(q => <option key={q} value={q}>{q}x lembrete</option>)}
            </select>
          </InputGroup>
        </div>
      </div>

      <div className="bg-brand-card p-6 rounded-2xl border border-white/5 shadow-xl">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Calendar className="text-brand-accent" />
          Novo Evento
        </h2>
        <form onSubmit={addEvent} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <InputGroup label="Data do Evento">
              <input type="date" className="form-input" value={formData.data} onChange={e => setFormData({...formData, data: e.target.value})} required />
            </InputGroup>
            <InputGroup label="Título do Evento">
              <input type="text" className="form-input" placeholder="Ex: Final Champions" value={formData.titulo} onChange={e => setFormData({...formData, titulo: e.target.value})} required />
            </InputGroup>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.lembrete} onChange={e => setFormData({...formData, lembrete: e.target.checked})} className="w-4 h-4 rounded bg-white/5 border-white/10 text-brand-accent" />
                <span className="text-xs text-white/60">Ativar Lembrete</span>
              </label>
              <button type="submit" className="flex-1 py-2.5 bg-brand-accent text-brand-bg font-bold rounded-lg hover:bg-brand-accent/90 transition-all">
                Adicionar Evento
              </button>
            </div>
          </div>

          <AnimatePresence>
            {!notifSettings.global && formData.lembrete && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-black/20 rounded-xl border border-white/5"
              >
                <InputGroup label="Dias de Antecedência (Este Evento)">
                  <select 
                    className="form-input" 
                    value={formData.diasAntecedencia} 
                    onChange={e => setFormData({...formData, diasAntecedencia: Number(e.target.value)})}
                  >
                    {[1, 2, 3, 5, 7, 15].map(d => <option key={d} value={d}>{d} dias antes</option>)}
                  </select>
                </InputGroup>
                <InputGroup label="Horário do Lembrete (Este Evento)">
                  <input 
                    type="time" 
                    className="form-input" 
                    value={formData.horarioLembrete} 
                    onChange={e => setFormData({...formData, horarioLembrete: e.target.value})}
                  />
                </InputGroup>
                <InputGroup label="Qtd. de Notificações (Este Evento)">
                  <select 
                    className="form-input" 
                    value={formData.quantidadeLembretes} 
                    onChange={e => setFormData({...formData, quantidadeLembretes: Number(e.target.value)})}
                  >
                    {[1, 2, 3, 4, 5].map(q => <option key={q} value={q}>{q}x lembrete</option>)}
                  </select>
                </InputGroup>
              </motion.div>
            )}
          </AnimatePresence>

          <InputGroup label="Comentários / Observações">
            <textarea className="form-input min-h-[80px] py-2" placeholder="Anote detalhes importantes aqui..." value={formData.comentario} onChange={e => setFormData({...formData, comentario: e.target.value})} />
          </InputGroup>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agenda.map(event => (
          <motion.div key={event.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-brand-card p-5 rounded-2xl border border-white/5 shadow-lg relative group">
            <button onClick={() => removeEvent(event.id)} className="absolute top-4 right-4 text-white/10 hover:text-brand-danger transition-colors opacity-0 group-hover:opacity-100">
              <Trash2 size={16} />
            </button>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-brand-accent/10 rounded-xl flex items-center justify-center">
                <Calendar size={20} className="text-brand-accent" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-white/20 uppercase">{new Date(event.data).toLocaleDateString()}</div>
                <div className="font-bold text-white/90">{event.titulo}</div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-white/40 leading-relaxed italic">"{event.comentario || 'Sem comentários'}"</p>
              <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-brand-accent/60">
                <Clock size={10} />
                Lembrete: {notifSettings.global ? notifSettings.dias : event.diasAntecedencia}d às {notifSettings.global ? notifSettings.horario : event.horarioLembrete} ({notifSettings.global ? notifSettings.quantidade : event.quantidadeLembretes}x)
              </div>
            </div>
          </motion.div>
        ))}
        {agenda.length === 0 && (
          <div className="col-span-full py-12 text-center text-white/10 border-2 border-dashed border-white/5 rounded-2xl">
            Sua agenda está vazia. Comece anotando seus próximos eventos!
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ProbabilitiesSection() {
  const [liga, setLiga] = useState('Todas');
  const [time, setTime] = useState('');
  const [categories, setCategories] = useState({
    goals: true,
    corners: false,
    cards: false
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availableTeams = useMemo(() => {
    return LIGAS_TIMES[liga] || [];
  }, [liga]);

  const analyzeProbabilities = async () => {
    if (!time) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const categoriesList = [];
      if (categories.goals) categoriesList.push('Gols');
      if (categories.corners) categoriesList.push('Escanteios');
      if (categories.cards) categoriesList.push('Cartões');
      
      const categoriesStr = categoriesList.join(', ');

      const prompt = `Analise as probabilidades e estatísticas REAIS e MAIS RECENTES (Temporada 2024/2025) do time ${time} da liga ${liga}. 
      Foque nas seguintes categorias: ${categoriesStr}.
      
      ESTRUTURA DO RELATÓRIO (MANDATÓRIO):
      1. Título do Relatório: # 📝 RELATÓRIO DE ANÁLISE SIMPLIFICADA - ${time.toUpperCase()}
      
      ---
      
      2. Resumo do Time: ## 📋 Como o time está jogando?
      Explique de forma simples o momento atual do time, se está ganhando muito, se a defesa está boa ou ruim.
      
      ---
      
      3. Análise de ${categoriesStr}:
         ## 📊 O que os números dizem? (Dados Simples)
         - Use Tabelas Markdown para as médias.
         - IMPORTANTE: Não use apenas termos como "Over 2.5", use "Mais de 2.5 gols (pelo menos 3 gols)".
         - Explique o que é HT (1º Tempo) e FT (Jogo todo) dentro do texto.
         
      ---
      
      4. Dica do Analista: ## 💡 Dica para sua aposta
      Uma recomendação bem simples e clara do que pode acontecer no próximo jogo.
      
      ---
      
      5. Legenda para Iniciantes: ## 📚 Dicionário de Termos (Legenda)
      Explique de forma bem didática o que significam os termos usados (ex: o que é 0.5 gols, o que é média, o que é HT/FT).
      
      REGRAS DE CONTEÚDO:
      - Use dados REAIS de Fevereiro/2025.
      - Linguagem extremamente simples, como se estivesse explicando para um amigo que começou hoje.
      - Evite "juridiquês" do trading.
      - Use separadores de linha (---) entre as seções.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      setResult(response.text || "Não foi possível obter os dados.");
    } catch (err) {
      console.error(err);
      setError("Erro ao buscar dados. Verifique sua conexão ou tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!result) return;
    const element = document.createElement("a");
    const file = new Blob([result], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `Relatorio_ScoutPro_${time.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="bg-brand-card p-6 rounded-2xl border border-white/5 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-brand-accent/10 rounded-xl flex items-center justify-center">
            <Dices size={24} className="text-brand-accent" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Análise de Probabilidades Real-Time</h2>
            <p className="text-white/40 text-sm">Dados atualizados via inteligência artificial e busca web.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <InputGroup label="Liga / Competição">
            <select 
              className="form-input"
              value={liga}
              onChange={e => {
                setLiga(e.target.value);
                setTime('');
              }}
            >
              <option value="Todas">Selecione a Liga...</option>
              {Object.keys(LIGAS_TIMES).map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </InputGroup>
          <InputGroup label="Time">
            <select 
              className="form-input"
              value={time}
              onChange={e => setTime(e.target.value)}
              disabled={liga === 'Todas'}
            >
              <option value="">Selecione o Time...</option>
              {availableTeams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </InputGroup>
        </div>

        <div className="space-y-4 mb-6">
          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Categorias de Estudo</label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-white/10 bg-white/5 text-brand-accent focus:ring-brand-accent"
                checked={categories.goals}
                onChange={e => setCategories({...categories, goals: e.target.checked})}
              />
              <span className="text-sm font-semibold text-white/60 group-hover:text-white transition-colors">Gols</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-white/10 bg-white/5 text-brand-accent focus:ring-brand-accent"
                checked={categories.corners}
                onChange={e => setCategories({...categories, corners: e.target.checked})}
              />
              <span className="text-sm font-semibold text-white/60 group-hover:text-white transition-colors">Escanteios</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-white/10 bg-white/5 text-brand-accent focus:ring-brand-accent"
                checked={categories.cards}
                onChange={e => setCategories({...categories, cards: e.target.checked})}
              />
              <span className="text-sm font-semibold text-white/60 group-hover:text-white transition-colors">Cartões</span>
            </label>
          </div>
        </div>

        <button 
          onClick={analyzeProbabilities}
          disabled={loading || !time}
          className={cn(
            "w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg",
            loading || !time ? "bg-white/10 text-white/20 cursor-not-allowed" : "bg-brand-accent text-brand-bg hover:bg-brand-accent/90 shadow-brand-accent/20"
          )}
        >
          {loading ? (
            <>
              <Activity className="animate-spin" size={18} />
              Cruzando Dados da Web...
            </>
          ) : (
            <>
              <Zap size={18} />
              Analisar Probabilidades
            </>
          )}
        </button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-brand-danger/10 border border-brand-danger/20 rounded-xl flex items-center gap-3 text-brand-danger"
          >
            <AlertTriangle size={20} />
            <p className="text-sm font-medium">{error}</p>
          </motion.div>
        )}

        {result && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="bg-brand-card rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
              {/* Report Header */}
              <div className="bg-black/40 p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-accent/10 rounded-xl flex items-center justify-center border border-brand-accent/20">
                    <FileText size={24} className="text-brand-accent" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white/90">Relatório de Inteligência</h3>
                    <div className="flex items-center gap-3 text-[10px] text-white/40 uppercase font-bold tracking-widest mt-1">
                      <span className="flex items-center gap-1"><Clock size={10} /> {new Date().toLocaleDateString()}</span>
                      <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                      <span>{liga}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={downloadReport}
                    className="flex-1 md:flex-none px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Download size={14} />
                    Baixar Relatório
                  </button>
                  <button 
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: `Relatório Scout Pro - ${time}`,
                          text: result,
                        }).catch(console.error);
                      } else {
                        downloadReport();
                      }
                    }}
                    className="flex-1 md:flex-none px-4 py-2 bg-brand-accent text-brand-bg rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-accent/20"
                  >
                    <Share2 size={14} />
                    Compartilhar
                  </button>
                </div>
              </div>

              {/* Report Content */}
              <div className="p-8 md:p-12 bg-gradient-to-b from-transparent to-black/20">
                <div className="max-w-none markdown-body">
                  <Markdown>{result}</Markdown>
                </div>
              </div>

              {/* Report Footer */}
              <div className="p-6 bg-black/40 border-t border-white/5 text-center">
                <p className="text-[9px] text-white/20 uppercase font-bold tracking-[0.3em]">
                  Gerado por Scout Pro AI • Análise Técnica de Alta Precisão
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CalculatorSection({ bancaAtual }: { bancaAtual: number }) {
  const [calcType, setCalcType] = useState<'juros' | 'stake' | 'surebet' | 'soros'>('juros');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="flex flex-wrap gap-2 bg-black/20 p-1 rounded-xl w-fit mx-auto">
        <button 
          onClick={() => setCalcType('juros')}
          className={cn(
            "px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
            calcType === 'juros' ? "bg-brand-accent text-brand-bg" : "text-white/40 hover:text-white/80"
          )}
        >
          <TrendingUpIcon size={14} />
          Juros Compostos
        </button>
        <button 
          onClick={() => setCalcType('stake')}
          className={cn(
            "px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
            calcType === 'stake' ? "bg-brand-accent text-brand-bg" : "text-white/40 hover:text-white/80"
          )}
        >
          <Coins size={14} />
          Gestão de Stake
        </button>
        <button 
          onClick={() => setCalcType('surebet')}
          className={cn(
            "px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
            calcType === 'surebet' ? "bg-brand-accent text-brand-bg" : "text-white/40 hover:text-white/80"
          )}
        >
          <ArrowRightLeft size={14} />
          Surebet / Arbitragem
        </button>
        <button 
          onClick={() => setCalcType('soros')}
          className={cn(
            "px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
            calcType === 'soros' ? "bg-brand-accent text-brand-bg" : "text-white/40 hover:text-white/80"
          )}
        >
          <Zap size={14} />
          Estratégia Soros
        </button>
      </div>

      <AnimatePresence mode="wait">
        {calcType === 'juros' && (
          <motion.div key="juros" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CompoundInterestCalculator initialBanca={bancaAtual} />
          </motion.div>
        )}
        {calcType === 'stake' && (
          <motion.div key="stake" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <StakeCalculator banca={bancaAtual} />
          </motion.div>
        )}
        {calcType === 'surebet' && (
          <motion.div key="surebet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SurebetCalculator />
          </motion.div>
        )}
        {calcType === 'soros' && (
          <motion.div key="soros" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SorosCalculator />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SorosCalculator() {
  const [initialStake, setInitialStake] = useState(100);
  const [avgOdd, setAvgOdd] = useState(1.80);
  const [levels, setLevels] = useState(4);

  const sorosData = useMemo(() => {
    const data = [];
    let currentStake = initialStake;
    for (let i = 1; i <= levels; i++) {
      const profit = currentStake * (avgOdd - 1);
      const total = currentStake + profit;
      data.push({
        level: i,
        stake: currentStake,
        profit: profit,
        total: total
      });
      currentStake = total;
    }
    return data;
  }, [initialStake, avgOdd, levels]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-6"
    >
      <div className="bg-brand-card p-6 rounded-2xl border border-white/5 shadow-xl space-y-6">
        <h3 className="font-bold text-white/80 flex items-center gap-2">
          <Zap size={18} className="text-brand-accent" />
          Configuração de Soros
        </h3>
        <div className="space-y-4">
          <InputGroup label="Stake Inicial">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black text-xs font-bold">R$</span>
              <input 
                type="number" 
                className="form-input pl-10" 
                value={initialStake} 
                onChange={e => setInitialStake(Number(e.target.value))} 
                onFocus={(e) => e.target.select()} 
              />
            </div>
          </InputGroup>
          <InputGroup label="Odd Média">
            <input type="number" step="0.01" className="form-input" value={avgOdd} onChange={e => setAvgOdd(Number(e.target.value))} onFocus={(e) => e.target.select()} />
          </InputGroup>
          <InputGroup label="Níveis de Soros">
            <input type="number" className="form-input" value={levels} onChange={e => setLevels(Number(e.target.value))} onFocus={(e) => e.target.select()} />
          </InputGroup>
        </div>
        
        <div className="p-4 bg-brand-accent/5 rounded-xl border border-brand-accent/20">
          <div className="text-[10px] font-bold text-white/40 uppercase mb-2 tracking-widest">Retorno Final Estimado</div>
          <div className="text-3xl font-bold text-brand-accent tracking-tight">
            R$ {(sorosData[sorosData.length - 1]?.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-white/20 mt-2 uppercase font-bold tracking-widest">
            Lucro de {(((sorosData[sorosData.length - 1]?.total || 0) / initialStake - 1) * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 bg-brand-card rounded-2xl border border-white/5 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-white/5 bg-black/20">
          <h3 className="font-bold text-white/80">Tabela de Prospecção Soros</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-white/5 text-white/40 uppercase font-bold tracking-widest">
                <th className="px-6 py-4">Nível</th>
                <th className="px-6 py-4">Stake</th>
                <th className="px-6 py-4">Lucro (R$)</th>
                <th className="px-6 py-4">Acumulado (R$)</th>
                <th className="px-6 py-4">Progresso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sorosData.map((row) => (
                <tr key={row.level} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="w-6 h-6 rounded-full bg-brand-accent/10 text-brand-accent flex items-center justify-center font-bold">
                      {row.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-white/90">R$ {row.stake.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 font-mono text-brand-accent">R$ {row.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 font-mono font-bold text-white">R$ {row.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4">
                    <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-brand-accent" 
                        style={{ width: `${(row.level / levels) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function CompoundInterestCalculator({ initialBanca }: { initialBanca: number }) {
  const [banca, setBanca] = useState(initialBanca);
  const [taxa, setTaxa] = useState(1);
  const [periodo, setPeriodo] = useState(30);

  const projection = useMemo(() => {
    let current = banca;
    const data = [{ dia: 0, valor: banca }];
    for (let i = 1; i <= periodo; i++) {
      current = current * (1 + taxa / 100);
      data.push({ dia: i, valor: Number(current.toFixed(2)) });
    }
    return data;
  }, [banca, taxa, periodo]);

  const finalValue = projection[projection.length - 1].valor;
  const totalProfit = finalValue - banca;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-6"
    >
      <div className="bg-brand-card p-6 rounded-2xl border border-white/5 shadow-xl space-y-6">
        <h3 className="font-bold text-white/80 flex items-center gap-2">
          <Calendar size={18} className="text-brand-accent" />
          Parâmetros de Prospecção
        </h3>
        <div className="space-y-4">
          <InputGroup label="Banca Inicial">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black text-xs font-bold">R$</span>
              <input 
                type="number" 
                className="form-input pl-10" 
                value={banca} 
                onChange={e => setBanca(Number(e.target.value))} 
                onFocus={(e) => e.target.select()}
              />
            </div>
          </InputGroup>
          <InputGroup label="Meta Diária (%)">
            <input 
              type="number" 
              className="form-input" 
              value={taxa} 
              onChange={e => setTaxa(Number(e.target.value))} 
              onFocus={(e) => e.target.select()}
            />
          </InputGroup>
          <InputGroup label="Período (Dias)">
            <input 
              type="number" 
              className="form-input" 
              value={periodo} 
              onChange={e => setPeriodo(Number(e.target.value))} 
              onFocus={(e) => e.target.select()}
            />
          </InputGroup>
        </div>
        <div className="pt-4 border-t border-white/5 space-y-3">
          <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-white/40">
            <span>Banca Final</span>
            <span className="text-brand-accent">R$ {finalValue.toLocaleString('pt-BR')}</span>
          </div>
          <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-white/40">
            <span>Lucro Projetado</span>
            <span className="text-brand-accent">R$ {totalProfit.toLocaleString('pt-BR')}</span>
          </div>
          <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-white/40">
            <span>Crescimento</span>
            <span className="text-brand-accent">{((totalProfit / banca) * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 bg-brand-card p-6 rounded-2xl border border-white/5 shadow-xl">
        <h3 className="font-bold text-white/80 mb-6">Gráfico de Projeção Exponencial</h3>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={projection}>
              <defs>
                <linearGradient id="colorProj" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00e676" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00e676" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
              <XAxis dataKey="dia" stroke="#ffffff20" fontSize={10} label={{ value: 'Dias', position: 'insideBottom', offset: -5, fill: '#ffffff40', fontSize: 10 }} />
              <YAxis stroke="#ffffff20" fontSize={10} tickFormatter={(val) => `R$${val}`} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#2d2d2d', border: 'none', borderRadius: '8px', fontSize: '12px' }}
                formatter={(val: number) => [`R$ ${val.toLocaleString('pt-BR')}`, 'Banca']}
              />
              <Area type="monotone" dataKey="valor" stroke="#00e676" strokeWidth={3} fillOpacity={1} fill="url(#colorProj)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}

function StakeCalculator({ banca }: { banca: number }) {
  const [risk, setRisk] = useState(2);
  const stake = useMemo(() => (banca * risk) / 100, [banca, risk]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-2xl mx-auto bg-brand-card p-8 rounded-2xl border border-white/5 shadow-xl"
    >
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-brand-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Coins className="text-brand-accent w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold">Calculadora de Gestão de Risco</h3>
        <p className="text-white/40 text-sm">Determine o tamanho ideal da sua unidade baseado na sua banca atual.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="space-y-6">
          <InputGroup label="Sua Banca Atual (R$)">
            <div className="text-3xl font-bold text-brand-accent">R$ {banca.toLocaleString('pt-BR')}</div>
          </InputGroup>
          <InputGroup label="Risco por Operação (%)">
            <input 
              type="range" 
              min="0.5" 
              max="10" 
              step="0.5" 
              className="w-full accent-brand-accent" 
              value={risk} 
              onChange={e => setRisk(Number(e.target.value))} 
            />
            <div className="flex justify-between text-[10px] font-bold text-white/20 uppercase mt-1">
              <span>Conservador (1%)</span>
              <span className="text-brand-accent">{risk}%</span>
              <span>Agressivo (5%+)</span>
            </div>
          </InputGroup>
        </div>

        <div className="bg-black/20 p-6 rounded-2xl border border-white/5 text-center space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Stake Recomendada</div>
          <div className="text-4xl font-bold text-brand-accent">R$ {stake.toLocaleString('pt-BR')}</div>
          <div className="text-xs text-white/20 italic">Isso representa 1 unidade (1u)</div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-brand-danger/5 border border-brand-danger/20 rounded-xl flex gap-3 items-center">
        <AlertTriangle className="text-brand-danger shrink-0" size={20} />
        <p className="text-[10px] text-brand-danger/80 leading-relaxed font-medium">
          DICA PROFISSIONAL: Traders de elite raramente arriscam mais de 2% da banca em uma única operação. Gestão é o que separa o apostador do investidor.
        </p>
      </div>
    </motion.div>
  );
}

function SurebetCalculator() {
  const [odd1, setOdd1] = useState(2.10);
  const [odd2, setOdd2] = useState(2.10);
  const [totalStake, setTotalStake] = useState(100);
  const [hedgeMode, setHedgeMode] = useState(false);
  const [initialBet, setInitialBet] = useState({ stake: 50, odd: 2.0 });
  const [liveOdd, setLiveOdd] = useState(2.5);

  const stats = useMemo(() => {
    const p1 = 1 / odd1;
    const p2 = 1 / odd2;
    const margin = (p1 + p2) * 100;
    const isSurebet = margin < 100;
    
    const stake1 = (totalStake * p1) / (p1 + p2);
    const stake2 = (totalStake * p2) / (p1 + p2);
    
    const payout1 = stake1 * odd1;
    const payout2 = stake2 * odd2;
    const profit = payout1 - totalStake;
    const profitPct = (profit / totalStake) * 100;

    return { stake1, stake2, payout1, payout2, margin, isSurebet, profit, profitPct };
  }, [odd1, odd2, totalStake]);

  const hedgeStats = useMemo(() => {
    const investment = initialBet.stake;
    const potentialReturn = initialBet.stake * initialBet.odd;
    const hedgeStake = potentialReturn / liveOdd;
    const totalInvestment = investment + hedgeStake;
    const finalProfit = potentialReturn - totalInvestment;
    const roi = (finalProfit / totalInvestment) * 100;
    
    return { hedgeStake, totalInvestment, finalProfit, roi };
  }, [initialBet, liveOdd]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-6xl mx-auto space-y-6"
    >
      <div className="flex gap-2 bg-black/20 p-1 rounded-xl w-fit mx-auto mb-4">
        <button 
          onClick={() => setHedgeMode(false)}
          className={cn(
            "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
            !hedgeMode ? "bg-brand-accent text-brand-bg" : "text-white/40 hover:text-white/80"
          )}
        >
          Arbitragem (Surebet)
        </button>
        <button 
          onClick={() => setHedgeMode(true)}
          className={cn(
            "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
            hedgeMode ? "bg-brand-accent text-brand-bg" : "text-white/40 hover:text-white/80"
          )}
        >
          Cobertura (Live Hedge)
        </button>
      </div>

      {!hedgeMode ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-brand-card p-6 rounded-2xl border border-white/5 shadow-xl space-y-6">
            <h3 className="font-bold text-white/80 flex items-center gap-2">
              <ArrowRightLeft size={18} className="text-brand-accent" />
              Entradas da Operação
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Odd Casa 1">
                <input type="number" step="0.01" className="form-input" value={odd1} onChange={e => setOdd1(Number(e.target.value))} onFocus={(e) => e.target.select()} />
              </InputGroup>
              <InputGroup label="Odd Casa 2">
                <input type="number" step="0.01" className="form-input" value={odd2} onChange={e => setOdd2(Number(e.target.value))} onFocus={(e) => e.target.select()} />
              </InputGroup>
            </div>
            <InputGroup label="Investimento Total (R$)">
              <input type="number" className="form-input" value={totalStake} onChange={e => setTotalStake(Number(e.target.value))} onFocus={(e) => e.target.select()} />
            </InputGroup>

            <div className={cn(
              "p-4 rounded-xl border flex items-center gap-3",
              stats.isSurebet ? "bg-brand-accent/10 border-brand-accent/20" : "bg-brand-danger/10 border-brand-danger/20"
            )}>
              {stats.isSurebet ? <CheckCircle2 className="text-brand-accent" /> : <AlertTriangle className="text-brand-danger" />}
              <div>
                <div className={cn("text-xs font-bold uppercase", stats.isSurebet ? "text-brand-accent" : "text-brand-danger")}>
                  {stats.isSurebet ? "Surebet Detectada!" : "Sem Arbitragem"}
                </div>
                <div className="text-[10px] text-white/40">Margem do Mercado: {stats.margin.toFixed(2)}%</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-brand-card p-6 rounded-2xl border border-white/5 shadow-xl">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Casa 1</div>
                  <div className="px-2 py-0.5 bg-brand-accent/10 text-brand-accent text-[9px] font-black rounded">ODD {odd1}</div>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] text-white/40 uppercase font-bold mb-1">Stake Sugerida</div>
                    <div className="text-2xl font-bold text-white">R$ {stats.stake1.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                  <div className="pt-3 border-t border-white/5">
                    <div className="text-[10px] text-white/40 uppercase font-bold mb-1">Retorno (Stake x Odd)</div>
                    <div className="text-lg font-bold text-brand-accent">R$ {stats.payout1.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                </div>
              </div>

              <div className="bg-brand-card p-6 rounded-2xl border border-white/5 shadow-xl">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Casa 2</div>
                  <div className="px-2 py-0.5 bg-brand-accent/10 text-brand-accent text-[9px] font-black rounded">ODD {odd2}</div>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] text-white/40 uppercase font-bold mb-1">Stake Sugerida</div>
                    <div className="text-2xl font-bold text-white">R$ {stats.stake2.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                  <div className="pt-3 border-t border-white/5">
                    <div className="text-[10px] text-white/40 uppercase font-bold mb-1">Retorno (Stake x Odd)</div>
                    <div className="text-lg font-bold text-brand-accent">R$ {stats.payout2.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-brand-card p-6 rounded-2xl border border-white/5 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-6">Quadro de Análise Detalhada</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <div className="text-[9px] font-bold text-white/20 uppercase mb-1">Lucro Líquido</div>
                  <div className={cn("text-lg font-bold", stats.profit >= 0 ? "text-brand-accent" : "text-brand-danger")}>
                    R$ {stats.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-white/20 uppercase mb-1">ROI da Operação</div>
                  <div className={cn("text-lg font-bold", stats.profit >= 0 ? "text-brand-accent" : "text-brand-danger")}>
                    {stats.profitPct.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-white/20 uppercase mb-1">Exposição Total</div>
                  <div className="text-lg font-bold text-white">R$ {totalStake.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-white/20 uppercase mb-1">Prob. Implícita</div>
                  <div className="text-lg font-bold text-blue-400">{stats.margin.toFixed(1)}%</div>
                </div>
              </div>
              
              <div className="mt-8">
                <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-white/20 mb-2">
                  <span>Equilíbrio de Cobertura</span>
                  <span>{stats.isSurebet ? '100% Protegido' : 'Risco Detectado'}</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden flex">
                  <div className="h-full bg-brand-accent/60" style={{ width: `${(stats.stake1 / totalStake) * 100}%` }} />
                  <div className="h-full bg-brand-accent" style={{ width: `${(stats.stake2 / totalStake) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-brand-card p-6 rounded-2xl border border-white/5 shadow-xl space-y-6">
            <h3 className="font-bold text-white/80 flex items-center gap-2">
              <ShieldCheck size={18} className="text-brand-accent" />
              Configuração de Hedge
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Stake Inicial">
                  <input type="number" className="form-input" value={initialBet.stake} onChange={e => setInitialBet({...initialBet, stake: Number(e.target.value)})} onFocus={(e) => e.target.select()} />
                </InputGroup>
                <InputGroup label="Odd Inicial">
                  <input type="number" step="0.01" className="form-input" value={initialBet.odd} onChange={e => setInitialBet({...initialBet, odd: Number(e.target.value)})} onFocus={(e) => e.target.select()} />
                </InputGroup>
              </div>
              <InputGroup label="Odd Atual (Contra)">
                <input type="number" step="0.01" className="form-input" value={liveOdd} onChange={e => setLiveOdd(Number(e.target.value))} onFocus={(e) => e.target.select()} />
              </InputGroup>
            </div>
            
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <div className="text-[10px] font-bold text-blue-400 uppercase mb-1">Stake de Cobertura</div>
              <div className="text-2xl font-bold text-white">R$ {hedgeStats.hedgeStake.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <p className="text-[9px] text-white/40 mt-2 leading-relaxed">
                Aposte este valor na Odd {liveOdd} para garantir o mesmo retorno independente do resultado.
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 bg-brand-card p-8 rounded-2xl border border-white/5 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-8">Análise de Cobertura Sem Risco</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <div className="text-center">
                <div className="text-[10px] font-bold text-white/20 uppercase mb-2">Investimento Total</div>
                <div className="text-2xl font-bold text-white">R$ {hedgeStats.totalInvestment.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-bold text-white/20 uppercase mb-2">Lucro Garantido</div>
                <div className={cn("text-2xl font-bold", hedgeStats.finalProfit >= 0 ? "text-brand-accent" : "text-brand-danger")}>
                  R$ {hedgeStats.finalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-bold text-white/20 uppercase mb-2">ROI Garantido</div>
                <div className={cn("text-2xl font-bold", hedgeStats.roi >= 0 ? "text-brand-accent" : "text-brand-danger")}>
                  {hedgeStats.roi.toFixed(2)}%
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-white/20 mb-3">
                  <span>Barra de Aproveitamento (Hedge)</span>
                  <span className={cn(hedgeStats.finalProfit > 0 ? "text-brand-accent" : "text-white/40")}>
                    {hedgeStats.finalProfit > 0 ? 'MOMENTO IDEAL PARA COBRIR' : 'AGUARDE VALORIZAÇÃO'}
                  </span>
                </div>
                <div className="h-4 bg-white/5 rounded-full overflow-hidden relative">
                  <div 
                    className={cn(
                      "h-full transition-all duration-500",
                      hedgeStats.finalProfit > 0 ? "bg-brand-accent" : "bg-brand-danger"
                    )} 
                    style={{ width: `${Math.min(100, Math.max(0, (hedgeStats.roi + 20) * 2))}%` }} 
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white mix-blend-difference">
                    PONTO DE EQUILÍBRIO (BREAK-EVEN)
                  </div>
                </div>
              </div>

              <div className="p-4 bg-black/40 rounded-xl border border-white/5">
                <h4 className="text-[10px] font-bold text-white/60 uppercase mb-3 flex items-center gap-2">
                  <Info size={12} />
                  Dica Técnica
                </h4>
                <p className="text-[11px] text-white/40 leading-relaxed">
                  Para "travar" o lucro sem risco, a Odd de cobertura deve ser superior a 1 / (1 - (1/Odd Inicial)). 
                  Neste cenário, qualquer Odd acima de {(1 / (1 - (1/initialBet.odd))).toFixed(2)} garante lucro matemático.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}


function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap shrink-0",
        active 
          ? "bg-brand-accent text-brand-bg shadow-lg shadow-brand-accent/10" 
          : "text-white/40 hover:text-white/80 hover:bg-white/5"
      )}
    >
      <span className={cn(active ? "scale-110" : "opacity-70")}>{icon}</span>
      <span className="hidden lg:inline">{label}</span>
      {active && <span className="lg:hidden text-[10px] ml-1">{label}</span>}
    </button>
  );
}

function DropdownItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all",
        active 
          ? "bg-brand-accent/10 text-brand-accent" 
          : "text-white/40 hover:text-white hover:bg-white/5"
      )}
    >
      <span className={cn("shrink-0", active ? "text-brand-accent" : "opacity-70")}>{icon}</span>
      <span className="truncate">{label}</span>
      {active && <div className="ml-auto w-1 h-1 rounded-full bg-brand-accent shadow-[0_0_8px_rgba(0,255,136,0.5)]" />}
    </button>
  );
}

function StatCard({ title, value, icon, isCurrency, isPercent, trend, editable, onEdit }: { 
  title: string, 
  value: number, 
  icon: React.ReactNode, 
  isCurrency?: boolean, 
  isPercent?: boolean,
  trend?: number,
  editable?: boolean,
  onEdit?: (val: string) => void
}) {
  return (
    <div className="bg-brand-card p-5 rounded-2xl border border-white/5 shadow-lg flex flex-col justify-between group">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">{title}</span>
        <div className="p-2 bg-white/5 rounded-lg group-hover:scale-110 transition-transform">
          {icon}
        </div>
      </div>
      <div>
        <div className="flex items-baseline gap-1">
          {isCurrency && <span className="text-sm font-bold text-white/20">R$</span>}
          {editable ? (
            <input 
              type="number" 
              className="bg-transparent border-none p-0 text-2xl font-bold focus:ring-0 w-full"
              value={value}
              onChange={(e) => onEdit?.(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
          ) : (
            <span className="text-2xl font-bold tracking-tight">
              {value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
          {isPercent && <span className="text-sm font-bold text-white/20">%</span>}
        </div>
        {trend !== undefined && (
          <div className={cn(
            "text-[10px] font-bold mt-1 flex items-center gap-1",
            trend >= 0 ? "text-brand-accent" : "text-brand-danger"
          )}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(2)} {trend >= 0 ? 'Lucro' : 'Prejuízo'}
          </div>
        )}
      </div>
    </div>
  );
}

function InputGroup({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">{label}</label>
      {children}
    </div>
  );
}

function Step({ num, text }: { num: string, text: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
      <span className="w-6 h-6 rounded-full bg-brand-accent text-brand-bg flex items-center justify-center text-[10px] font-bold shrink-0">{num}</span>
      <p className="text-xs text-white/60 leading-relaxed">{text}</p>
    </div>
  );
}


// --- END OF FILE ---
