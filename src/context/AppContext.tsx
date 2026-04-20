import React, { createContext, useContext, useState } from "react";

export type BetMode = 'global' | 'minimum_stake' | 'initial_balance';

export interface BetSlipItem {
  id: string;
  game_id: string;
  gameLabel: string;
  bet_question_id: string;
  question: string;
  selectedOption: string;
  odds: number;
  points: number;           // stake for this leg (0 for initial_balance)
  league_id: string | null; // null = global bet
  league_name: string | null;
  bet_mode: BetMode;
  exact_score_prediction?: string;
  start_time: string;
}

interface AppState {
  betSlip: BetSlipItem[];
  addToBetSlip: (item: Omit<BetSlipItem, "id">) => void;
  removeFromBetSlip: (id: string) => void;
  clearBetSlip: () => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [betSlip, setBetSlip] = useState<BetSlipItem[]>([]);

  const addToBetSlip = (item: Omit<BetSlipItem, "id">) => {
    // Replace existing item for the same (question, league) combination
    setBetSlip((prev) => {
      const filtered = prev.filter(
        (b) => !(b.bet_question_id === item.bet_question_id && b.league_id === item.league_id)
      );
      return [...filtered, { ...item, id: crypto.randomUUID() }];
    });
  };

  const removeFromBetSlip = (id: string) => setBetSlip((prev) => prev.filter((b) => b.id !== id));

  const clearBetSlip = () => setBetSlip([]);

  return (
    <AppContext.Provider value={{ betSlip, addToBetSlip, removeFromBetSlip, clearBetSlip }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
};
