import React, { useState } from 'react';
import { ArrowLeft, HelpCircle, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface GuessClubGameProps {
  data: {
    logo_data: string;
  };
  onSolve: (guess: string) => void;
}

const GuessClubGame: React.FC<GuessClubGameProps> = ({ data, onSolve }) => {
  const [guess, setGuess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = () => {
    onSolve(guess);
  };

  const isImageVisible = data.logo_data.startsWith('data:image') || data.logo_data.startsWith('http');

  return (
    <div className="w-full h-full flex flex-col pt-4">
      <header className="flex items-center justify-between px-4 mb-4">
         <button onClick={() => navigate(-1)} className="p-2 bg-card rounded-full shadow-sm"><ArrowLeft size={20} /></button>
         <div className="text-center">
            <h1 className="font-bold text-lg text-primary leading-tight">נחשו את המועדון</h1>
            <p className="text-[10px] text-muted-foreground uppercase">זהו את הקבוצה לפי הסמל המטושטש</p>
         </div>
         <button className="p-2 bg-card rounded-full shadow-sm"><HelpCircle size={20} /></button>
      </header>

      <main className="px-4 pb-8 max-w-sm mx-auto w-full flex flex-col gap-8">
        {/* Blurred Logo Section */}
        <section className="mx-auto w-48 h-48 sm:w-64 sm:h-64 bg-card rounded-3xl shadow-soft border border-border flex items-center justify-center relative overflow-hidden group">
           {isImageVisible ? (
             <img 
               src={data.logo_data} 
               alt="Blurred Club Logo" 
               className="w-32 h-32 sm:w-44 sm:h-44 object-contain transition-all duration-700"
             />
           ) : (
             <div className="flex flex-col items-center gap-4 text-muted-foreground px-8 text-center">
                <ShieldAlert size={64} className="opacity-20" />
                <span className="text-xs font-medium">הסמל מנותח כעת...</span>
             </div>
           )}
           
           <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent pointer-events-none" />
        </section>

        {/* Info Card */}
         <section className="bg-card p-5 rounded-2xl shadow-sm border border-border text-center flex flex-col gap-2">
            <h3 className="font-bold text-sm">איזו קבוצה זאת?</h3>
            <p className="text-[11px] text-muted-foreground">הסמל עבר טשטוש כבד כדי להקשות עליכם. רמז: מדובר בקבוצה מאחת הליגות הבכירות באירופה.</p>
            <p className="text-[10px] text-primary/70 font-medium">✨ ניתן לענות באנגלית בלבד</p>
         </section>

        {/* Input Section */}
        <section className="flex flex-col gap-4 mt-2">
           <input 
             value={guess}
             onChange={e => setGuess(e.target.value)}
             className="w-full bg-card border-none rounded-full py-4 px-6 text-center focus:ring-2 focus:ring-primary text-foreground font-medium shadow-sm outline-none" 
             placeholder="שם המועדון..." 
           />
           <button 
             onClick={handleSubmit}
             className="w-full bg-gradient-to-tr from-primary to-primary/80 text-primary-foreground py-4 rounded-full font-bold text-lg shadow-lg active:scale-95 transition-transform"
           >
             שלח ניחוש
           </button>
        </section>
      </main>
    </div>
  );
};

export default GuessClubGame;
