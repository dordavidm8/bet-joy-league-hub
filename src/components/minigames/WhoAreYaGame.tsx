import React, { useState } from 'react';
import { ArrowRight, HelpCircle, Flag, Shield, User, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface WhoAreYaGameProps {
  data: {
    nationality: string;
    club: string;
    position: string;
    age: number;
    league?: string;
  };
  solution: { secret: string };
  onSolve: (answer: string) => void;
}

const WhoAreYaGame: React.FC<WhoAreYaGameProps> = ({ data, solution, onSolve }) => {
  const [guess, setGuess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = () => { if (guess.trim()) onSolve(guess.trim()); };

  const clues = [
    { label: 'לאום',    value: data.nationality, icon: Flag    },
    { label: 'מועדון',  value: data.club,         icon: Shield  },
    { label: 'תפקיד',   value: data.position,     icon: User    },
    { label: 'גיל',     value: String(data.age),  icon: Clock   },
  ];

  return (
    <div className="w-full flex flex-col pt-2 pb-32">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 pb-4">
        <button onClick={() => navigate(-1)} className="p-2 bg-card rounded-full shadow-sm"><ArrowRight size={20} /></button>
        <div className="text-center">
          <h1 className="font-black text-base text-primary">מי אתה?</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">זהו את השחקן מהרמזים</p>
        </div>
        <button className="p-2 bg-card rounded-full shadow-sm"><HelpCircle size={20} /></button>
      </header>

      {/* Player silhouette */}
      <div className="mx-4 mb-5 relative group">
        <div className="rounded-3xl overflow-hidden bg-gradient-to-b from-card to-secondary/60 flex items-center justify-center" style={{ height: 200 }}>
          <User size={96} className="text-muted-foreground/20 blur-[3px]" />
          <div className="absolute inset-0 flex items-end p-4">
            <div className="w-full bg-black/50 backdrop-blur-md rounded-2xl px-4 py-2 flex items-center justify-between border border-white/10">
              <span className="text-white font-black text-sm">???</span>
              <span className="text-white/60 text-[10px]">זהו את השחקן</span>
            </div>
          </div>
        </div>
      </div>

      {/* Clue bento grid */}
      <div className="px-4 mb-5 grid grid-cols-2 gap-3">
        {clues.map((clue, i) => {
          const Icon = clue.icon;
          return (
            <motion.div
              key={clue.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="card-kickoff flex flex-col items-center gap-2 p-4 text-center"
            >
              <Icon className="text-primary" size={22} />
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{clue.label}</span>
              <span className="text-sm font-black leading-tight">{clue.value || '—'}</span>
            </motion.div>
          );
        })}
      </div>

      {/* Input */}
      <div className="px-4">
        <input
          value={guess}
          onChange={e => setGuess(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="w-full bg-card rounded-2xl py-4 px-5 text-center shadow-sm border border-border focus:ring-2 focus:ring-primary outline-none text-base"
          placeholder="הקלד את שם השחקן..."
          autoComplete="off"
        />
        <button
          onClick={handleSubmit}
          disabled={!guess.trim()}
          className="w-full mt-3 bg-primary disabled:opacity-40 text-primary-foreground font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all"
        >
          בדוק מי זה ✓
        </button>
      </div>
    </div>
  );
};

export default WhoAreYaGame;
