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

const MiniGamePlayPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [puzzle, setPuzzle] = useState<any>(null);
  const [modalState, setModalState] = useState<{
    open: boolean;
    correct: boolean;
    pointsEarned: number;
    submitError: string | null;
    correctAnswer: string;
  }>({ open: false, correct: false, pointsEarned: 0, submitError: null, correctAnswer: '' });

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

  const { firebaseUser, refreshUser } = useAuth();

  const handleSolve = async (guess: string) => {
    let isCorrect = false;
    let pointsEarned = 0;
    let submitError: string | null = null;
    let correctAnswer = '';

    if (firebaseUser) {
      try {
        const token = await firebaseUser.getIdToken();
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${apiUrl}/api/minigames/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ puzzle_id: id, guess })
        });

        if (res.ok) {
          const data = await res.json();
          isCorrect = data.is_correct ?? false;
          pointsEarned = data.points_added ?? 0;
          correctAnswer = data.correct_answer ?? '';
          if (isCorrect && pointsEarned > 0) {
            localStorage.setItem(`minigame_completed_${id}`, 'true');
            await refreshUser();
          }
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

    setModalState({ open: true, correct: isCorrect, pointsEarned, submitError, correctAnswer });
  };

  const handleCloseModal = () => {
    setModalState({ ...modalState, open: false });
    if (modalState.correct) {
      navigate('/minigames');
    }
  };

  const handleRetry = () => {
    setModalState({ ...modalState, open: false });
  };

  if (!puzzle) return <div className="p-8 text-center">טוען אתגר...</div>;

  const renderGame = () => {
    switch (puzzle.game_type) {
      case 'guess_club':
        return <GuessClubGame data={puzzle.puzzle_data} onSolve={handleSolve} />;
      case 'who_are_ya':
        return <WhoAreYaGame data={puzzle.puzzle_data} onSolve={handleSolve} />;
      case 'career_path':
        return <CareerPathGame data={puzzle.puzzle_data} onSolve={handleSolve} />;
      case 'box2box':
        return <Box2BoxGame data={puzzle.puzzle_data} onSolve={handleSolve} />;
      case 'missing_xi':
        return <MissingXIGame data={puzzle.puzzle_data} onSolve={handleSolve} />;
      case 'trivia':
        return <TriviaGame data={puzzle.puzzle_data} onSolve={handleSolve} />;
      default:
        return <div>סוג משחק לא נתמך</div>;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 font-hebrew" dir="rtl">
      {renderGame()}
      <ResultModal
        isOpen={modalState.open}
        isCorrect={modalState.correct}
        solution={modalState.correctAnswer}
        pointsEarned={modalState.pointsEarned}
        submitError={modalState.submitError}
        onClose={handleCloseModal}
        onRetry={handleRetry}
      />
    </div>
  );
};

export default MiniGamePlayPage;
