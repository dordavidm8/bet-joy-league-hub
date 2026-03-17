export interface Team {
  id: string;
  name: string;
  logo: string;
}

export interface Game {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  date: string;
  time: string;
  competition: string;
  isLive: boolean;
  score?: { home: number; away: number };
}

export interface BetQuestion {
  id: string;
  gameId: string;
  question: string;
  options: { id: string; label: string }[];
}

export interface BetSlipItem {
  id: string;
  game: Game;
  question: string;
  selectedOption: string;
  points: number;
}

export interface League {
  id: string;
  name: string;
  memberCount: number;
  rank: number;
  points: number;
  isPrivate: boolean;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatar: string;
  points: number;
  rank: number;
  isCurrentUser?: boolean;
}

export const mockTeams: Team[] = [
  { id: "1", name: "מכבי תל אביב", logo: "⚽" },
  { id: "2", name: "הפועל באר שבע", logo: "⚽" },
  { id: "3", name: "מכבי חיפה", logo: "⚽" },
  { id: "4", name: "הפועל תל אביב", logo: "⚽" },
  { id: "5", name: "בית״ר ירושלים", logo: "⚽" },
  { id: "6", name: "בני סכנין", logo: "⚽" },
];

export const mockGames: Game[] = [
  {
    id: "g1",
    homeTeam: mockTeams[0],
    awayTeam: mockTeams[1],
    date: "2026-03-17",
    time: "20:00",
    competition: "ליגת העל",
    isLive: true,
    score: { home: 1, away: 0 },
  },
  {
    id: "g2",
    homeTeam: mockTeams[2],
    awayTeam: mockTeams[3],
    date: "2026-03-17",
    time: "21:00",
    competition: "ליגת העל",
    isLive: false,
  },
  {
    id: "g3",
    homeTeam: mockTeams[4],
    awayTeam: mockTeams[5],
    date: "2026-03-18",
    time: "19:30",
    competition: "גביע המדינה",
    isLive: false,
  },
];

export const mockBetQuestions: Record<string, BetQuestion[]> = {
  g1: [
    {
      id: "q1",
      gameId: "g1",
      question: "מי ינצח?",
      options: [
        { id: "o1", label: "מכבי תל אביב" },
        { id: "o2", label: "תיקו" },
        { id: "o3", label: "הפועל באר שבע" },
      ],
    },
    {
      id: "q2",
      gameId: "g1",
      question: "כמה שערים יהיו במשחק?",
      options: [
        { id: "o4", label: "0-1" },
        { id: "o5", label: "2-3" },
        { id: "o6", label: "4+" },
      ],
    },
    {
      id: "q3",
      gameId: "g1",
      question: "מי יכבוש ראשון?",
      options: [
        { id: "o7", label: "דור פרץ" },
        { id: "o8", label: "ערן זהבי" },
        { id: "o9", label: "שלומי אזולאי" },
        { id: "o10", label: "אחר" },
      ],
    },
  ],
  g2: [
    {
      id: "q4",
      gameId: "g2",
      question: "מי ינצח?",
      options: [
        { id: "o11", label: "מכבי חיפה" },
        { id: "o12", label: "תיקו" },
        { id: "o13", label: "הפועל תל אביב" },
      ],
    },
  ],
  g3: [
    {
      id: "q5",
      gameId: "g3",
      question: "מי ינצח?",
      options: [
        { id: "o14", label: "בית״ר ירושלים" },
        { id: "o15", label: "תיקו" },
        { id: "o16", label: "בני סכנין" },
      ],
    },
  ],
};

export const mockLeagues: League[] = [
  { id: "l1", name: "חברים מהצבא", memberCount: 12, rank: 3, points: 2450, isPrivate: true },
  { id: "l2", name: "ליגת המשרד", memberCount: 24, rank: 7, points: 1890, isPrivate: false },
  { id: "l3", name: "משפחת כהן", memberCount: 8, rank: 1, points: 3200, isPrivate: true },
];

export const mockLeaderboard: LeaderboardEntry[] = [
  { id: "u1", name: "יוסי כהן", avatar: "👤", points: 4520, rank: 1 },
  { id: "u2", name: "דנה לוי", avatar: "👤", points: 4210, rank: 2 },
  { id: "u3", name: "אורי שמש", avatar: "👤", points: 3890, rank: 3 },
  { id: "u4", name: "אתה", avatar: "👤", points: 3200, rank: 4, isCurrentUser: true },
  { id: "u5", name: "מיכל ברק", avatar: "👤", points: 2900, rank: 5 },
  { id: "u6", name: "עמית דוד", avatar: "👤", points: 2650, rank: 6 },
  { id: "u7", name: "נועה גולן", avatar: "👤", points: 2400, rank: 7 },
  { id: "u8", name: "רון אביב", avatar: "👤", points: 2100, rank: 8 },
];

export const mockQuizQuestions = [
  {
    id: "quiz1",
    question: "מי כבש הכי הרבה שערים בליגת העל עונת 2025/26?",
    options: ["ערן זהבי", "דור פרץ", "מוחמד אבו פאני", "עומר אצילי"],
    correctIndex: 1,
  },
  {
    id: "quiz2",
    question: "כמה פעמים מכבי חיפה זכתה באליפות?",
    options: ["10", "12", "14", "8"],
    correctIndex: 2,
  },
  {
    id: "quiz3",
    question: "באיזו שנה הפועל תל אביב זכתה באליפות לאחרונה?",
    options: ["2010", "2013", "2018", "2020"],
    correctIndex: 1,
  },
];
