import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GuessClubGame from '../components/minigames/GuessClubGame';
import WhoAreYaGame from '../components/minigames/WhoAreYaGame';
import CareerPathGame from '../components/minigames/CareerPathGame';
import Box2BoxGame from '../components/minigames/Box2BoxGame';
import MissingXIGame from '../components/minigames/MissingXIGame';
import ResultModal from '../components/minigames/ResultModal';

const MiniGamePlayPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [puzzle, setPuzzle] = useState<any>(null);
  const [modalState, setModalState] = useState<{ open: boolean; correct: boolean }>({ open: false, correct: false });

  useEffect(() => {
    async function fetchPuzzle() {
      try {
        const res = await fetch('/api/minigames/today');
        if (res.ok) {
          const list = await res.json();
          const target = list.find((p: any) => p.id === id);
          if (target) {
            console.log('[MiniGameDebug] Puzzle:', target);
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

  const handleSolve = async (isCorrect: boolean) => {
    console.log('[MiniGameDebug] Attempt Result:', isCorrect, 'Solution was:', puzzle?.solution);
    
    if (firebaseUser) {
      try {
        const token = await firebaseUser.getIdToken();
        const res = await fetch('/api/minigames/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            puzzle_id: id,
            is_correct: isCorrect
          })
        });
        
        if (res.ok) {
          const data = await res.json();
          console.log('[MiniGameDebug] Submit Response:', data);
          if (isCorrect) {
            localStorage.setItem(`minigame_completed_${id}`, 'true');
            await refreshUser(); // Update points in header
          }
        }
      } catch (err) {
        console.error('Failed to submit mini game result:', err);
      }
    }
    
    setModalState({ open: true, correct: isCorrect });
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
        return <GuessClubGame data={puzzle.puzzle_data} solution={puzzle.solution} onSolve={handleSolve} />;
      case 'who_are_ya':
        return <WhoAreYaGame data={puzzle.puzzle_data} solution={puzzle.solution} onSolve={handleSolve} />;
      case 'career_path':
        return <CareerPathGame data={puzzle.puzzle_data} solution={puzzle.solution} onSolve={handleSolve} />;
      case 'box2box':
        return <Box2BoxGame data={puzzle.puzzle_data} solution={puzzle.solution} onSolve={handleSolve} />;
      case 'missing_xi':
        return <MissingXIGame data={puzzle.puzzle_data} solution={puzzle.solution} onSolve={handleSolve} />;
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
        solution={puzzle.solution.secret}
        onClose={handleCloseModal}
        onRetry={handleRetry}
      />
    </div>
  );
};

export default MiniGamePlayPage;
