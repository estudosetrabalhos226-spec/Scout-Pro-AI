export type Resultado = 'Green' | 'Red' | 'Meio Green' | 'Meio Red' | 'Void';

export interface Lancamento {
  id: string;
  data: string;
  competicao: string;
  evento: string;
  mercado: string;
  odd: number;
  stake: number;
  resultado: Resultado;
  lucroLiquido: number;
}

export interface BankrollStats {
  bancaInicial: number;
  bancaAtual: number;
  roi: number;
  yield: number;
  totalStake: number;
  totalProfit: number;
}

export const MERCADOS_FUTEBOL = [
  'Match Odds (1X2)',
  'Over 0.5 HT',
  'Over 1.5 FT',
  'Over 2.5 FT',
  'Under 2.5 FT',
  'Ambas Marcam (BTTS)',
  'Handicap Asiático',
  'Draw No Bet (DNB)',
  'Cantos (Escanteios)',
  'Gols Exatos',
  'Placar Exato',
  'Intervalo/Final (HT/FT)',
];

export interface BacktestFilter {
  liga: string;
  minOdd: number;
  maxOdd: number;
  janelaTempo: string;
  mando: 'Casa' | 'Fora' | 'Ambos';
  estrategiaPreset: string;
  mercadoPersonalizado?: 'Escanteios' | 'Gols' | 'Cartões';
  tipoMercado?: 'Mais de' | 'Menos de';
  valorMercado?: number;
  minutoEvento: number;
  pressaoAlta: boolean;
  saidaQualificada: boolean;
  posseAlta: boolean;
}

export interface BacktestResult {
  equityCurve: { date: string; profit: number; balance: number }[];
  monteCarlo: { id: number; data: { x: number; y: number }[] }[];
  totalRoi: number;
  maxDrawdown: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  expectedValue: number;
  log: {
    id: number;
    time: string;
    match: string;
    odd: string;
    result: string;
    profit: string;
  }[];
}

export const LIGAS_TIMES: Record<string, string[]> = {
  'Premier League': [
    'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton', 'Chelsea', 
    'Crystal Palace', 'Everton', 'Fulham', 'Ipswich Town', 'Leicester City', 
    'Liverpool', 'Manchester City', 'Manchester United', 'Newcastle United', 
    'Nottingham Forest', 'Southampton', 'Tottenham Hotspur', 'West Ham United', 'Wolves'
  ],
  'La Liga': [
    'Alavés', 'Athletic Bilbao', 'Atlético Madrid', 'Barcelona', 'Celta Vigo', 
    'Espanyol', 'Getafe', 'Girona', 'Las Palmas', 'Leganés', 'Mallorca', 
    'Osasuna', 'Rayo Vallecano', 'Real Betis', 'Real Madrid', 'Real Sociedad', 
    'Sevilla', 'Valencia', 'Valladolid', 'Villarreal'
  ],
  'Brasileirão Série A': [
    'Athletico-PR', 'Atlético-GO', 'Atlético-MG', 'Bahia', 'Botafogo', 'Corinthians', 
    'Criciúma', 'Cruzeiro', 'Cuiabá', 'Flamengo', 'Fluminense', 'Fortaleza', 
    'Grêmio', 'Internacional', 'Juventude', 'Palmeiras', 'Red Bull Bragantino', 
    'São Paulo', 'Vasco da Gama', 'Vitória'
  ],
  'Bundesliga': [
    'Augsburg', 'Bayer Leverkusen', 'Bayern Munich', 'Bochum', 'Borussia Dortmund', 
    'Borussia Mönchengladbach', 'Eintracht Frankfurt', 'Freiburg', 'Heidenheim', 
    'Hoffenheim', 'Holstein Kiel', 'Mainz 05', 'RB Leipzig', 'St. Pauli', 
    'Stuttgart', 'Union Berlin', 'Werder Bremen', 'Wolfsburg'
  ],
  'Serie A (Itália)': [
    'Atalanta', 'Bologna', 'Cagliari', 'Como', 'Empoli', 'Fiorentina', 'Genoa', 
    'Inter Milan', 'Juventus', 'Lazio', 'Lecce', 'Monza', 'Napoli', 'Parma', 
    'Roma', 'AC Milan', 'Torino', 'Udinese', 'Venezia', 'Verona'
  ],
  'Champions League': [
    'Real Madrid', 'Manchester City', 'Bayern Munich', 'PSG', 'Liverpool', 
    'Inter Milan', 'Barcelona', 'Arsenal', 'Bayer Leverkusen', 'Atletico Madrid',
    'Borussia Dortmund', 'Juventus', 'AC Milan', 'Benfica', 'Sporting CP'
  ],
  'Outros': []
};
