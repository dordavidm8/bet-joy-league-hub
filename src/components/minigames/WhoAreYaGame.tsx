import React, { useState } from 'react';
import { ArrowLeft, HelpCircle, Flag, Shield, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface WhoAreYaGameProps {
  data: {
    image_url?: string;
    nationality: string;
    club: string;
    position: string;
    age: number;
    league?: string;
  };
  onSolve: (guess: string) => void;
}


const WhoAreYaGame: React.FC<WhoAreYaGameProps> = ({ data, onSolve }) => {
  const [guess, setGuess] = useState('');
  const [imgError, setImgError] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = () => {
    onSolve(guess);
  };


  const hasImage = data.image_url && !imgError;

  return (
    <div className="w-full h-full flex flex-col pt-4">
      <header className="flex items-center justify-between px-4 mb-4">
         <button onClick={() => navigate(-1)} className="p-2 bg-card rounded-full shadow-sm"><ArrowLeft size={20} /></button>
         <div className="text-center">
            <h1 className="font-bold text-lg text-primary leading-tight">מי אתה?</h1>
            <p className="text-[10px] text-muted-foreground uppercase">זהו את השחקן</p>
         </div>
         <div className="w-10 h-10" />
      </header>

      <main className="px-4 pb-8 max-w-sm mx-auto w-full flex flex-col gap-6">
        {/* Player Portrait */}
        <section className="relative mx-auto w-48 h-48 sm:w-64 sm:h-64 rounded-2xl overflow-hidden shadow-soft bg-card border border-border flex items-center justify-center">
          {hasImage ? (
            <img
              src={data.image_url}
              alt="Who is this player?"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
              style={{ filter: 'blur(12px)', transform: 'scale(1.1)' }}
            />
          ) : (
            <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
              <User size={80} className="text-primary/30 blur-sm" />
            </div>
          )}
           
           <div className="absolute bottom-4 right-4 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-border">
             <span className="text-xs font-bold text-foreground">מי זה?</span>
           </div>
        </section>

        {/* Clues Section: Bento Layout */}
        <section className="grid grid-cols-3 gap-3">
          <div className="bg-card p-4 rounded-xl shadow-sm border border-border flex flex-col items-center justify-center gap-2 text-center">
            <Flag className="text-primary" size={24} />
            <span className="text-[10px] text-muted-foreground font-medium">לאום</span>
            <span className="text-xs font-bold">{data.nationality || '?'}</span>
          </div>
          <div className="bg-card p-4 rounded-xl shadow-sm border border-border flex flex-col items-center justify-center gap-2 text-center">
            <Shield className="text-primary" size={24} />
            <span className="text-[10px] text-muted-foreground font-medium">מועדון</span>
            <span className="text-xs font-bold">{data.club || '?'}</span>
          </div>
          <div className="bg-card p-4 rounded-xl shadow-sm border border-border flex flex-col items-center justify-center gap-2 text-center">
            <User className="text-primary" size={24} />
            <span className="text-[10px] text-muted-foreground font-medium">תפקיד</span>
            <span className="text-xs font-bold">{data.position || '?'}</span>
          </div>
        </section>

        {/* Input Section */}
        <section className="flex flex-col gap-4 mt-4">
           <div className="relative">
               <input 
                 value={guess}
                 onChange={e => setGuess(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                 className="w-full bg-card border-none rounded-full py-4 px-6 text-center focus:ring-2 focus:ring-primary text-foreground font-medium shadow-sm outline-none" 
                 placeholder="הקלד את השם כאן..." 
               />
               <p className="text-[10px] text-center mt-2 text-primary/70 font-medium">✨ ניתן לענות באנגלית בלבד</p>
            </div>
           <button 
             onClick={handleSubmit}
             className="w-full bg-gradient-to-tr from-primary to-primary/80 text-primary-foreground py-4 rounded-full font-bold text-lg shadow-lg active:scale-95 transition-transform"
           >
             בדוק מי זה
           </button>
        </section>
      </main>
    </div>
  );
};

export default WhoAreYaGame;
