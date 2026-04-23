import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldQuestion, UserSearch, Map, Grid, ShieldAlert, CheckCircle2, HelpCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface Puzzle {
  id: string;
  game_type: 'missing_xi' | 'who_are_ya' | 'career_path' | 'box2box' | 'guess_club' | 'trivia';
  play_date: string;
  puzzle_data: any;
}

const UI_MAP = {
  trivia: { title: 'טריוויה', desc: 'היעזר בידע בנבכי עולם הכדורגל בשאלה היומית', icon: HelpCircle },
  missing_xi: { title: 'ההרכב החסר', desc: 'נחשו את ההרכב הפותח ממשחק קלאסי', icon: ShieldQuestion },
  who_are_ya: { title: 'מי אתה?', desc: 'נחשו את השחקן מתוך התמונה המטושטשת והרמזים', icon: UserSearch },
  career_path: { title: 'אתגר נתיב הקריירה', desc: 'נחשו את השחקן מתוך נתיב הקריירה שלו', icon: Map },
  box2box: { title: 'בוקס2בוקס (Box2Box)', desc: 'השלימו את גריד הכדורגל', icon: Grid },
  guess_club: { title: 'נחשו את המועדון', desc: 'כמה טוב אתם מכירים את סמלי הקבוצות?', icon: ShieldAlert },
};

const MiniGamesHubPage: React.FC = () => {
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameStatuses, setGameStatuses] = useState<Record<string, { is_completed: boolean; attempt_count: number }>>({});
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${apiUrl}/api/minigames/today`);
        if (res.ok) {
          const data = await res.json();
          setPuzzles(data);
          // Fetch completion status from DB
          if (firebaseUser && data.length > 0) {
            const ids = data.map((p: Puzzle) => p.id).join(',');
            const token = await firebaseUser.getIdToken();
            const statusRes = await fetch(`${apiUrl}/api/minigames/status?puzzle_ids=${ids}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              setGameStatuses(statusData.statuses || {});
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch mini games', err);
      } finally {
        setLoading(false);
      }
    };
    fetchGames();
  }, [firebaseUser]);

  return (
    <div className="pt-8 px-4 w-full">
      <div className="mb-8 pr-2">
        <span className="section-label">משחקי חידה יומיים</span>
        <h1 className="text-3xl font-bold mt-2">החידות של היום</h1>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-28 bg-card rounded-[24px]"></div>)}
        </div>
      ) : (
        <div className="space-y-4">
          {puzzles.map((puzzle, index) => {
            const meta = UI_MAP[puzzle.game_type] || UI_MAP.who_are_ya;
            const Icon = meta.icon;
            
            const status = gameStatuses[puzzle.id];
            const completed = status?.is_completed;
            const exhausted = !completed && (status?.attempt_count ?? 0) >= 3;
            const isDisabled = completed || exhausted;

            return (
              <div
                key={puzzle.id}
                onClick={() => !isDisabled && navigate(`/minigames/play/${puzzle.id}`)}
                className={`card-kickoff flex items-center justify-between group transition-all ${
                  isDisabled ? "opacity-70 grayscale-[0.3] cursor-default" : "hover:-translate-y-1 cursor-pointer"
                }`}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                    completed ? "bg-primary/10 text-primary" : 
                    exhausted ? "bg-destructive/10 text-destructive" :
                    "bg-primary/10 text-primary"
                  }`}>
                    <Icon size={28} />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="font-bold text-lg leading-tight">{meta.title}</h3>
                    <p className="text-muted-foreground text-sm leading-snug">{meta.desc}</p>
                    <span className="text-primary/60 font-bold text-[10px] mt-1">חידה #{index + 1}</span>
                  </div>
                </div>
                <div className="flex items-center justify-center min-w-[70px] mr-2">
                  {completed ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                        <CheckCircle2 className="text-primary" size={20} />
                      </div>
                    </div>
                  ) : exhausted ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                        <ShieldAlert size={20} />
                      </div>
                      <span className="text-[9px] font-bold text-destructive">נגמרו הניסיונות</span>
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
          {puzzles.length === 0 && <div className="text-center py-10 text-muted-foreground">אין חידות זמינות להיום.</div>}
        </div>
      )}
    </div>
  );
};

export default MiniGamesHubPage;
