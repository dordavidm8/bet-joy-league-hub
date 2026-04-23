// MiniGamePlayPage.tsx – משחק מיני-גיים בודד
// מנתב לקומפוננטת המשחק הנכונה לפי gameType:
// MissingXI, WhoAreYa, CareerPath, Box2Box, GuessClub.
// params: gameId מ-React Router.
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GuessClubGame from '../components/minigames/GuessClubGame';
import WhoAreYaGame from '../components/minigames/WhoAreYaGame';
import CareerPathGame from '../components/minigames/CareerPathGame';
import Box2BoxGame from '../components/minigames/Box2BoxGame';
import MissingXIGame from '../components/minigames/MissingXIGame';
import TriviaGame from '../components/minigames/TriviaGame';
import ResultModal from '../components/minigames/ResultModal';

const MAX_ATTEMPTS = 3;

const MiniGamePlayPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [puzzle, setPuzzle] = useState<any>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [modalState, setModalState] = useState<{
    open: boolean;
    correct: boolean;
    pointsEarned: number;
    submitError: string | null;
    correctAnswer: string;
    showAnswer: boolean;
  }>({ open: false, correct: false, pointsEarned: 0, submitError: null, correctAnswer: '', showAnswer: false });

  const { firebaseUser, refreshUser } = useAuth();

  useEffect(() => {
    async function fetchPuzzle() {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${apiUrl}/api/minigames/today`);
        if (res.ok) {
          const list = await res.json();
          const target = list.find((p: any) => p.id === id);
          if (target) {
            setPuzzle(target);
          } else navigate('/minigames');
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchPuzzle();
  }, [id, navigate]);

  // Fetch attempt status from DB on mount (when logged in)
  useEffect(() => {
    if (!id || !firebaseUser) return;
    async function fetchStatus() {
      try {
        const token = await firebaseUser!.getIdToken();
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${apiUrl}/api/minigames/status?puzzle_ids=${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const status = data.statuses?.[id!];
          if (status) {
            setAttemptCount(status.attempt_count);
            // If already solved or 3+ attempts used, don't allow play
            if (status.is_completed || status.attempt_count >= MAX_ATTEMPTS) {
              navigate('/minigames');
            }
          }
        }
      } catch (_) {}
    }
    fetchStatus();
  }, [id, firebaseUser]);

  const handleSolve = async (guess: string) => {
    let isCorrect = false;
    let pointsEarned = 0;
    let submitError: string | null = null;
    let correctAnswer = '';
    let showAnswer = false;

    if (firebaseUser) {
      try {
        const token = await firebaseUser.getIdToken();
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${apiUrl}/api/minigames/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ puzzle_id: id, guess }),
        });

        if (res.ok) {
          const data = await res.json();
          isCorrect = data.is_correct ?? false;
          pointsEarned = data.points_added ?? 0;
          correctAnswer = data.correct_answer ?? '';
          showAnswer = data.show_answer ?? false;
          const newCount = data.attempt_count ?? attemptCount + 1;
          setAttemptCount(newCount);
          if (isCorrect && pointsEarned > 0) await refreshUser();
        } else {
          const body = await res.json().catch(() => ({}));
          submitError = body.error || `שגיאה ${res.status}`;
        }
      } catch (err: any) {
        submitError = 'לא ניתן להתחבר לשרת';
      }
    } else {
      submitError = 'יש להתחבר כדי לצבור נקודות';
    }

    setModalState({ open: true, correct: isCorrect, pointsEarned, submitError, correctAnswer, showAnswer });
  };

  const handleCloseModal = () => {
    setModalState({ ...modalState, open: false });
    if (modalState.correct || modalState.showAnswer) navigate('/minigames');
  };

  const handleRetry = () => {
    setModalState({ ...modalState, open: false });
  };

  if (!puzzle) return <div className="p-8 text-center">טוען אתגר...</div>;

  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - attemptCount);

  const renderGame = () => {
    const key = `${id}-${attemptCount}`;
    switch (puzzle.game_type) {
      case 'guess_club': return <GuessClubGame key={key} data={puzzle.puzzle_data} onSolve={handleSolve} />;
      case 'who_are_ya': return <WhoAreYaGame key={key} data={puzzle.puzzle_data} onSolve={handleSolve} />;
      case 'career_path': return <CareerPathGame key={key} data={puzzle.puzzle_data} onSolve={handleSolve} />;
      case 'box2box': return <Box2BoxGame key={key} data={puzzle.puzzle_data} onSolve={handleSolve} />;
      case 'missing_xi': return <MissingXIGame key={key} data={puzzle.puzzle_data} onSolve={handleSolve} />;
      case 'trivia': return <TriviaGame key={key} data={puzzle.puzzle_data} onSolve={handleSolve} />;
      default: return <div>סוג משחק לא נתמך</div>;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 font-hebrew" dir="rtl">
      {attemptCount < MAX_ATTEMPTS && (
        <div className="text-center pt-3 text-xs text-muted-foreground">
          ניסיון {attemptCount + 1}/{MAX_ATTEMPTS} — {MAX_ATTEMPTS - attemptCount === 1 ? 'נותר ניסיון 1' : `נותרו ${MAX_ATTEMPTS - attemptCount} ניסיונות`}
        </div>
      )}
      {renderGame()}
      <ResultModal
        isOpen={modalState.open}
        isCorrect={modalState.correct}
        solution={modalState.correctAnswer}
        pointsEarned={modalState.pointsEarned}
        submitError={modalState.submitError}
        showAnswer={modalState.showAnswer}
        attemptsLeft={Math.max(0, MAX_ATTEMPTS - attemptCount)}
        onClose={handleCloseModal}
        onRetry={handleRetry}
      />
    </div>
  );
};

export default MiniGamePlayPage;
