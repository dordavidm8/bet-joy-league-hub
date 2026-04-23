// useApi.ts – hook לקריאות API עם state management
// מנהל loading, error, data לכל קריאת API.
// שימוש: const { data, loading, error } = useApi(fetchFunction).
import { useQuery, useMutation } from "@tanstack/react-query";
import * as api from "@/lib/api";
import {
  mockGames,
  mockBetQuestions,
  mockLeagues,
  mockLeaderboard,
  mockQuizQuestions,
} from "@/lib/mockData";

export const useGames = () =>
  useQuery({
    queryKey: ["games"],
    queryFn: async () => {
      const res = await api.getGames();
      return res.games;
    },
    placeholderData: mockGames as any,
    retry: 1,
  });

export const useGame = (id: string) =>
  useQuery({
    queryKey: ["game", id],
    queryFn: async () => {
      const res = await api.getGame(id);
      return res.game;
    },
    placeholderData: mockGames.find((g) => g.id === id) as any,
    enabled: !!id,
    retry: 1,
  });

export const useBetQuestions = (gameId: string) =>
  useQuery({
    queryKey: ["betQuestions", gameId],
    queryFn: async () => {
      const res = await api.getGame(gameId);
      return res.bet_questions;
    },
    placeholderData: (mockBetQuestions as any)[gameId] || [],
    enabled: !!gameId,
    retry: 1,
  });

export const useActiveBets = () =>
  useQuery({
    queryKey: ["activeBets"],
    queryFn: async () => {
      const res = await api.getMyBets({ status: 'pending' });
      return res.bets;
    },
    retry: 1,
  });

export const useLeagues = () =>
  useQuery({
    queryKey: ["leagues"],
    queryFn: async () => {
      const res = await api.getPublicLeagues();
      return res.leagues;
    },
    placeholderData: mockLeagues as any,
    retry: 1,
  });

export const useLeaderboard = () =>
  useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const res = await api.getLeaderboard();
      return res.leaderboard;
    },
    placeholderData: mockLeaderboard as any,
    retry: 1,
  });

export const useQuizQuestions = () =>
  useQuery({
    queryKey: ["quiz"],
    queryFn: async () => {
      const res = await api.getNextQuestion();
      return res.question;
    },
    placeholderData: mockQuizQuestions[0] as any,
    retry: 1,
  });

export const useUserProfile = () =>
  useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await api.getMe();
      return res.user;
    },
    retry: 1,
  });

export const useUserBetHistory = () =>
  useQuery({
    queryKey: ["userBetHistory"],
    queryFn: async () => {
      const res = await api.getMyBets();
      return res.bets;
    },
    retry: 1,
  });

export const usePlaceBet = () =>
  useMutation({
    mutationFn: api.placeBet,
  });

export const useCreateLeague = () =>
  useMutation({
    mutationFn: api.createLeague,
  });
