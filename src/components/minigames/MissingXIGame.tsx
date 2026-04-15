import React, { useState } from 'react';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MissingXIGameProps {
  data: {
    teamName: string;
    teamLogo?: string;
    matchContext?: string;
    formation: string;
    players: { name: string; shirt: string }[];
    hidden_idx: number;
  };
  onSolve: (guess: string) => void;
}


const MissingXIGame: React.FC<MissingXIGameProps> = ({ data, onSolve }) => {
  const [guess, setGuess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = () => {
    onSolve(guess);
  };


  // Group players by formation (e.g. 4-3-3: 1 GK, 4 DEF, 3 MID, 3 FWD)
  // For simplicity since FBref lineup array might not match strictly, we just render them vertically if format is complex.
  const gk = data.players.slice(0, 1);
  const others = data.players.slice(1);
  // Just slice naively for visual
  const def = others.slice(0, 4);
  const mid = others.slice(4, 7);
  const fwd = others.slice(7);

  const renderPlayer = (p: any, i: number, baseIdx: number) => {
    const isHidden = (baseIdx + i) === data.hidden_idx;
    return (
      <div key={i} className="flex flex-col items-center gap-1 z-10 m-1">
        {isHidden ? (
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary shadow-2xl flex items-center justify-center text-primary-foreground font-bold animate-pulse ring-4 ring-white/30 text-lg">?</div>
        ) : (
           <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-primary font-bold text-xs border border-primary/20">{p.shirt}</div>
        )}
        <span className="text-[9px] md:text-[10px] text-white font-medium bg-black/60 px-1.5 py-0.5 rounded-full whitespace-nowrap overflow-hidden text-ellipsis max-w-[60px]">
          {isHidden ? '???' : p.name}
        </span>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col pt-4">
      <header className="flex items-center justify-between px-4 mb-4">
         <button onClick={() => navigate(-1)} className="p-2 bg-card rounded-full shadow-sm"><ArrowLeft size={20} /></button>
          <div className="flex items-center gap-3">
             {data.teamLogo && <img src={data.teamLogo} alt={data.teamName} className="w-10 h-10 object-contain drop-shadow-sm" />}
             <div className="text-right">
                <h1 className="font-bold text-lg text-primary leading-tight">{data.teamName}</h1>
                <p className="text-[10px] text-muted-foreground uppercase mb-1">ההרכב החסר • {data.formation}</p>
                {data.matchContext && (
                  <p className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
                    {data.matchContext}
                  </p>
                )}
             </div>
          </div>
         <button className="p-2 bg-card rounded-full shadow-sm"><HelpCircle size={20} /></button>
      </header>

      <section className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden shadow-soft mb-6 bg-green-700 bg-gradient-to-t from-green-800 to-green-600 border border-white/10 mx-auto max-w-sm">
        {/* Pitch Lines */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute inset-3 border-2 border-white/30 rounded-sm pointer-events-none">
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-16 border-b-2 border-x-2 border-white/30" />
           <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-16 border-t-2 border-x-2 border-white/30" />
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-2 border-white/30 rounded-full" />
           <div className="absolute top-1/2 left-0 right-0 h-px bg-white/30" />
        </div>

        {/* Players mapping */}
        <div className="absolute inset-0 py-4 flex flex-col justify-between items-center h-full">
           <div className="flex justify-around w-full px-4 mt-2">
             {fwd.map((p, i) => renderPlayer(p, i, 8))}
           </div>
           <div className="flex justify-around w-4/5">
             {mid.map((p, i) => renderPlayer(p, i, 5))}
           </div>
           <div className="flex justify-around w-full px-2">
             {def.map((p, i) => renderPlayer(p, i, 1))}
           </div>
           <div className="flex justify-center w-full mb-2">
             {gk.map((p, i) => renderPlayer(p, i, 0))}
           </div>
        </div>
      </section>

      <div className="px-4 pb-8 max-w-sm mx-auto w-full">
         <div className="relative">
            <input 
              value={guess}
              onChange={e => setGuess(e.target.value)}
              className="w-full bg-card rounded-full py-4 px-6 text-center shadow-sm border border-border focus:ring-2 focus:ring-primary outline-none" 
              placeholder="מי השחקן החסר?" 
            />
         </div>

         <button 
           onClick={handleSubmit}
           className="w-full mt-4 bg-primary text-primary-foreground font-bold py-4 rounded-full shadow-lg active:scale-95 transition-transform"
         >
           בדוק תשובה
         </button>
      </div>
    </div>
  );
};

export default MissingXIGame;
