import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import MissingXIGame from '@/components/minigames/MissingXIGame';
import WhoAreYaGame from '@/components/minigames/WhoAreYaGame';
import CareerPathGame from '@/components/minigames/CareerPathGame';
import Box2BoxGame from '@/components/minigames/Box2BoxGame';
import GuessClubGame from '@/components/minigames/GuessClubGame';

const MiniGamePlayPage: React.FC = () => {
  const { gameType } = useParams<{ gameType: string }>();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const navigate = useNavigate();

  const [puzzle, setPuzzle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      navigate('/minigames');
      return;
    }
    const fetchGameData = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const res = await fetch(`${apiUrl}/api/minigames/today`);
        if (res.ok) {
          const list = await res.json();
          const target = list.find((p: any) => p.id === id);
          if (target) setPuzzle(target);
          else navigate('/minigames');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchGameData();
  }, [id, navigate]);

  const handleSolve = (isCorrect: boolean) => {
    if (isCorrect) {
      localStorage.setItem(`minigame_completed_${id}`, 'true');
      alert('תשובה נכונה! כל הכבוד');
      navigate('/minigames');
    } else {
      alert('תשובה שגויה, נסו שוב.');
    }
  };

  if (loading) return <div className="p-8 text-center animate-pulse">טוען נתונים...</div>;
  if (!puzzle) return null;

  switch (gameType) {
    case 'missing_xi':
      return <MissingXIGame data={puzzle.puzzle_data} solution={puzzle.solution} onSolve={handleSolve} />;
    case 'who_are_ya':
      return <WhoAreYaGame data={puzzle.puzzle_data} solution={puzzle.solution} onSolve={handleSolve} />;
    case 'career_path':
      return <CareerPathGame data={puzzle.puzzle_data} solution={puzzle.solution} onSolve={handleSolve} />;
    case 'box2box':
      return <Box2BoxGame data={puzzle.puzzle_data} solution={puzzle.solution} onSolve={handleSolve} />;
    case 'guess_club':
      return <GuessClubGame data={puzzle.puzzle_data} solution={puzzle.solution} onSolve={handleSolve} />;
    default:
      return <div className="text-center p-8">משחק לא מוכר</div>;
  }
};

export default MiniGamePlayPage;
