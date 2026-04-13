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

export const getLeagueMatches = (id: string) =>
  request<{ matches: TournamentMatch[]; stake_per_match: number }>(`/leagues/${id}/matches`);

export const inviteToLeague = (leagueId: string, username: string) =>
  request<{ message: string }>(`/leagues/${leagueId}/invite`, {
    method: 'POST',
    body: JSON.stringify({ username }),
  });

// ── Notifications ─────────────────────────────────────────────────────────────
export const getNotifications = () =>
  request<{ notifications: AppNotification[]; unread_count: number }>('/notifications');

export const markNotificationRead = (id: string) =>
  request<{ message: string }>(`/notifications/${id}/read`, { method: 'PATCH' });

export const markAllNotificationsRead = () =>
  request<{ message: string }>('/notifications/read-all', { method: 'PATCH' });

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
export const getMyBets = (params?: { status?: string; search?: string; limit?: number; offset?: number }) => {
  const qs = params ? '?' + new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
  ).toString() : '';
  return request<{ bets: Bet[]; total: number }>(`/users/me/bets${qs}`);
};
export const getMyTransactions = () => request<{ transactions: PointTransaction[] }>('/users/me/transactions');
export const getMyReferralCode = () => request<{ referral_code: string; total_referrals: number }>('/users/me/referral-code');
export const getFeed = (filter?: 'following') =>
  request<{ feed: FeedItem[] }>(`/feed${filter ? `?filter=${filter}` : ''}`);
export const followUser = (username: string) =>
  request<{ following: boolean }>(`/users/${encodeURIComponent(username)}/follow`, { method: 'POST' });
export const unfollowUser = (username: string) =>
  request<{ following: boolean }>(`/users/${encodeURIComponent(username)}/follow`, { method: 'DELETE' });
export const getMyFollowing = () =>
  request<{ following: UserSearchResult[] }>('/users/me/following');

export const getPublicProfile = (username: string) =>
  request<{ user: PublicProfile }>(`/users/${encodeURIComponent(username)}`);
export const searchUsers = (q: string) =>
  request<{ users: UserSearchResult[] }>(`/users/search?q=${encodeURIComponent(q)}`);
export const getMyAchievements = () =>
  request<{ achievements: UserAchievement[]; streak: number }>('/users/me/achievements');
export const getDetailedStats = () =>
  request<DetailedStats>('/users/me/detailed-stats');

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminGetStats = () => request<AdminStats>('/admin/stats');
export const adminGetUsers = (search?: string) =>
  request<{ users: AdminUser[] }>(`/admin/users?limit=200${search ? `&search=${encodeURIComponent(search)}` : ''}`);
export const adminGetBets = (status?: string) =>
  request<{ bets: AdminBet[] }>(`/admin/bets?limit=200${status ? `&status=${status}` : ''}`);
export const adminGetGames = () => request<{ games: AdminGame[] }>('/admin/games?limit=200');
export const adminGetLeagues = () => request<{ leagues: AdminLeague[] }>('/admin/leagues');
export const adminGetQuiz = () => request<{ questions: AdminQuizQuestion[] }>('/admin/quiz');
export const adminAdjustPoints = (userId: string, amount: number, reason: string) =>
  request<{ message: string; user: { username: string; points_balance: number } }>(
    `/admin/users/${userId}/adjust-points`, { method: 'POST', body: JSON.stringify({ amount, reason }) }
  );
export const adminSendNotification = (data: { type: string; title: string; body?: string; target: string }) =>
  request<{ message: string; sent_to: number }>('/admin/notify', {
    method: 'POST', body: JSON.stringify(data),
  });
export const adminAddQuizQuestion = (data: {
  question_text: string; options: string[]; correct_option: string; category: string; points_reward: number;
}) => request<{ question: AdminQuizQuestion }>('/admin/quiz', { method: 'POST', body: JSON.stringify(data) });

export const adminGenerateQuiz = (category: string) =>
  request<{ question: Partial<AdminQuizQuestion> }>('/admin/quiz/generate', {
    method: 'POST', body: JSON.stringify({ category }),
  });

export const adminDeleteQuizQuestion = (id: string) =>
  request<{ message: string }>(`/admin/quiz/${id}`, { method: 'DELETE' });

export const adminGenerateMiniGames = () =>
  request<{ message: string }>('/admin/minigames/generate', { method: 'POST' });

export const adminFeatureGame = (id: string, bonus_pct: number, hours_before: number) =>
  request<{ message: string }>(`/admin/games/${id}/feature`, {
    method: 'POST', body: JSON.stringify({ bonus_pct, hours_before }),
  });
export const adminUnfeatureGame = (id: string) =>
  request<{ message: string }>(`/admin/games/${id}/feature`, { method: 'DELETE' });
export const adminGetGameAnalytics = (id: string) =>
  request<{ game: Game; questions: AdminGameAnalyticsQuestion[] }>(`/admin/games/${id}/analytics`);
export const adminGetUserBets = (userId: string) =>
  request<{ bets: AdminBet[] }>(`/admin/users/${userId}/bets`);
export const adminCancelBet = (betId: string) =>
  request<{ message: string }>(`/admin/bets/${betId}/cancel`, { method: 'POST' });
export const adminGetCompetitions = () =>
  request<{ competitions: AdminCompetition[] }>('/admin/competitions');
export const adminToggleCompetition = (id: string) =>
  request<{ competition: AdminCompetition }>(`/admin/competitions/${id}/toggle`, { method: 'PATCH' });
export const adminGetLog = () =>
  request<{ log: AdminLogEntry[] }>('/admin/log');

// ── Types ─────────────────────────────────────────────────────────────────────
export interface DetailedStats {
  summary: {
    total_settled: number; total_wins: number; total_losses: number; total_pending: number;
    total_staked: number; total_returned: number; net_profit: number; win_rate: number;
    biggest_win: number; best_odds_won: number; parlay_wins: number; current_streak: number;
  };
  by_competition: { competition_name: string; wins: number; losses: number; total: number; win_rate: number }[];
  monthly: { month: string; wins: number; losses: number; net: number }[];
}

export interface FeedItem {
  id: string;
  type: 'win' | 'achievement';
  user: { id: string; username: string; avatar_url: string | null };
  amount?: number;
  description?: string;
  achievement_key?: string;
  created_at: string;
}

export interface UserAchievement {
  achievement_key: string;
  unlocked_at: string;
}

export interface UserSearchResult {
  id: string;
  username: string;
  avatar_url: string | null;
  points_balance: number;
  total_bets: number;
  total_wins: number;
}

export interface PublicProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  points_balance: number;
  total_bets: number;
  total_wins: number;
  created_at: string;
  rank: number;
  league_count: number;
  streak: number;
  achievements: UserAchievement[];
  followers_count: number;
  following_count: number;
  is_following: boolean;
}

export const ACHIEVEMENTS: Record<string, { title: string; desc: string; icon: string }> = {
  first_bet:       { title: 'הימור ראשון',  desc: 'ביצעת את ההימור הראשון שלך',        icon: '🎯' },
  first_win:       { title: 'ניצחון ראשון', desc: 'ניצחת בהימור לראשונה',               icon: '🏆' },
  streak_3:        { title: 'שלישייה',       desc: '3 ניצחונות ברצף',                    icon: '🔥' },
  streak_5:        { title: 'חמישייה',       desc: '5 ניצחונות ברצף',                    icon: '🔥🔥' },
  streak_10:       { title: 'עשיריית אש',    desc: '10 ניצחונות ברצף',                   icon: '⚡' },
  high_roller:     { title: 'שחקן גדול',     desc: 'הימרת 1,000+ נקודות בהימור בודד',   icon: '💎' },
  parlay_win:      { title: 'מלך הפרלאי',    desc: 'ניצחת בהימור פרלאי',                 icon: '👑' },
  league_champion: { title: 'אלוף הליגה',    desc: 'זכית במקום ראשון בליגה',             icon: '🥇' },
};

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
  competition_name?: string;
  score_home?: number | null;
  score_away?: number | null;
  question_text?: string;
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

export interface TournamentMatch {
  id: string;
  home_team: string;
  away_team: string;
  home_team_logo?: string;
  away_team_logo?: string;
  start_time: string;
  status: string;
  score_home?: number | null;
  score_away?: number | null;
  bet_id?: string | null;
  selected_outcome?: string | null;
  stake?: number | null;
  bet_status?: string | null;
  actual_payout?: number | null;
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
  tournament_slug?: string | null;
  stake_per_match?: number;
  penalty_per_missed_bet?: number;
  max_members?: number | null;
  join_policy?: 'before_start' | 'anytime';
  auto_settle?: boolean;
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
  format: 'pool' | 'per_game' | 'tournament';
  duration_type: string;
  access_type?: 'invite' | 'public';
  min_bet?: number;
  entry_fee?: number;
  distribution?: { place: number; pct: number }[];
  allowed_competitions?: string[];
  season_end_date?: string;
  tournament_slug?: string;
  stake_per_match?: number;
  penalty_per_missed_bet?: number;
  max_members?: number;
  join_policy?: 'before_start' | 'anytime';
  auto_settle?: boolean;
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

export interface AppNotification {
  id: string;
  user_id: string;
  type: 'league_invite' | 'bet_won' | 'bet_lost' | 'daily_challenge' | 'league_result' | 'weekly_bonus' | 'special_offer' | 'admin_message';
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface PointTransaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

// ── Admin types ───────────────────────────────────────────────────────────────
export interface AdminStats {
  users: { total_users: string; new_today: string; new_this_month: string };
  bets: { total_bets: string; pending: string; won: string; lost: string; total_staked: string; total_paid_out: string; live_bets: string };
  leagues: { total: string; active: string };
  transactions_by_type: { type: string; volume: string; count: string }[];
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  points_balance: number;
  total_bets: number;
  total_wins: number;
  created_at: string;
  referral_code: string;
}

export interface AdminBet {
  id: string;
  username: string;
  home_team: string;
  away_team: string;
  selected_outcome: string;
  stake: number;
  odds: number;
  potential_payout: number;
  actual_payout?: number;
  status: string;
  is_live_bet: boolean;
  placed_at: string;
}

export interface AdminGame {
  id: string;
  home_team: string;
  away_team: string;
  competition_name?: string;
  start_time: string;
  status: string;
  score_home?: number;
  score_away?: number;
  total_bets: string;
}

export interface AdminLeague {
  id: string;
  name: string;
  format: string;
  creator_username: string;
  member_count: string;
  pool_total: number;
  entry_fee: number;
  status: string;
  tournament_slug?: string;
  created_at: string;
}

export interface AdminQuizQuestion {
  id: string;
  question_text: string;
  options: string[];
  correct_option: string;
  category: string;
  points_reward: number;
  is_active: boolean;
  publish_date?: string | null;
  created_at: string;
}

export interface AdminGameAnalyticsQuestion {
  question_text: string;
  type: string;
  outcomes: { outcome: string; bet_count: number; total_staked: number; pct: number }[];
}

export interface AdminCompetition {
  id: string;
  slug: string;
  name: string;
  country?: string;
  is_active: boolean;
  game_count: string;
  upcoming: string;
}

export interface AdminLogEntry {
  id: string;
  admin_email: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  created_at: string;
}
