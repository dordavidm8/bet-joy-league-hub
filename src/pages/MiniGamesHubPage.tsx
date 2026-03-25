import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldQuestion, UserSearch, Map, Grid3x3, ShieldAlert,
  CheckCircle2, ChevronRight, Zap, Trophy
} from 'lucide-react';

interface Puzzle {
  id: string;
  game_type: 'missing_xi' | 'who_are_ya' | 'career_path' | 'box2box' | 'guess_club';
  play_date: string;
  puzzle_data: any;
}

const UI_MAP = {
  missing_xi: {
    title: 'ההרכב החסר',
    desc: 'מי השחקן החסר מהסגל הפותח?',
    icon: ShieldQuestion,
    color: 'from-blue-500/20 to-blue-600/10',
    iconColor: 'text-blue-400',
  },
  who_are_ya: {
    title: 'מי אתה?',
    desc: 'זהו את השחקן מהרמזים המוסתרים',
    icon: UserSearch,
    color: 'from-purple-500/20 to-purple-600/10',
    iconColor: 'text-purple-400',
  },
  career_path: {
    title: 'נתיב הקריירה',
    desc: 'זהו את השחקן לפי תחנות הקריירה',
    icon: Map,
    color: 'from-orange-500/20 to-orange-600/10',
    iconColor: 'text-orange-400',
  },
  box2box: {
    title: 'בוקס 2 בוקס',
    desc: 'מי שיחק בשתי הקבוצות האלו?',
    icon: Grid3x3,
    color: 'from-green-500/20 to-green-600/10',
    iconColor: 'text-green-400',
  },
  guess_club: {
    title: 'נחש את המועדון',
    desc: 'זהו את הקבוצה מהסמל המטושטש',
    icon: ShieldAlert,
    color: 'from-rose-500/20 to-rose-600/10',
    iconColor: 'text-rose-400',
  },
};

const SkeletonCard = () => (
  <div className="card-kickoff animate-pulse h-24 flex items-center gap-4">
    <div className="w-14 h-14 bg-secondary rounded-2xl shrink-0" />
    <div className="flex flex-col gap-2 flex-1">
      <div className="h-4 bg-secondary rounded-full w-1/2" />
      <div className="h-3 bg-secondary rounded-full w-3/4" />
    </div>
  </div>
);

const MiniGamesHubPage: React.FC = () => {
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Track completed games via backend for the day
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await fetch('/api/minigames/today');   // via Vite proxy
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

  const today = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
  const completed = completedIds.size;
  const total = puzzles.length || 5;

  return (
    <div className="flex flex-col gap-6 pb-32 pt-4">

      {/* Header */}
      <div className="px-5">
        <div className="card-kickoff bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Trophy size={28} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{today}</p>
            <h1 className="text-xl font-black">אתגרי היום</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {loading ? '...' : `${completed} / ${total} הושלמו`}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap size={14} className="text-primary" />
            <span className="text-xs font-bold text-primary">+100 נק׳</span>
          </div>
        </div>
      </div>

      {/* Progress bar (full day) */}
      {!loading && puzzles.length > 0 && (
        <div className="px-5">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
            <span>ההתקדמות שלך להיום</span>
            <span>{Math.round((completed / total) * 100)}%</span>
          </div>
          <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(completed / total) * 100}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-primary rounded-full"
            />
          </div>
        </div>
      )}

      {/* Game cards */}
      <div className="flex flex-col gap-3 px-5">
        <span className="section-label px-0">בחרו אתגר</span>

        {loading
          ? [1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)
          : puzzles.length === 0
            ? (
              <div className="text-center py-16 flex flex-col items-center gap-3 text-muted-foreground">
                <ShieldQuestion size={40} className="opacity-20" />
                <p className="text-sm">אין אתגרים זמינים להיום.<br />בדקו שוב מאוחר יותר.</p>
              </div>
            )
            : puzzles.map((puzzle, index) => {
              const meta = UI_MAP[puzzle.game_type] ?? UI_MAP.who_are_ya;
              const Icon = meta.icon;
              const isCompleted = completedIds.has(puzzle.id);

              return (
                <motion.div
                  key={puzzle.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.07 }}
                  onClick={() => {
                    if (!isCompleted) navigate(`/minigames/${puzzle.game_type}?id=${puzzle.id}`);
                  }}
                  className={`card-kickoff flex items-center gap-4 ${isCompleted ? 'opacity-60 cursor-default' : 'cursor-pointer hover:-translate-y-0.5 transition-transform active:scale-[0.98]'}`}
                >
                  {/* Icon area */}
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${meta.color} flex items-center justify-center shrink-0`}>
                    <Icon size={26} className={meta.iconColor} />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold leading-tight truncate">{meta.title}</h3>
                      <span className="text-[9px] font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full shrink-0">
                        #{index + 1}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs leading-snug mt-0.5 truncate">{meta.desc}</p>
                  </div>

                  {/* CTA */}
                  <div className="shrink-0">
                    {isCompleted ? (
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                        <CheckCircle2 className="text-primary" size={20} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 bg-primary text-primary-foreground px-3.5 py-2 rounded-xl text-xs font-bold">
                        שחק
                        <ChevronRight size={13} className="opacity-60" />
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })
        }
      </div>
    </div>
  );
};

export default MiniGamesHubPage;
