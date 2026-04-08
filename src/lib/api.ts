import { auth } from './firebase';

const API_BASE = (import.meta.env.VITE_API_URL ?? '') + '/api';

async function getHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) return { 'Content-Type': 'application/json' };
  const token = await user.getIdToken();
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await getHeaders();
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const registerUser = (username: string, referral_code?: string, avatar_url?: string) =>
  request<{ user: BackendUser }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, referral_code, avatar_url }),
  });

export const updateAvatar = (avatar_url: string) =>
  request<{ user: BackendUser }>('/users/me/avatar', {
    method: 'PATCH',
    body: JSON.stringify({ avatar_url }),
  });

export const getMe = () => request<{ user: BackendUser }>('/auth/me');

// ── Games ─────────────────────────────────────────────────────────────────────
export interface GetGamesParams {
  status?: string;
  search?: string;
  competition?: string;
  from?: string;
  to?: string;
  featured?: boolean;
}

export const getGames = (params?: GetGamesParams) => {
  const p: Record<string, string> = {};
  if (params) {
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) p[k] = String(v); });
  }
  const qs = Object.keys(p).length ? '?' + new URLSearchParams(p).toString() : '';
  return request<{ games: Game[] }>(`/games${qs}`);
};

export const getFinishedGames = (days = 7) =>
  request<{ games: Game[] }>(`/games/results?days=${days}`);

export const getLiveGames = () => request<{ games: Game[] }>('/games/live');

export const getRecentResults = () => request<{ games: Game[] }>('/games/results');

export const getGame = (id: string) => request<{ game: Game; bet_questions: BetQuestion[] }>(`/games/${id}`);

// ── Bets ──────────────────────────────────────────────────────────────────────
export const placeBet = (data: PlaceBetInput) =>
  request<{ bet: Bet; payout: number }>('/bets', { method: 'POST', body: JSON.stringify(data) });

export const placeParlay = (data: PlaceParlayInput) =>
  request<{ parlay: Parlay }>('/bets/parlay', { method: 'POST', body: JSON.stringify(data) });

// ── Leaderboard ───────────────────────────────────────────────────────────────
export const getLeaderboard = (limit = 50) =>
  request<{ leaderboard: LeaderboardEntry[] }>(`/leaderboard/global?limit=${limit}`);

export const getMyRank = () => request<{ rank: number | null; points_balance: number }>('/leaderboard/me');

// ── Leagues ───────────────────────────────────────────────────────────────────
export const getMyLeagues = () => request<{ leagues: League[] }>('/leagues/my/list');

export const getLeague = (id: string) => request<{ league: League; members: LeagueMember[] }>(`/leagues/${id}`);

export const createLeague = (data: CreateLeagueInput) =>
  request<{ league: League }>('/leagues', { method: 'POST', body: JSON.stringify(data) });

export const joinLeague = (invite_code: string) =>
  request<{ message: string; league: League }>('/leagues/join', { method: 'POST', body: JSON.stringify({ invite_code }) });

export const settleLeague = (id: string) =>
  request<{ message: string }>(`/leagues/${id}/settle`, { method: 'POST' });

export const leaveLeague = (id: string) =>
  request<{ message: string }>(`/leagues/${id}/leave`, { method: 'POST' });

// ── Quiz ──────────────────────────────────────────────────────────────────────
export const getNextQuestion = () => request<{ question: QuizQuestion | null }>('/quiz/next');

export const answerQuestion = (id: string, selected_option: string) =>
  request<{ correct: boolean; correct_option: string; points_earned: number }>(
    `/quiz/${id}/answer`, { method: 'POST', body: JSON.stringify({ selected_option }) }
  );

// ── AI Advisor ────────────────────────────────────────────────────────────────
export interface AdvisorMessage { role: 'user' | 'assistant'; content: string; }
export const askAdvisor = (gameId: string, messages: AdvisorMessage[]) =>
  request<{ reply: string; remaining: number }>(`/advisor/${gameId}`, {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });

// ── User ──────────────────────────────────────────────────────────────────────
export const getMyStats = () => request<UserStats>('/users/me/stats');
export const deleteAccount = () => request<{ message: string }>('/users/me', { method: 'DELETE' });
export const getMyBets = () => request<{ bets: Bet[] }>('/users/me/bets');
export const getMyTransactions = () => request<{ transactions: PointTransaction[] }>('/users/me/transactions');
export const getMyReferralCode = () => request<{ referral_code: string; total_referrals: number }>('/users/me/referral-code');

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BackendUser {
  id: string;
  firebase_uid: string;
  username: string;
  email: string;
  avatar_url: string | null;
  points_balance: number;
  total_bets: number;
  total_wins: number;
  referral_code: string;
  created_at: string;
}

export interface Game {
  id: string;
  competition_name?: string;
  home_team: string;
  away_team: string;
  home_team_logo?: string;
  away_team_logo?: string;
  start_time: string;
  status: 'scheduled' | 'live' | 'finished' | 'cancelled';
  minute?: number | null;
  score_home?: number;
  score_away?: number;
}

export interface BetQuestion {
  id: string;
  game_id: string;
  type: string;
  question_text: string;
  outcomes: { label: string; odds: number }[];
  correct_outcome?: string | null;
}

export interface Bet {
  id: string;
  user_id: string;
  game_id: string;
  bet_question_id: string;
  selected_outcome: string;
  stake: number;
  odds: number;
  potential_payout: number;
  actual_payout?: number;
  status: 'pending' | 'won' | 'lost' | 'cancelled';
  is_live_bet: boolean;
  penalty_pct?: number;
  placed_at: string;
  home_team?: string;
  away_team?: string;
}

export interface Parlay {
  id: string;
  user_id: string;
  stake: number;
  potential_payout: number;
  actual_payout?: number;
  status: 'pending' | 'won' | 'lost';
}

export interface PlaceBetInput {
  game_id: string;
  bet_question_id: string;
  selected_outcome: string;
  stake: number;
}

export interface PlaceParlayInput {
  legs: { game_id: string; bet_question_id: string; selected_outcome: string; odds: number }[];
  stake: number;
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  avatar_url: string | null;
  points_balance: number;
  total_bets: number;
  total_wins: number;
  rank: number;
}

export interface League {
  id: string;
  name: string;
  description?: string;
  creator_id: string;
  invite_code: string;
  format: 'pool' | 'per_game';
  duration_type: string;
  access_type: 'invite' | 'public';
  status: 'active' | 'finished';
  min_bet: number;
  entry_fee: number;
  pool_total: number;
  distribution?: { place: number; pct: number }[] | null;
  season_end_date?: string | null;
  member_count?: number;
  points_in_league?: number;
  is_active?: boolean;
  created_at: string;
}

export interface LeagueMember {
  id: string;
  username: string;
  avatar_url?: string;
  points_in_league: number;
  joined_at: string;
  is_active: boolean;
}

export interface CreateLeagueInput {
  name: string;
  description?: string;
  format: 'pool' | 'per_game';
  duration_type: string;
  access_type?: 'invite' | 'public';
  min_bet?: number;
  entry_fee?: number;
  distribution?: { place: number; pct: number }[];
  allowed_competitions?: string[];
  season_end_date?: string;
}

export interface QuizQuestion {
  id: string;
  question_text: string;
  options: string[];
  category: string;
  points_reward: number;
}

export interface UserStats {
  username: string;
  points_balance: number;
  total_bets: number;
  total_wins: number;
  win_rate: string;
  referral_code: string;
  member_since: string;
}

export interface PointTransaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}
