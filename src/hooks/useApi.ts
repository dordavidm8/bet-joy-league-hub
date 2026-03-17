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
    queryFn: api.getGames,
    placeholderData: mockGames,
    retry: 1,
  });

export const useGame = (id: string) =>
  useQuery({
    queryKey: ["game", id],
    queryFn: () => api.getGameById(id),
    placeholderData: mockGames.find((g) => g.id === id),
    enabled: !!id,
    retry: 1,
  });

export const useBetQuestions = (gameId: string) =>
  useQuery({
    queryKey: ["betQuestions", gameId],
    queryFn: () => api.getBetQuestions(gameId),
    placeholderData: mockBetQuestions[gameId] || [],
    enabled: !!gameId,
    retry: 1,
  });

export const useActiveBets = () =>
  useQuery({
    queryKey: ["activeBets"],
    queryFn: api.getActiveBets,
    retry: 1,
  });

export const useLeagues = () =>
  useQuery({
    queryKey: ["leagues"],
    queryFn: api.getLeagues,
    placeholderData: mockLeagues,
    retry: 1,
  });

export const useLeaderboard = () =>
  useQuery({
    queryKey: ["leaderboard"],
    queryFn: api.getLeaderboard,
    placeholderData: mockLeaderboard,
    retry: 1,
  });

export const useQuizQuestions = () =>
  useQuery({
    queryKey: ["quiz"],
    queryFn: api.getQuizQuestions,
    placeholderData: mockQuizQuestions,
    retry: 1,
  });

export const useUserProfile = () =>
  useQuery({
    queryKey: ["userProfile"],
    queryFn: api.getUserProfile,
    retry: 1,
  });

export const useUserBetHistory = () =>
  useQuery({
    queryKey: ["userBetHistory"],
    queryFn: api.getUserBetHistory,
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
