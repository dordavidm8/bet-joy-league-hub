// api.ts – לקוח API מרכזי
// כל הפונקציות לתקשורת עם ה-backend (typed).
// מוסיף Firebase ID Token אוטומטית לכל בקשה מאומתת.
// API_BASE: VITE_API_URL + '/api'
// יצוא: getGames, placeBet, getAdvisor, getLiveGames, getLeagues, etc.
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
export const getEmailByUsername = (username: string) =>
  request<{ email: string }>('/users/email-by-username', {
    method: 'POST', body: JSON.stringify({ username }),
  });

export const registerUser = (username: string, referral_code?: string, avatar_url?: string, display_name?: string) =>
  request<{ user: BackendUser }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, referral_code, avatar_url, display_name }),
  });

export const updateProfile = (data: { username?: string; display_name?: string }) =>
  request<{ user: BackendUser }>('/users/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(data),
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

export const cancelBet = (betId: string) =>
  request<{ message: string }>(`/bets/${betId}`, { method: 'DELETE' });

// ── Leaderboard ───────────────────────────────────────────────────────────────
export const getLeaderboard = (limit = 50) =>
  request<{ leaderboard: LeaderboardEntry[] }>(`/leaderboard/global?limit=${limit}`);

export const getMyRank = () => request<{ rank: number | null; points_balance: number }>('/leaderboard/me');

// ── Leagues ───────────────────────────────────────────────────────────────────
export const getMyLeagues = () => request<{ leagues: League[] }>('/leagues/my/list');

export const getPublicLeagues = () => request<{ leagues: League[] }>('/leagues/public');

export const joinPublicLeague = (id: string) =>
  request<{ message: string; league: League }>(`/leagues/${id}/join-public`, { method: 'POST' });

export const getLeague = (id: string) => request<{ league: League; members: LeagueMember[] }>(`/leagues/${id}`);

export const createLeague = (data: CreateLeagueInput) =>
  request<{ league: League }>('/leagues', { method: 'POST', body: JSON.stringify(data) });

export const joinLeague = (invite_code: string) =>
  request<{ message: string; league: League }>('/leagues/join', { method: 'POST', body: JSON.stringify({ invite_code }) });

export const getLeagueByInviteCode = (invite_code: string) =>
  request<{ league: League }> (`/leagues/invite/${invite_code}`);

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

export async function askAdvisorStream(
  gameId: string,
  messages: AdvisorMessage[],
  onEvent: (type: string, data: Record<string, unknown>) => void
): Promise<void> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : '';
  const url = `${API_BASE}/advisor/${gameId}/stream?messages=${encodeURIComponent(JSON.stringify(messages))}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const part of parts) {
      const ev = part.match(/^event: (\w+)/m);
      const da = part.match(/^data: (.+)/m);
      if (ev && da) try { onEvent(ev[1], JSON.parse(da[1])); } catch {}
    }
  }
}

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
  request<{ user: PublicProfile; bets: Bet[] }>(`/users/${encodeURIComponent(username)}`);
export const searchUsers = (q: string) =>
  request<{ users: UserSearchResult[] }>(`/users/search?q=${encodeURIComponent(q)}`);
export const getMyAchievements = () =>
  request<{ achievements: UserAchievement[]; streak: number }>('/users/me/achievements');
export const getDetailedStats = () =>
  request<DetailedStats>('/users/me/detailed-stats');

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminGetMe = () => request<{ is_admin: boolean; email: string }>('/admin/me');
export interface AdminUserEntry { email: string; added_by: string; added_at: string }
export const adminGetAdmins = () => request<{ admins: AdminUserEntry[] }>('/admin/admins');
export const adminAddAdmin = (email: string) =>
  request<{ ok: boolean }>('/admin/admins', { method: 'POST', body: JSON.stringify({ email }) });
export const adminRemoveAdmin = (email: string) =>
  request<{ ok: boolean }>(`/admin/admins/${encodeURIComponent(email)}`, { method: 'DELETE' });
export const adminGetStats = () => request<AdminStats>('/admin/stats');
export const adminGetUsers = (search?: string) =>
  request<{ users: AdminUser[] }>(`/admin/users?limit=200${search ? `&search=${encodeURIComponent(search)}` : ''}`);
export const adminGetBets = (status?: string) =>
  request<{ bets: AdminBet[] }>(`/admin/bets?limit=200${status ? `&status=${status}` : ''}`);
export const adminGetGames = (all = false) =>
  request<{ games: AdminGame[] }>(`/admin/games?limit=500${all ? '&from=all' : ''}`);
export const adminGetLeagues = () => request<{ leagues: AdminLeague[] }>('/admin/leagues');
export const adminPauseLeague = (id: string) =>
  request<{ message: string }>(`/admin/leagues/${id}/pause`, { method: 'POST' });
export const adminStopLeague = (id: string, distribute_prizes: boolean, custom_pool_total?: number, custom_distribution?: number[]) =>
  request<{ message: string }>(`/admin/leagues/${id}/stop`, {
    method: 'POST', body: JSON.stringify({ distribute_prizes, custom_pool_total, custom_distribution }),
  });
export const adminRemoveWaGroup = (id: string) =>
  request<{ message: string }>(`/admin/leagues/${id}/wa-group`, { method: 'DELETE' });
export const adminSetWaInviteLink = (id: string, invite_link: string) =>
  request<{ message: string }>(`/admin/leagues/${id}/wa-group`, {
    method: 'PATCH', body: JSON.stringify({ invite_link }),
  });
export const adminGetQuiz = () => request<{ questions: AdminQuizQuestion[] }>('/admin/quiz');
export const adminAdjustPoints = (userId: string, amount: number, reason: string) =>
  request<{ message: string; user: { username: string; points_balance: number } }>(
    `/admin/users/${userId}/adjust-points`, { method: 'POST', body: JSON.stringify({ amount, reason }) }
  );
export const adminSendNotification = (data: { 
  type: string; 
  title: string; 
  body?: string; 
  target: string | string[] | { league_id: string } | { league_ids: string[] };
  send_to_dms?: boolean;
  send_to_group?: boolean;
}) =>
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

export const adminGetMiniGameDraft = (type: string, options?: any) => {
  const query = options ? '?' + new URLSearchParams(options).toString() : '';
  return request<{ draft: any }>(`/admin/minigames/drafts/${type}${query}`);
};

export const verifyBox2BoxGuess = (team1: string, team2: string, guess: string) => 
  request<{ valid: boolean }>('/minigames/box2box/verify', { method: 'POST', body: JSON.stringify({ team1, team2, guess }) });

export const adminSaveMiniGameDraft = (game: any) =>
  request<{ message: string }>('/admin/minigames/save-drafts', { method: 'POST', body: JSON.stringify({ games: [game] }) });

export const adminGetMiniGameQueue = () =>
  request<{ queue: any[] }>('/admin/minigames/queue');

export const adminUpdateMiniGameQueueDate = (id: string, play_date: string) =>
  request<{ game: any }>(`/admin/minigames/queue/${id}`, { method: 'PATCH', body: JSON.stringify({ play_date }) });

export const adminDeleteMiniGameQueue = (id: string) =>
  request<{ message: string }>(`/admin/minigames/queue/${id}`, { method: 'DELETE' });

export const adminFeatureGame = (id: string, bonus_pct: number, hours_before: number) =>
  request<{ message: string }>(`/admin/games/${id}/feature`, {
    method: 'POST', body: JSON.stringify({ bonus_pct, hours_before }),
  });
export const adminUnfeatureGame = (id: string) =>
  request<{ message: string }>(`/admin/games/${id}/feature`, { method: 'DELETE' });
export const adminLockGame = (id: string) =>
  request<{ message: string }>(`/admin/games/${id}/lock`, { method: 'POST' });
export const adminUnlockGame = (id: string) =>
  request<{ message: string }>(`/admin/games/${id}/lock`, { method: 'DELETE' });
export const adminUpdateGameOdds = (id: string, home_odds: number, draw_odds: number, away_odds: number) =>
  request<{ message: string }>(`/admin/games/${id}/odds`, {
    method: 'PATCH', body: JSON.stringify({ home_odds, draw_odds, away_odds }),
  });
export const adminDeleteUser = (id: string) =>
  request<{ message: string }>(`/admin/users/${id}`, { method: 'DELETE' });
export const adminCleanupAnonymizedUsers = () =>
  request<{ message: string }>('/admin/users/cleanup-anonymized', { method: 'POST' });
export const adminUpdateUser = (id: string, data: { username?: string; display_name?: string }) =>
  request<{ user: { id: string; username: string; display_name: string | null; email: string } }>(
    `/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }
  );
export const adminUnlinkPhone = (id: string) =>
  request<{ ok: boolean }>(`/admin/users/${id}/phone`, { method: 'DELETE' });
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
  display_name: string | null;
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
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  points_balance: number;
  total_bets: number;
  total_wins: number;
  referral_code: string;
  phone_number: string | null;
  phone_verified: boolean;
  created_at: string;
}

export interface Game {
  id: string;
  competition_name?: string;
  competition_slug?: string;
  home_team: string;
  away_team: string;
  home_team_logo?: string;
  away_team_logo?: string;
  start_time: string;
  status: 'scheduled' | 'live' | 'finished' | 'cancelled';
  minute?: number | null;
  score_home?: number;
  score_away?: number;
  is_featured?: boolean;
  featured_bonus_pct?: number;
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
  league_name?: string;
  league_id?: string;
  league_bet_mode?: string;
  league_access_type?: string;
  game_status?: string;
  exact_score_prediction?: string;
  parlay_id?: string;
  parlay_number?: number;
  league_display_name?: string;
}

export interface Parlay {
  id: string;
  user_id: string;
  parlay_number: number;
  total_stake: number;
  potential_payout: number;
  actual_payout?: number;
  status: 'pending' | 'won' | 'lost';
}

export interface PlaceBetInput {
  game_id: string;
  bet_question_id: string;
  selected_outcome: string;
  stake: number;
  league_id?: string | null;
  league_ids?: string[];
  exact_score_prediction?: string;
}

/** Each leg now carries its own stake. No top-level stake field. */
export interface PlaceParlayInput {
  legs: { game_id: string; bet_question_id: string; selected_outcome: string; odds: number; stake: number }[];
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  display_name: string | null;
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
  bet_odds?: number | null;
  bet_status?: string | null;
  actual_payout?: number | null;
  exact_score_prediction?: string | null;
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
  is_tournament?: boolean;
  tournament_slug?: string | null;
  stake_per_match?: number;
  penalty_per_missed_bet?: number;
  max_members?: number | null;
  join_policy?: 'before_start' | 'anytime';
  auto_settle?: boolean;
  bet_mode?: 'minimum_stake' | 'initial_balance';
  created_at: string;
  tournament_name?: string;
  is_member?: boolean;
}

export interface LeagueMember {
  id: string;
  username: string;
  display_name: string | null;
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
  is_tournament?: boolean;
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
  display_name: string | null;
  email: string;
  points_balance: number;
  total_bets: number;
  total_wins: number;
  created_at: string;
  phone_number?: string;
  phone_verified?: boolean;
  wa_opt_in?: boolean;
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
  question_text?: string;
  bet_type?: string;
  league_name?: string;
  league_id?: string;
  league_bet_mode?: string;
  league_access_type?: string;
  exact_score_prediction?: string;
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
  odds_source?: string;
  match_winner_outcomes?: { label: string; odds: number }[];
}

export interface AdminLeague {
  id: string;
  name: string;
  format: string;
  access_type: 'invite' | 'public';
  creator_username: string;
  member_count: string;
  pool_total: number;
  entry_fee: number;
  status: string;
  tournament_slug?: string;
  created_at: string;
  wa_group_id?: string | null;
  wa_invite_link?: string | null;
  wa_group_active?: boolean;
  distribution?: { place: number; pct: number }[] | null;
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

// ── WhatsApp ──────────────────────────────────────────────────────────────────
export interface WaStatus {
  phone_number: string | null;
  phone_verified: boolean;
  wa_opt_in: boolean;
}

export interface WaLeagueSettings {
  league_id: string;
  bet_mode: 'prediction' | 'fixed';
  stake_amount: number;
  exact_score_enabled: boolean;
  morning_message_time: string;
  reminder_hours_before: number | null;
  leaderboard_frequency: 'never' | 'after_game' | 'daily' | 'weekly';
  leaderboard_time: string | null;
  leaderboard_day: number | null;
  wa_group_id: string | null;
  invite_link: string | null;
  group_active: boolean;
}

export const getWaStatus = () =>
  request<WaStatus>('/whatsapp/status');

export const linkPhone = (phone: string) =>
  request<{ message: string; phone: string; debug_code?: string }>('/whatsapp/link-phone', {
    method: 'POST', body: JSON.stringify({ phone }),
  });

export const verifyPhone = (code: string) =>
  request<{ message: string; phone: string }>('/whatsapp/verify', {
    method: 'POST', body: JSON.stringify({ code }),
  });

export const unlinkPhone = () =>
  request<{ message: string }>('/whatsapp/unlink', { method: 'DELETE' });

export const setWaOptIn = (wa_opt_in: boolean) =>
  request<{ wa_opt_in: boolean }>('/whatsapp/opt-in', {
    method: 'PATCH', body: JSON.stringify({ wa_opt_in }),
  });

export const getWaLeagueSettings = (leagueId: string) =>
  request<{ settings: WaLeagueSettings | null }>(`/whatsapp/leagues/${leagueId}/settings`);

export const updateWaLeagueSettings = (leagueId: string, data: Partial<WaLeagueSettings>) =>
  request<{ message: string }>(`/whatsapp/leagues/${leagueId}/settings`, {
    method: 'PUT', body: JSON.stringify(data),
  });

export const createWaGroup = (leagueId: string) =>
  request<{ wa_group_id?: string; invite_link?: string; status?: string; message?: string }>(
    `/whatsapp/leagues/${leagueId}/create-group`, { method: 'POST' }
  );

export const linkWaGroup = (leagueId: string, wa_group_id: string) =>
  request<{ message: string }>(`/whatsapp/leagues/${leagueId}/link-group`, {
    method: 'POST', body: JSON.stringify({ wa_group_id }),
  });

export const unlinkWaGroup = (leagueId: string) =>
  request<{ message: string }>(`/whatsapp/leagues/${leagueId}/group`, { method: 'DELETE' });

export const refreshWaInviteLink = (leagueId: string) =>
  request<{ invite_link: string }>(`/whatsapp/leagues/${leagueId}/refresh-invite-link`, { method: 'POST' });

export const setWaInviteLink = (leagueId: string, invite_link: string) =>
  request<{ ok: boolean }>(`/whatsapp/leagues/${leagueId}/invite-link`, {
    method: 'PUT', body: JSON.stringify({ invite_link }),
  });

export const broadcastToLeague = (leagueId: string) =>
  request<{ message: string }>(`/whatsapp/leagues/${leagueId}/broadcast`, { method: 'POST' });

// ── Team name translations ─────────────────────────────────────────────────────
export const getApprovedTeamTranslations = () =>
  request<{ translations: Record<string, string> }>('/games/team-translations');

export const adminGetTeamTranslations = (search?: string, status?: string) => {
  let qs = "";
  if (search || status) {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (status) p.set("status", status);
    qs = "?" + p.toString();
  }
  return request<{ translations: { name_en: string; name_he: string | null; status: string; created_at?: string; is_override: boolean }[] }>(`/admin/team-translations${qs}`);
};

export const adminApproveTeamTranslation = (name_en: string, name_he: string) =>
  request<{ ok: boolean }>(`/admin/team-translations/${encodeURIComponent(name_en)}`, {
    method: 'PUT', body: JSON.stringify({ name_he }),
  });

export const adminDismissTeamTranslation = (name_en: string) =>
  request<{ ok: boolean }>(`/admin/team-translations/${encodeURIComponent(name_en)}`, { method: 'DELETE' });

export const adminRunSettlement = () =>
  request<{ ok: boolean; settled: number; games: number }>('/admin/run-settlement', { method: 'POST' });

export const adminOddsDebug = () =>
  request<{ has_api_key: boolean; total_matches: number; sample_keys: string[] }>('/admin/odds-debug');

export const adminRegenerateBetQuestions = () =>
  request<{ ok: boolean; updated: number }>('/admin/regenerate-bet-questions', { method: 'POST' });

// ── AI Advisor Admin ──────────────────────────────────────────────────────────
export const advisorGetStats = (days = 30) =>
  request<{ overview: Record<string, unknown>; daily: { date: string; requests: number; tokens: number }[] }>(`/admin/advisor/stats?days=${days}`);

export const advisorGetToolStats = (days = 30) =>
  request<{ tool_name: string; calls: number; avg_ms: number }[]>(`/admin/advisor/stats/tools?days=${days}`);

export const advisorGetTopUsers = (days = 30) =>
  request<{ user_id: string; requests: number; tokens: number }[]>(`/admin/advisor/stats/users?days=${days}`);

export const advisorGetEvents = (limit = 50, offset = 0) =>
  request<{ id: string; user_id: string; event_type: string; tool_name: string | null; total_tokens: number | null; duration_ms: number | null; error_message: string | null; created_at: string }[]>(`/admin/advisor/events?limit=${limit}&offset=${offset}`);

export const advisorGetConfig = () =>
  request<Record<string, { value: string; updated_at: string | null; updated_by: string | null }>>('/admin/advisor/config');

export const advisorPatchConfig = (patch: Record<string, string>) =>
  request<{ ok: boolean }>('/admin/advisor/config', { method: 'PATCH', body: JSON.stringify(patch) });

export const advisorGetSecrets = () =>
  request<{ key: string; preview: string | null; source?: string; updated_at: string | null }[]>('/admin/advisor/secrets');

export const advisorUpdateSecret = (key: string, value: string) =>
  request<{ ok: boolean; preview: string }>(`/admin/advisor/secrets/${key}`, { method: 'PUT', body: JSON.stringify({ value }) });

export const advisorTestSecret = (key: string) =>
  request<{ ok: boolean; message: string }>(`/admin/advisor/secrets/${key}/test`, { method: 'POST' });

export async function advisorPlaygroundStream(
  messages: { role: string; content: string }[],
  onEvent: (type: string, data: unknown) => void
): Promise<void> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : '';
  const url = `${API_BASE}/admin/advisor/playground?messages=${encodeURIComponent(JSON.stringify(messages))}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const part of parts) {
      const eventLine = part.match(/^event: (\w+)/m);
      const dataLine  = part.match(/^data: (.+)/m);
      if (eventLine && dataLine) {
        try { onEvent(eventLine[1], JSON.parse(dataLine[1])); } catch {}
      }
    }
  }
}

// ── Support ──────────────────────────────────────────────────────────────────
export const getMySupportInquiries = () =>
  request<{ inquiries: AdminSupportInquiry[] }>("/support");
export interface AdminSupportInquiry {
  id: string;
  inquiry_number: number;
  user_id: string;
  username: string;
  email: string;
  display_name: string | null;
  phone_number: string | null;
  phone_verified: boolean;
  wa_opt_in: boolean;
  message: string;
  status: 'unread' | 'read_unhandled' | 'handled';
  reply_message?: string;
  replied_at?: string;
  created_at: string;
  updated_at: string;
}

export const sendSupportInquiry = (message: string) =>
  request<{ inquiry: any }>('/support', { method: 'POST', body: JSON.stringify({ message }) });

export const adminGetSupportInquiries = (status?: string) =>
  request<{ inquiries: AdminSupportInquiry[] }>(`/admin/support-inquiries${status ? `?status=${status}` : ''}`);

export const adminUpdateSupportStatus = (id: string, status: string) =>
  request<{ inquiry: AdminSupportInquiry }>(`/admin/support-inquiries/${id}/status`, { 
    method: 'PATCH', body: JSON.stringify({ status }) 
  });

export const adminReplyToSupport = (id: string, message: string) =>
  request<{ ok: boolean }>(`/admin/support-inquiries/${id}/reply`, { 
    method: 'POST', body: JSON.stringify({ message }) 
  });
