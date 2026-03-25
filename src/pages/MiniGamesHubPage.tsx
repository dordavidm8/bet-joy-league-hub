import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldQuestion, UserSearch, Map, Grid, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

// Define the response shape from backend
interface Puzzle {
  id: string;
  game_type: 'missing_xi' | 'who_are_ya' | 'career_path' | 'box2box' | 'guess_club';
  play_date: string;
  puzzle_data: any;
}

const UI_MAP = {
  missing_xi: {
    title: 'ההרכב החסר',
    desc: 'נחשו את ההרכב הפותח ממשחק קלאסי',
    icon: ShieldQuestion,
    route: '/minigames/missing_xi'
  },
  who_are_ya: {
    title: 'מי אתה?',
    desc: 'נחשו את השחקן מתוך התמונה המטושטשת והרמזים',
    icon: UserSearch,
    route: '/minigames/who_are_ya'
  },
  career_path: {
    title: 'אתגר נתיב הקריירה',
    desc: 'נחשו את השחקן מתוך נתיב הקריירה שלו',
    icon: Map,
    route: '/minigames/career_path'
  },
  box2box: {
    title: 'בוקס2בוקס (Box2Box)',
    desc: 'השלימו את גריד הכדורגל',
    icon: Grid,
    route: '/minigames/box2box'
  },
  guess_club: {
    title: 'נחשו את המועדון',
    desc: 'כמה טוב אתם מכירים את סמלי הקבוצות?',
    icon: ShieldAlert,
    route: '/minigames/guess_club'
  }
};

const MiniGamesHubPage: React.FC = () => {
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch today's puzzles
    const fetchGames = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const res = await fetch(`${apiUrl}/api/minigames/today`);
        if (res.ok) {
          const data = await res.json();
          setPuzzles(data);
        }
      } catch (err) {
        console.error('Failed to fetch mini games', err);
      } finally {
        setLoading(false);
      }
    };
    fetchGames();
  }, []);

  // Check LocalStorage for completed states
  const getIsCompleted = (id: string) => {
    return localStorage.getItem(`minigame_completed_${id}`) === 'true';
  };

  const handlePlay = (gameType: string, id: string) => {
    navigate(`/minigames/play/${id}`);
  };

  return (
    <div className="pt-8 px-4 w-full">
      <div className="mb-8 pr-2">
        <span className="section-label">משחקי חידה יומיים</span>
        <h1 className="text-3xl font-bold mt-2">החידות של היום</h1>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-28 bg-card rounded-[24px]"></div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {puzzles.map((puzzle, index) => {
            const meta = UI_MAP[puzzle.game_type] || UI_MAP.who_are_ya;
            const Icon = meta.icon;
            const completed = getIsCompleted(puzzle.id);

            return (
              <div 
                key={puzzle.id}
                onClick={() => handlePlay(puzzle.game_type, puzzle.id)}
                className="card-kickoff flex items-center justify-between group hover:-translate-y-1 transition-transform cursor-pointer"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Icon size={28} />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="font-bold text-lg leading-tight">{meta.title}</h3>
                    <p className="text-muted-foreground text-sm leading-snug">{meta.desc}</p>
                    <span className="text-primary font-bold text-xs mt-1">חידה #{index + 1}</span>
                  </div>
                </div>

                <div className="flex items-center justify-center min-w-[48px] mr-2">
                  {completed ? (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <CheckCircle2 className="text-primary" size={24} />
                    </div>
                  ) : (
                    <button className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-1.5 rounded-full font-bold text-sm transition-transform active:scale-95">
                      שחקו
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {puzzles.length === 0 && !loading && (
             <div className="text-center py-10 text-muted-foreground">
               אין חידות זמינות להיום.
             </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MiniGamesHubPage;
