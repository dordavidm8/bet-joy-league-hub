import React, { useState } from 'react';
import { ArrowRight, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface MissingXIGameProps {
  data: {
    teamName: string;
    formation: string;
    players: { name: string; shirt: string }[];
    hidden_idx: number;
  };
  solution: { secret: string };
  onSolve: (answer: string) => void;
}

const MissingXIGame: React.FC<MissingXIGameProps> = ({ data, solution, onSolve }) => {
  const [guess, setGuess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = () => { if (guess.trim()) onSolve(guess.trim()); };

  // Split players into rows by position
  const gk  = data.players.slice(0, 1);
  const def = data.players.slice(1, 5);
  const mid = data.players.slice(5, 8);
  const fwd = data.players.slice(8, 11);

  const renderPlayer = (p: any, absIdx: number) => {
    const isHidden = absIdx === data.hidden_idx;
    return (
      <motion.div
        key={absIdx}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: absIdx * 0.04 }}
        className="flex flex-col items-center gap-1 z-10"
      >
        {isHidden ? (
          <div className="w-11 h-11 md:w-13 md:h-13 rounded-full bg-primary shadow-lg shadow-primary/40 flex items-center justify-center text-primary-foreground font-black text-lg ring-4 ring-white/20 animate-pulse">
            ?
          </div>
        ) : (
          <div className="w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center text-primary font-bold text-xs border border-primary/20">
            {p.shirt}
          </div>
        )}
        <span className="text-[9px] text-white font-semibold bg-black/60 px-1.5 py-0.5 rounded-full whitespace-nowrap max-w-[60px] truncate text-center">
          {isHidden ? '???' : p.name}
        </span>
      </motion.div>
    );
  };

  return (
    <div className="w-full flex flex-col pt-2">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 pb-3">
        <button onClick={() => navigate(-1)} className="p-2 bg-card rounded-full shadow-sm">
          <ArrowRight size={20} />
        </button>
        <div className="text-center">
          <h1 className="font-black text-base text-primary">{data.teamName}</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">ההרכב החסר • {data.formation}</p>
        </div>
        <button className="p-2 bg-card rounded-full shadow-sm"><HelpCircle size={20} /></button>
      </header>

      {/* Pitch */}
      <div className="relative mx-4 rounded-3xl overflow-hidden shadow-2xl mb-5"
        style={{ background: 'linear-gradient(180deg,#2d8c3e 0%,#1e6b2e 100%)', aspectRatio: '3/4' }}
      >
        {/* Pitch markings */}
        <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" viewBox="0 0 300 400">
          <rect x="10" y="10" width="280" height="380" rx="4" fill="none" stroke="white" strokeWidth="2" />
          <line x1="10" y1="200" x2="290" y2="200" stroke="white" strokeWidth="1.5" />
          <circle cx="150" cy="200" r="35" fill="none" stroke="white" strokeWidth="1.5" />
          <rect x="85" y="10" width="130" height="60" fill="none" stroke="white" strokeWidth="1.5" />
          <rect x="85" y="330" width="130" height="60" fill="none" stroke="white" strokeWidth="1.5" />
        </svg>

        {/* Players */}
        <div className="absolute inset-0 flex flex-col justify-between py-5 px-3 items-center">
          <div className="flex justify-around w-full">{fwd.map((p, i) => renderPlayer(p, 8 + i))}</div>
          <div className="flex justify-around w-4/5">{mid.map((p, i) => renderPlayer(p, 5 + i))}</div>
          <div className="flex justify-around w-full">{def.map((p, i) => renderPlayer(p, 1 + i))}</div>
          <div className="flex justify-center">{gk.map((p, i) => renderPlayer(p, i))}</div>
        </div>
      </div>

      {/* Input */}
      <div className="px-4 pb-8">
        <input
          value={guess}
          onChange={e => setGuess(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="w-full bg-card rounded-2xl py-4 px-5 text-center shadow-sm border border-border focus:ring-2 focus:ring-primary outline-none text-base"
          placeholder="מי השחקן החסר?"
          autoComplete="off"
        />
        <button
          onClick={handleSubmit}
          disabled={!guess.trim()}
          className="w-full mt-3 bg-primary disabled:opacity-40 text-primary-foreground font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all"
        >
          בדוק תשובה ✓
        </button>
      </div>
    </div>
  );
};

export default MissingXIGame;
