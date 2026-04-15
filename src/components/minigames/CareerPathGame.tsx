import React, { useState } from 'react';
import { ArrowLeft, HelpCircle, History, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CareerPathGameProps {
  data: {
    transfers: Array<{
      club: string;
      clubLogo?: string;
      season: string;
      appearances: number;
      goals: number;
    }>;
  };
  onSolve: (guess: string) => void;
}

const CareerPathGame: React.FC<CareerPathGameProps> = ({ data, onSolve }) => {
  const [guess, setGuess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = () => {
    onSolve(guess);
  };

  return (
    <div className="w-full h-full flex flex-col pt-4">
      <header className="flex items-center justify-between px-4 mb-4">
         <button onClick={() => navigate(-1)} className="p-2 bg-card rounded-full shadow-sm"><ArrowLeft size={20} /></button>
         <div className="text-center">
            <h1 className="font-bold text-lg text-primary leading-tight">נתיב הקריירה</h1>
            <p className="text-[10px] text-muted-foreground uppercase">זהו את השחקן לפי התחנות</p>
         </div>
         <button className="p-2 bg-card rounded-full shadow-sm"><HelpCircle size={20} /></button>
      </header>

      <main className="px-4 pb-8 max-w-sm mx-auto w-full flex flex-col gap-6">
        {/* Timeline Section */}
        <section className="bg-card rounded-2xl p-6 shadow-soft border border-border flex flex-col gap-4">
           {data.transfers.map((t, i) => (
             <div key={i} className="flex items-start gap-4 relative">
                {i < data.transfers.length - 1 && (
                  <div className="absolute left-[11px] top-6 bottom-[-10px] w-0.5 bg-primary/10" />
                )}
                <div className="z-10 bg-primary/20 p-1.5 rounded-full mt-1">
                   <div className="w-2 h-2 bg-primary rounded-full" />
                </div>
                <div className="flex flex-col flex-1 pb-4">
                   <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {t.clubLogo && <img src={t.clubLogo} alt={t.club} className="w-5 h-5 object-contain opacity-80" onError={(e) => (e.currentTarget.style.display = 'none')} />}
                        <span className="font-bold text-sm text-foreground">{t.club}</span>
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{t.season}</span>
                   </div>
                   <div className="flex gap-4 mt-1">
                      <div className="flex items-center gap-1">
                         <History size={12} className="text-muted-foreground" />
                         <span className="text-[10px] text-muted-foreground">{t.appearances} הופעות</span>
                      </div>
                      {t.goals > 0 && (
                        <div className="flex items-center gap-1">
                           <Trophy size={12} className="text-primary" />
                           <span className="text-[10px] text-muted-foreground">{t.goals} שערים</span>
                        </div>
                      )}
                   </div>
                </div>
             </div>
           ))}
        </section>

        {/* Input Section */}
        <section className="flex flex-col gap-4 mt-2">
           <input 
             value={guess}
             onChange={e => setGuess(e.target.value)}
             className="w-full bg-card border-none rounded-full py-4 px-6 text-center focus:ring-2 focus:ring-primary text-foreground font-medium shadow-sm outline-none" 
             placeholder="מי השחקן?" 
           />
           <button 
             onClick={handleSubmit}
             className="w-full bg-gradient-to-tr from-primary to-primary/80 text-primary-foreground py-4 rounded-full font-bold text-lg shadow-lg active:scale-95 transition-transform"
           >
             אישור תשובה
           </button>
        </section>
      </main>
    </div>
  );
};

export default CareerPathGame;
