import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Clock, Zap, Share2, ChevronLeft } from 'lucide-react';
import MissingXIGame from '@/components/minigames/MissingXIGame';
import WhoAreYaGame from '@/components/minigames/WhoAreYaGame';
import CareerPathGame from '@/components/minigames/CareerPathGame';
import Box2BoxGame from '@/components/minigames/Box2BoxGame';
import GuessClubGame from '@/components/minigames/GuessClubGame';

// ── Post-game analytics screen ────────────────────────────────────────────────
const AnalyticsScreen = ({ stats, onBack }: { stats: any; onBack: () => void }) => {
  const percentile = stats?.stats?.percentile ?? 0;
  const topPercent = Math.max(1, 100 - percentile);
  const avgScore = stats?.stats?.average_score ?? '—';
  const score = stats?.score ?? 0;
  const seconds = stats?.secondsElapsed ?? 0;

  const handleShare = () => {
    const text = `פתרתי את האתגר היומי! קיבלתי ${score} נקודות ב-${seconds} שניות. TOP ${topPercent}% 🏆`;
    navigator.clipboard.writeText(text).then(() => alert('הועתק ללוח!'));
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="min-h-screen flex flex-col items-center justify-center px-5 pb-32 gap-6"
    >
      {/* Trophy badge */}
      <motion.div
        initial={{ scale: 0, rotate: -15 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
        className="relative"
      >
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-2xl shadow-primary/40">
          <Trophy size={44} className="text-primary-foreground" />
        </div>
        <span className="absolute -bottom-2 -right-2 bg-green-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow">
          TOP {topPercent}%
        </span>
      </motion.div>

      {/* Title */}
      <div className="text-center">
        <h1 className="text-3xl font-black leading-tight">כל הכבוד!</h1>
        <p className="text-muted-foreground text-sm mt-1">פתרת את האתגר היומי בהצלחה</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="card-kickoff flex flex-col items-center gap-1 p-4"
        >
          <Zap size={16} className="text-primary mb-0.5" />
          <span className="text-2xl font-black">{score}</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">נקודות</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="card-kickoff flex flex-col items-center gap-1 p-4"
        >
          <Clock size={16} className="text-primary mb-0.5" />
          <span className="text-2xl font-black">{seconds}s</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">זמן פתרון</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="card-kickoff flex flex-col items-center gap-1 p-4"
        >
          <Trophy size={16} className="text-primary mb-0.5" />
          <span className="text-2xl font-black">#{topPercent}%</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">מדרגה</span>
        </motion.div>
      </div>

      {/* Comparison bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="w-full max-w-sm card-kickoff flex flex-col gap-3"
      >
        <div className="flex justify-between text-xs font-medium">
          <span className="text-muted-foreground">הניקוד שלך</span>
          <span className="text-muted-foreground">ממוצע גלובלי: {avgScore} נק׳</span>
        </div>
        <div className="relative w-full h-3 bg-secondary rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(score, 100)}%` }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.6 }}
            className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
          />
          {/* Global average marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/60"
            style={{ left: `${Math.min(avgScore, 100)}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          אתה מהיר יותר מ-{percentile}% מהשחקנים שפתרו היום
        </p>
      </motion.div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
        className="flex flex-col gap-3 w-full max-w-sm"
      >
        <button
          onClick={handleShare}
          className="flex items-center justify-center gap-2 py-3 rounded-2xl border border-border text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <Share2 size={16} /> שתף את התוצאה
        </button>
        <button
          onClick={onBack}
          className="btn-kickoff w-full"
        >
          חזרה לאתגרים
        </button>
      </motion.div>
    </motion.div>
  );
};

// ── Main play page ─────────────────────────────────────────────────────────────
const MiniGamePlayPage: React.FC = () => {
  const { gameType } = useParams<{ gameType: string }>();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const navigate = useNavigate();

  const [puzzle, setPuzzle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [isSolved, setIsSolved] = useState(false);
  const [wrongAttempt, setWrongAttempt] = useState(false);

  useEffect(() => {
    if (!id) { navigate('/minigames'); return; }

    const initGame = async () => {
      try {
        const listRes = await fetch('/api/minigames/today');
        if (listRes.ok) {
          const list = await listRes.json();
          const target = list.find((p: any) => p.id === id);
          if (target) {
            setPuzzle(target);
            await fetch(`/api/minigames/${id}/start`, { method: 'POST' });
          } else {
            navigate('/minigames');
          }
        }
      } catch (err) {
        console.error('Error initializing game:', err);
      } finally {
        setLoading(false);
      }
    };
    initGame();
  }, [id, navigate]);

  const handleSolve = async (answer: string) => {
    try {
      const res = await fetch(`/api/minigames/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      });
      const result = await res.json();
      if (result.success) {
        setStats(result);
        setIsSolved(true);
      } else {
        setWrongAttempt(true);
        setTimeout(() => setWrongAttempt(false), 600);
      }
    } catch (err) {
      console.error('Error submitting answer:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-r-transparent animate-spin" />
        <p className="text-sm text-muted-foreground animate-pulse">טוען את האתגר...</p>
      </div>
    );
  }

  if (!puzzle) return null;

  // ── Analytics screen after solve ──
  if (isSolved && stats) {
    return <AnalyticsScreen stats={stats} onBack={() => navigate('/minigames')} />;
  }

  // ── Game components ──
  const commonProps = { data: puzzle.puzzle_data, solution: puzzle.solution, onSolve: handleSolve };

  const gameNode = (() => {
    switch (gameType) {
      case 'missing_xi':  return <MissingXIGame  {...commonProps} />;
      case 'who_are_ya':  return <WhoAreYaGame   {...commonProps} />;
      case 'career_path': return <CareerPathGame  {...commonProps} />;
      case 'box2box':     return <Box2BoxGame     {...commonProps} />;
      case 'guess_club':  return <GuessClubGame   {...commonProps} />;
      default: return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <p className="text-muted-foreground">סוג משחק לא מוכר: {gameType}</p>
          <button onClick={() => navigate('/minigames')} className="btn-kickoff">חזרה</button>
        </div>
      );
    }
  })();

  return (
    <AnimatePresence>
      <motion.div
        key={id}
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -30 }}
        transition={{ duration: 0.25 }}
        className={wrongAttempt ? 'animate-shake' : ''}
      >
        {gameNode}
      </motion.div>
    </AnimatePresence>
  );
};

export default MiniGamePlayPage;
