import React, { useState } from 'react';
import { ArrowRight, HelpCircle, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface CareerPathGameProps {
  data: {
    transfers: Array<{
      club: string;
      season: string;
      appearances: number;
      goals: number;
    }>;
  };
  solution: { secret: string };
  onSolve: (answer: string) => void;
}

const CareerPathGame: React.FC<CareerPathGameProps> = ({ data, solution, onSolve }) => {
  const [guess, setGuess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = () => { if (guess.trim()) onSolve(guess.trim()); };

  return (
    <div className="w-full flex flex-col pt-2 pb-32">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 pb-4">
        <button onClick={() => navigate(-1)} className="p-2 bg-card rounded-full shadow-sm"><ArrowRight size={20} /></button>
        <div className="text-center">
          <h1 className="font-black text-base text-primary">נתיב הקריירה</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">זהו את השחקן לפי התחנות</p>
        </div>
        <button className="p-2 bg-card rounded-full shadow-sm"><HelpCircle size={20} /></button>
      </header>

      {/* ? Player header */}
      <div className="mx-4 mb-4 card-kickoff flex items-center gap-3 bg-primary/5 border-primary/20">
        <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
          <span className="font-black text-primary text-xl">?</span>
        </div>
        <div>
          <p className="font-black text-foreground">מי השחקן המסתורי?</p>
          <p className="text-muted-foreground text-xs">{data.transfers.length} תחנות קריירה • זהו אותו</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="px-4 mb-5 card-kickoff flex flex-col gap-0 overflow-hidden p-0">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-2.5 bg-secondary/60 border-b border-border">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">מועדון</span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase text-center">עונה</span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase text-center">הופ׳</span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase text-center">שע׳</span>
        </div>
        {data.transfers.map((t, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-3 border-b last:border-b-0 border-border items-center"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Trophy size={13} className="text-primary/60" />
              </div>
              <span className="text-sm font-bold truncate">{t.club}</span>
            </div>
            <span className="text-[11px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full text-center whitespace-nowrap">{t.season}</span>
            <span className="text-[11px] font-bold text-center">{t.appearances}</span>
            <span className={`text-[11px] font-bold text-center ${t.goals > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
              {t.goals > 0 ? t.goals : '—'}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Input */}
      <div className="px-4">
        <input
          value={guess}
          onChange={e => setGuess(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="w-full bg-card rounded-2xl py-4 px-5 text-center shadow-sm border border-border focus:ring-2 focus:ring-primary outline-none text-base"
          placeholder="מי השחקן?"
          autoComplete="off"
        />
        <button
          onClick={handleSubmit}
          disabled={!guess.trim()}
          className="w-full mt-3 bg-primary disabled:opacity-40 text-primary-foreground font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all"
        >
          אישור תשובה ✓
        </button>
      </div>
    </div>
  );
};

export default CareerPathGame;
