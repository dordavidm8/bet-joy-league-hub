import React, { useState } from 'react';
import { ArrowRight, HelpCircle, Shield, ArrowLeftRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface Box2BoxGameProps {
  data: { team1: string; team2: string };
  solution: { secret: string };
  onSolve: (answer: string) => void;
}

const Box2BoxGame: React.FC<Box2BoxGameProps> = ({ data, solution, onSolve }) => {
  const [guess, setGuess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = () => { if (guess.trim()) onSolve(guess.trim()); };

  return (
    <div className="w-full flex flex-col pt-2 pb-32">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 pb-4">
        <button onClick={() => navigate(-1)} className="p-2 bg-card rounded-full shadow-sm"><ArrowRight size={20} /></button>
        <div className="text-center">
          <h1 className="font-black text-base text-primary">בוקס 2 בוקס</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">מצאו את השחקן המשותף</p>
        </div>
        <button className="p-2 bg-card rounded-full shadow-sm"><HelpCircle size={20} /></button>
      </header>

      {/* Teams */}
      <div className="px-4 mb-5">
        <div className="card-kickoff flex items-center justify-around gap-3 py-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500/20 to-blue-600/5 border border-blue-500/20 flex items-center justify-center">
              <Shield size={44} className="text-blue-400/60" />
            </div>
            <span className="font-black text-sm text-center max-w-[90px] leading-tight">{data.team1}</span>
          </motion.div>

          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ArrowLeftRight size={22} className="text-primary" />
            </div>
            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">מחבר</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-rose-500/20 to-rose-600/5 border border-rose-500/20 flex items-center justify-center">
              <Shield size={44} className="text-rose-400/60" />
            </div>
            <span className="font-black text-sm text-center max-w-[90px] leading-tight">{data.team2}</span>
          </motion.div>
        </div>

        <div className="mt-3 bg-primary/5 rounded-2xl p-3 border border-primary/10 text-center">
          <p className="text-xs text-primary font-medium">
            מי שיחק ב<strong>{data.team1}</strong> וגם ב<strong>{data.team2}</strong>?
          </p>
        </div>
      </div>

      {/* Input */}
      <div className="px-4">
        <input
          value={guess}
          onChange={e => setGuess(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="w-full bg-card rounded-2xl py-4 px-5 text-center shadow-sm border border-border focus:ring-2 focus:ring-primary outline-none text-base"
          placeholder="שם השחקן..."
          autoComplete="off"
        />
        <button
          onClick={handleSubmit}
          disabled={!guess.trim()}
          className="w-full mt-3 bg-primary disabled:opacity-40 text-primary-foreground font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all"
        >
          שלח ✓
        </button>
      </div>
    </div>
  );
};

export default Box2BoxGame;
