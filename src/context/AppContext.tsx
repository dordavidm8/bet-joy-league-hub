import React, { createContext, useContext, useState } from "react";
import { BetSlipItem, Game } from "@/lib/mockData";

interface AppState {
  userPoints: number;
  betSlip: BetSlipItem[];
  addToBetSlip: (item: Omit<BetSlipItem, "id">) => void;
  removeFromBetSlip: (id: string) => void;
  clearBetSlip: () => void;
  confirmBets: () => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userPoints, setUserPoints] = useState(5000);
  const [betSlip, setBetSlip] = useState<BetSlipItem[]>([]);

  const addToBetSlip = (item: Omit<BetSlipItem, "id">) => {
    setBetSlip((prev) => [...prev, { ...item, id: crypto.randomUUID() }]);
  };

  const removeFromBetSlip = (id: string) => {
    setBetSlip((prev) => prev.filter((b) => b.id !== id));
  };

  const clearBetSlip = () => setBetSlip([]);

  const confirmBets = () => {
    const totalPoints = betSlip.reduce((sum, b) => sum + b.points, 0);
    setUserPoints((prev) => prev - totalPoints);
    setBetSlip([]);
  };

  return (
    <AppContext.Provider value={{ userPoints, betSlip, addToBetSlip, removeFromBetSlip, clearBetSlip, confirmBets }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
};
