import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

const BetSlipPage = () => {
  const { betSlip, removeFromBetSlip, confirmBets, userPoints } = useApp();
  const [isParlay, setIsParlay] = useState(false);

  const totalPoints = betSlip.reduce((sum, b) => sum + b.points, 0);
  const multiplier = isParlay ? betSlip.length * 1.5 : 2;
  const potentialWinnings = Math.round(totalPoints * multiplier);

  if (betSlip.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 pt-20 px-5 pb-24">
        <span className="text-5xl">📋</span>
        <h2 className="text-xl font-black">התלוש ריק</h2>
        <p className="text-muted-foreground text-sm text-center">הוסיפו הימורים ממשחקים כדי להתחיל</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-4 pb-24">
      <h2 className="text-2xl font-black">תלוש הימורים</h2>

      {/* Parlay Toggle */}
      <div className="card-kickoff flex items-center justify-between">
        <div>
          <p className="font-bold text-sm">שילוב הימורים (פרליי)</p>
          <p className="text-xs text-muted-foreground">שלב הימורים לכפולה גבוהה יותר</p>
        </div>
        <button
          onClick={() => setIsParlay(!isParlay)}
          className={`w-12 h-7 rounded-full transition-colors duration-200 relative ${
            isParlay ? "bg-primary" : "bg-border"
          }`}
        >
          <span
            className={`absolute top-0.5 w-6 h-6 bg-card rounded-full shadow-sm transition-transform duration-200 ${
              isParlay ? "left-0.5" : "left-[calc(100%-1.625rem)]"
            }`}
          />
        </button>
      </div>

      {/* Bet Items */}
      <div className="flex flex-col gap-3">
        {betSlip.map((bet, i) => (
          <motion.div
            key={bet.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card-kickoff flex items-start justify-between gap-3"
          >
            <div className="flex flex-col gap-1 flex-1">
              <p className="font-bold text-sm">
                {bet.game.homeTeam.name} נגד {bet.game.awayTeam.name}
              </p>
              <p className="text-xs text-muted-foreground">{bet.question}</p>
              <p className="text-sm font-bold text-primary">{bet.selectedOption}</p>
              <p className="text-xs text-muted-foreground">{bet.points} נקודות</p>
            </div>
            <button
              onClick={() => removeFromBetSlip(bet.id)}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </motion.div>
        ))}
      </div>

      {/* Summary */}
      <div className="card-kickoff flex flex-col gap-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">סה״כ נקודות בסיכון</span>
          <span className="font-bold">{totalPoints.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">כפולה</span>
          <span className="font-bold">x{multiplier}</span>
        </div>
        <div className="border-t border-border my-1" />
        <div className="flex justify-between text-base">
          <span className="font-bold">רווח פוטנציאלי</span>
          <span className="font-black text-primary">{potentialWinnings.toLocaleString()} נקודות</span>
        </div>
      </div>

      {/* Confirm */}
      <Button
        variant="cta"
        size="xl"
        className="w-full"
        onClick={confirmBets}
        disabled={totalPoints > userPoints}
      >
        אשר הימור
      </Button>

      {totalPoints > userPoints && (
        <p className="text-xs text-destructive text-center">אין מספיק נקודות</p>
      )}
    </div>
  );
};

export default BetSlipPage;
