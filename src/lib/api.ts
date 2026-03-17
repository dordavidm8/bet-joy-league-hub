import type { Game, BetQuestion, League, LeaderboardEntry } from "./mockData";

const API_BASE = "https://bet-joy-league-hub-production.up.railway.app";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

// Games
export const getGames = () => apiFetch<Game[]>("/api/games");
export const getGameById = (id: string) => apiFetch<Game>(`/api/games/${id}`);
export const getBetQuestions = (gameId: string) =>
  apiFetch<BetQuestion[]>(`/api/games/${gameId}/questions`);

// Bets
export const placeBet = (data: {
  gameId: string;
  questionId: string;
  optionId: string;
  points: number;
}) => apiFetch<{ success: boolean }>("/api/bets", { method: "POST", body: JSON.stringify(data) });

export const getActiveBets = () =>
  apiFetch<Array<{ id: string; game: Game; question: string; selectedOption: string; points: number; status: string }>>("/api/bets/active");

// Leagues
export const getLeagues = () => apiFetch<League[]>("/api/leagues");
export const createLeague = (data: { name: string; isPrivate: boolean; format: string; duration: string }) =>
  apiFetch<League>("/api/leagues", { method: "POST", body: JSON.stringify(data) });

// Leaderboard
export const getLeaderboard = () => apiFetch<LeaderboardEntry[]>("/api/leaderboard");

// Quiz
export const getQuizQuestions = () =>
  apiFetch<Array<{ id: string; question: string; options: string[]; correctIndex: number }>>("/api/quiz");

// User
export const getUserProfile = () =>
  apiFetch<{ points: number; wins: number; totalBets: number; successRate: number; rank: number }>("/api/users/profile");

export const getUserBetHistory = () =>
  apiFetch<Array<{ match: string; bet: string; result: string; points: string }>>("/api/users/history");

// Health
export const healthCheck = () => apiFetch<{ status: string }>("/health");
