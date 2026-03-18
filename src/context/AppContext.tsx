import React, { createContext, useContext, useState } from "react";

export interface BetSlipItem {
  id: string;
  game_id: string;
  gameLabel: string;        // "מנצ'סטר סיטי נגד ארסנל"
  bet_question_id: string;
  question: string;
  selectedOption: string;
  odds: number;
  points: number;           // stake for this leg
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
    // Replace existing selection for the same question
    setBetSlip((prev) => {
      const filtered = prev.filter((b) => b.bet_question_id !== item.bet_question_id);
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
