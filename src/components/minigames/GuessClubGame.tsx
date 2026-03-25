import React, { useState } from 'react';
import { ArrowRight, HelpCircle, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface GuessClubGameProps {
  data: { logo_data: string };
  solution: { secret: string };
  onSolve: (answer: string) => void;
}

const GuessClubGame: React.FC<GuessClubGameProps> = ({ data, solution, onSolve }) => {
  const [guess, setGuess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = () => { if (guess.trim()) onSolve(guess.trim()); };
  const isBase64 = data.logo_data?.startsWith('data:image');

  return (
    <div className="w-full flex flex-col pt-2 pb-32">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 pb-4">
        <button onClick={() => navigate(-1)} className="p-2 bg-card rounded-full shadow-sm"><ArrowRight size={20} /></button>
        <div className="text-center">
          <h1 className="font-black text-base text-primary">נחש את המועדון</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">זהה את הקבוצה מהסמל</p>
        </div>
        <button className="p-2 bg-card rounded-full shadow-sm"><HelpCircle size={20} /></button>
      </header>

      {/* Blurred logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 18 }}
        className="mx-4 mb-3 aspect-square max-w-[240px] self-center rounded-3xl overflow-hidden bg-gradient-to-br from-card to-secondary shadow-2xl border border-border flex items-center justify-center relative"
      >
        {isBase64 ? (
          <img
            src={data.logo_data}
            alt="Blurred club logo"
            className="w-3/4 h-3/4 object-contain"
            style={{ filter: 'blur(14px) brightness(0.9)' }}
          />
        ) : (
          <ShieldAlert size={80} className="text-muted-foreground/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/30 to-transparent pointer-events-none" />
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full border border-white/10">
          מה שם הקבוצה?
        </div>
      </motion.div>

      {/* Hint card */}
      <div className="mx-4 mb-5 card-kickoff text-center text-xs text-muted-foreground">
        הסמל עבר עיבוד כבד – זהו את הקבוצה מאחת הליגות הבכירות באירופה
      </div>

      {/* Input */}
      <div className="px-4">
        <input
          value={guess}
          onChange={e => setGuess(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="w-full bg-card rounded-2xl py-4 px-5 text-center shadow-sm border border-border focus:ring-2 focus:ring-primary outline-none text-base"
          placeholder="שם המועדון..."
          autoComplete="off"
        />
        <button
          onClick={handleSubmit}
          disabled={!guess.trim()}
          className="w-full mt-3 bg-primary disabled:opacity-40 text-primary-foreground font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all"
        >
          שלח ניחוש ✓
        </button>
      </div>
    </div>
  );
};

export default GuessClubGame;
