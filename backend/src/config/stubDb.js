// In-memory mock database — used when STUB_MODE=true
// Lets the server run without a real PostgreSQL instance

const { v4: uuid } = require('uuid');

const STUB_USER = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  firebase_uid: 'stub-uid-001',
  username: 'demo',
  email: 'demo@kickoff.app',
  avatar_url: null,
  points_balance: 1250,
  total_bets: 18,
  total_wins: 12,
  created_at: new Date('2026-01-01'),
  updated_at: new Date(),
};

const GAME_1 = 'game0001-0000-0000-0000-000000000001';
const GAME_2 = 'game0002-0000-0000-0000-000000000002';
const GAME_3 = 'game0003-0000-0000-0000-000000000003';

const STUB_GAMES = [
  {
    id: GAME_1, api_id: 'g-001', competition_name: 'פרמייר ליג',
    home_team: "מנצ'סטר סיטי", away_team: 'ארסנל',
    home_team_logo: null, away_team_logo: null,
    start_time: new Date(Date.now() + 2 * 3600 * 1000),
    status: 'scheduled', minute: null, home_score: null, away_score: null,
  },
  {
    id: GAME_2, api_id: 'g-002', competition_name: 'פרמייר ליג',
    home_team: 'ליברפול', away_team: "צ'לסי",
    home_team_logo: null, away_team_logo: null,
    start_time: new Date(Date.now() - 35 * 60 * 1000),
    status: 'live', minute: 35, home_score: 1, away_score: 0,
  },
  {
    id: GAME_3, api_id: 'g-003', competition_name: 'ליגת העל',
    home_team: 'מכבי תל אביב', away_team: 'הפועל באר שבע',
    home_team_logo: null, away_team_logo: null,
    start_time: new Date(Date.now() - 3 * 3600 * 1000),
    status: 'finished', minute: 90, home_score: 2, away_score: 1,
  },
];

const BQ_1A = 'bq000001-0000-0000-0000-000000000001';
const BQ_1B = 'bq000001-0000-0000-0000-000000000002';
const BQ_2A = 'bq000002-0000-0000-0000-000000000001';

const STUB_BET_QUESTIONS = [
  {
    id: BQ_1A, game_id: GAME_1, type: 'winner',
    question_text: 'מי ינצח?',
    outcomes: [
      { label: "מנצ'סטר סיטי", odds: 1.75 },
      { label: 'תיקו', odds: 3.40 },
      { label: 'ארסנל', odds: 4.20 },
    ],
    correct_outcome: null, is_locked: false,
  },
  {
    id: BQ_1B, game_id: GAME_1, type: 'over_under',
    question_text: 'יותר או פחות מ-2.5 גולים?',
    outcomes: [
      { label: 'יותר מ-2.5', odds: 1.85 },
      { label: 'פחות מ-2.5', odds: 1.95 },
    ],
    correct_outcome: null, is_locked: false,
  },
  {
    id: BQ_2A, game_id: GAME_2, type: 'winner',
    question_text: 'מי ינצח?',
    outcomes: [
      { label: 'ליברפול', odds: 1.55 },
      { label: 'תיקו', odds: 3.80 },
      { label: "צ'לסי", odds: 5.00 },
    ],
    correct_outcome: null, is_locked: false,
  },
];

const STUB_BETS = [
  {
    id: 'bet00001-0000-0000-0000-000000000001',
    user_id: STUB_USER.id, game_id: GAME_1, bet_question_id: BQ_1A,
    selected_option: 'home', stake: 200, odds: 1.75, live_penalty_pct: 0,
    potential_payout: 350, actual_payout: null, is_live_bet: false, status: 'pending',
    placed_at: new Date(Date.now() - 10 * 60 * 1000),
    home_team: "מנצ'סטר סיטי", away_team: 'ארסנל',
    start_time: new Date(Date.now() + 2 * 3600 * 1000),
    question_text: 'מי ינצח?',
  },
  {
    id: 'bet00002-0000-0000-0000-000000000002',
    user_id: STUB_USER.id, game_id: GAME_3, bet_question_id: 'bq-stub-3',
    selected_option: 'home', stake: 150, odds: 2.10, live_penalty_pct: 0,
    potential_payout: 315, actual_payout: 315, is_live_bet: false, status: 'won',
    placed_at: new Date(Date.now() - 4 * 3600 * 1000),
    settled_at: new Date(Date.now() - 3600 * 1000),
    home_team: 'מכבי תל אביב', away_team: 'הפועל באר שבע',
    start_time: new Date(Date.now() - 3 * 3600 * 1000),
    question_text: 'מי ינצח?',
  },
];

const STUB_LEAGUES = [
  {
    id: 'league01-0000-0000-0000-000000000001',
    name: 'חברים מהעבודה', description: 'ליגה פרטית לצוות',
    creator_id: STUB_USER.id, invite_code: 'WORK2026',
    format: 'pool', duration_type: 'full_season', access_type: 'invite',
    min_bet: 50, entry_fee: 500, pool_total: 2000,
    distribution: [{ place: 1, pct: 60 }, { place: 2, pct: 30 }, { place: 3, pct: 10 }],
    status: 'active', member_count: 4, points_in_league: 320, is_active: true,
  },
];

const STUB_LEADERBOARD = [
  { id: 'u-l-001', username: 'KingBettor', avatar_url: null, points_balance: 3200, total_bets: 45, total_wins: 32, rank: 1 },
  { id: 'u-l-002', username: 'GoalGuru', avatar_url: null, points_balance: 2850, total_bets: 38, total_wins: 25, rank: 2 },
  { id: 'u-l-003', username: 'FootballPro', avatar_url: null, points_balance: 2100, total_bets: 30, total_wins: 19, rank: 3 },
  { ...STUB_USER, rank: 4 },
  { id: 'u-l-005', username: 'LuckyShot', avatar_url: null, points_balance: 980, total_bets: 22, total_wins: 10, rank: 5 },
];

const STUB_QUIZ = [
  {
    id: 'quiz0001-0000-0000-0000-000000000001',
    question_text: 'כמה שחקנים משחקים בכל קבוצה בכדורגל?',
    options: [{ key: 'a', label: '9' }, { key: 'b', label: '11' }, { key: 'c', label: '13' }],
    correct_option: 'b', category: 'general', points_reward: 50, is_active: true,
  },
  {
    id: 'quiz0002-0000-0000-0000-000000000002',
    question_text: 'באיזו שנה ישראל השתתפה לאחרונה במונדיאל?',
    options: [{ key: 'a', label: '1970' }, { key: 'b', label: '1982' }, { key: 'c', label: '1994' }],
    correct_option: 'a', category: 'general', points_reward: 50, is_active: true,
  },
];

const STUB_TRANSACTIONS = [
  { id: 'tx-001', user_id: STUB_USER.id, amount: 500, type: 'signup', description: 'נקודות פתיחה', created_at: new Date('2026-01-01') },
  { id: 'tx-002', user_id: STUB_USER.id, amount: -150, type: 'bet_placed', description: 'הימור על מכבי תל אביב', created_at: new Date(Date.now() - 4 * 3600 * 1000) },
  { id: 'tx-003', user_id: STUB_USER.id, amount: 315, type: 'bet_won', description: 'ניצחון: מכבי תל אביב', created_at: new Date(Date.now() - 3600 * 1000) },
  { id: 'tx-004', user_id: STUB_USER.id, amount: 50, type: 'quiz_won', description: 'תשובה נכונה בחידון', created_at: new Date(Date.now() - 30 * 60 * 1000) },
  { id: 'tx-005', user_id: STUB_USER.id, amount: -200, type: 'bet_placed', description: "הימור: מנצ'סטר סיטי", created_at: new Date(Date.now() - 10 * 60 * 1000) },
];

// ─── Query engine ─────────────────────────────────────────────────────────────

async function q(sql, params = []) {
  const s = sql.trim().toLowerCase();

  if (['begin', 'commit', 'rollback'].includes(s)) return { rows: [] };

  // Games
  if (s.includes('from games')) {
    if (params[0] && STUB_GAMES.find(g => g.id === params[0])) {
      return { rows: STUB_GAMES.filter(g => g.id === params[0]) };
    }
    if (s.includes("status = 'live'")) return { rows: STUB_GAMES.filter(g => g.status === 'live') };
    if (s.includes("status = 'finished'") && s.includes('interval')) return { rows: STUB_GAMES.filter(g => g.status === 'finished') };
    return { rows: STUB_GAMES };
  }

  // Bet questions
  if (s.includes('from bet_questions')) {
    if (s.includes('count(*)')) return { rows: [{ count: '0' }] };
    const gameId = params[0];
    if (gameId) return { rows: STUB_BET_QUESTIONS.filter(q => q.game_id === gameId) };
    const bqId = params[0];
    return { rows: STUB_BET_QUESTIONS.filter(q => q.id === bqId) };
  }

  // Users — SELECT
  if (s.includes('from users') && !s.startsWith('update') && !s.startsWith('insert')) {
    // Single-user lookups: return stub user regardless of the actual uid/id
    if (params.length === 1 && !s.includes('rank()')) return { rows: [STUB_USER] };
    if (s.includes('rank()')) return { rows: STUB_LEADERBOARD };
    return { rows: STUB_LEADERBOARD };
  }

  // Users — UPDATE
  if (s.startsWith('update users')) return { rows: [{ ...STUB_USER, points_balance: 1050 }] };

  // Users — INSERT
  if (s.startsWith('insert into users')) {
    return { rows: [{ ...STUB_USER, id: uuid(), username: params[1] || 'newuser' }] };
  }

  // Bets — SELECT
  if (s.includes('from bets') && !s.startsWith('insert') && !s.startsWith('update')) {
    return { rows: STUB_BETS };
  }

  // Bets — INSERT
  if (s.startsWith('insert into bets')) {
    return { rows: [{ id: uuid(), user_id: STUB_USER.id, stake: params[4] || 100, status: 'pending', placed_at: new Date() }] };
  }

  // Parlays — INSERT
  if (s.startsWith('insert into parlays')) {
    return { rows: [{ id: uuid(), user_id: STUB_USER.id, status: 'pending', placed_at: new Date() }] };
  }

  // Leagues
  if (s.includes('from leagues') && !s.startsWith('update') && !s.startsWith('insert')) {
    if (params[0]) return { rows: STUB_LEAGUES.filter(l => l.id === params[0] || l.invite_code === params[0]) };
    return { rows: STUB_LEAGUES };
  }
  if (s.startsWith('insert into leagues')) return { rows: [{ ...STUB_LEAGUES[0], id: uuid(), name: params[0] }] };
  if (s.startsWith('update leagues')) return { rows: [] };

  // League members
  if (s.includes('from league_members')) {
    if (s.includes('count(*)')) return { rows: [{ count: '4' }] };
    if (s.includes('join users')) {
      return { rows: STUB_LEADERBOARD.slice(0, 4).map((u, i) => ({ ...u, points_in_league: 400 - i * 60, joined_at: new Date(), is_active: true })) };
    }
    return { rows: [] }; // empty → allow join
  }
  if (s.startsWith('insert into league_members')) return { rows: [] };
  if (s.startsWith('update league_members')) return { rows: [] };

  // Leaderboard
  if (s.includes('rank() over')) return { rows: STUB_LEADERBOARD };

  // Quiz
  if (s.includes('from quiz_questions')) return { rows: [STUB_QUIZ[0]] };
  if (s.includes('from quiz_attempts')) return { rows: [] };
  if (s.startsWith('insert into quiz_attempts')) return { rows: [] };

  // Transactions
  if (s.includes('from point_transactions')) return { rows: STUB_TRANSACTIONS };
  if (s.startsWith('insert into point_transactions')) return { rows: [] };

  // Referrals
  if (s.includes('referral')) return { rows: [] };

  // Competitions
  if (s.includes('from competitions') || s.startsWith('insert into competitions')) return { rows: [{ id: 'comp-001' }] };

  // Aggregate queries (stats)
  if (s.includes('count(*)') || s.includes('coalesce(')) {
    return { rows: [{ total_bets: '18', wins: '12', losses: '6', total_won: '4200', total_lost: '900', total_users: '5', new_today: '1', new_this_month: '5' }] };
  }

  return { rows: [] };
}

const stubPool = {
  query: q,
  connect: async () => ({ query: q, release: () => {} }),
  on: () => {},
};

module.exports = { stubPool };
