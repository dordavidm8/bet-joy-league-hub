import React, { useState } from 'react';
import { ArrowLeft, HelpCircle, Shield, Plus, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Box2BoxGameProps {
  data: {
    team1: string;
    team2: string;
  };
  onSolve: (guess: string) => void;
}

const Box2BoxGame: React.FC<Box2BoxGameProps> = ({ data, onSolve }) => {
  const [guess, setGuess] = useState('');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      onSolve(guess);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="w-full h-full flex flex-col pt-4">
      <header className="flex items-center justify-between px-4 mb-4">
         <button onClick={() => navigate(-1)} className="p-2 bg-card rounded-full shadow-sm"><ArrowLeft size={20} /></button>
         <div className="text-center">
            <h1 className="font-bold text-lg text-primary leading-tight">בוקס2בוקס</h1>
            <p className="text-[10px] text-muted-foreground uppercase">מצאו שחקן ששיחק בשני המועדונים</p>
         </div>
         <div className="w-10 h-10" />
      </header>

      <main className="px-4 pb-8 max-w-sm mx-auto w-full flex flex-col gap-8">
        {/* Teams Comparison */}
        <section className="flex items-center justify-center gap-6 mt-8">
           <div className="flex flex-col items-center gap-3">
              <div className="w-24 h-24 bg-card rounded-2xl shadow-soft border border-border flex items-center justify-center">
                 <Shield size={48} className="text-primary/40" />
              </div>
              <span className="font-bold text-sm text-center">{data.team1}</span>
           </div>

           <div className="bg-primary/10 p-2 rounded-full shadow-inner animate-pulse">
              <Plus size={24} className="text-primary" />
           </div>

           <div className="flex flex-col items-center gap-3">
              <div className="w-24 h-24 bg-card rounded-2xl shadow-soft border border-border flex items-center justify-center">
                 <Shield size={48} className="text-primary/40" />
              </div>
              <span className="font-bold text-sm text-center">{data.team2}</span>
           </div>
        </section>

        {/* Info Card */}
        <section className="bg-primary/5 p-4 rounded-xl border border-primary/10 text-center flex flex-col gap-1">
           <p className="text-xs text-primary font-medium">מי השחקן שעבר בין {data.team1} לבין {data.team2}?</p>
           <p className="text-[10px] text-primary/60">✨ ניתן לענות באנגלית בלבד</p>
        </section>

        {/* Input Section */}
        <section className="flex flex-col gap-4 mt-2">
           <input 
             value={guess}
             onChange={e => setGuess(e.target.value)}
             className="w-full bg-card border-none rounded-full py-4 px-6 text-center focus:ring-2 focus:ring-primary text-foreground font-medium shadow-sm outline-none" 
             placeholder="שם השחקן..." 
           />
           <button 
             onClick={handleSubmit}
             disabled={loading}
             className="w-full bg-gradient-to-tr from-primary to-primary/80 text-primary-foreground py-4 rounded-full font-bold text-lg shadow-lg active:scale-95 transition-transform flex justify-center items-center gap-2 disabled:opacity-75 disabled:active:scale-100"
           >
             {loading ? <Loader2 size={24} className="animate-spin" /> : "אישור תשובה"}
           </button>
        </section>
      </main>
    </div>
  );
};

export default Box2BoxGame;
