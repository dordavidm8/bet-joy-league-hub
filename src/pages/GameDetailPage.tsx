import { useParams, useNavigate } from "react-router-dom";
import { mockGames, mockBetQuestions } from "@/lib/mockData";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import AiAdvisor from "@/components/AiAdvisor";

const GameDetailPage = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { addToBetSlip } = useApp();
  const game = mockGames.find((g) => g.id === gameId);
  const questions = gameId ? mockBetQuestions[gameId] || [] : [];
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [points, setPoints] = useState("");
  const [showAi, setShowAi] = useState(false);

  if (!game) return <div className="p-5">משחק לא נמצא</div>;

  const handleSelect = (questionId: string, optionId: string) => {
    setSelections((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleAddToSlip = () => {
    const selectedQuestions = Object.entries(selections);
    if (selectedQuestions.length === 0 || !points) return;

    selectedQuestions.forEach(([qId, oId]) => {
      const q = questions.find((qq) => qq.id === qId);
      const o = q?.options.find((oo) => oo.id === oId);
      if (q && o) {
        addToBetSlip({
          game,
          question: q.question,
          selectedOption: o.label,
          points: Math.round(Number(points) / selectedQuestions.length),
        });
      }
    });

    navigate("/betslip");
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Header */}
      <div className="px-5 pt-2">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-muted-foreground text-sm mb-4">
          <ArrowRight size={16} />
          חזרה
        </button>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-kickoff"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="section-label">{game.competition}</span>
            {game.isLive && (
              <span className="flex items-center gap-1 text-xs font-bold text-primary">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                LIVE
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 my-4">
            <div className="flex flex-col items-center gap-2 flex-1">
              <span className="text-3xl">{game.homeTeam.logo}</span>
              <span className="text-sm font-bold text-center">{game.homeTeam.name}</span>
            </div>
            <div className="flex flex-col items-center">
              {game.isLive && game.score ? (
                <span className="text-3xl font-black">{game.score.home} - {game.score.away}</span>
              ) : (
                <div className="text-center">
                  <p className="text-xl font-bold">{game.time}</p>
                  <p className="text-xs text-muted-foreground">{game.date}</p>
                </div>
              )}
            </div>
            <div className="flex flex-col items-center gap-2 flex-1">
              <span className="text-3xl">{game.awayTeam.logo}</span>
              <span className="text-sm font-bold text-center">{game.awayTeam.name}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Questions */}
      <div className="flex flex-col gap-5 px-5">
        {questions.map((q, i) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="flex flex-col gap-3"
          >
            <h3 className="font-bold text-base">{q.question}</h3>
            <div className="flex flex-wrap gap-2">
              {q.options.map((o) => (
                <Button
                  key={o.id}
                  variant={selections[q.id] === o.id ? "option-selected" : "option"}
                  size="default"
                  onClick={() => handleSelect(q.id, o.id)}
                >
                  {o.label}
                </Button>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Points Input */}
      <div className="px-5 flex flex-col gap-2">
        <label className="font-bold text-sm">כמה נקודות להמר?</label>
        <input
          type="number"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          placeholder="הכנס כמות נקודות"
          className="bg-secondary rounded-[16px] px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
        />
      </div>

      {/* Add to Slip */}
      <div className="px-5">
        <Button
          variant="cta"
          size="xl"
          className="w-full"
          onClick={handleAddToSlip}
          disabled={Object.keys(selections).length === 0 || !points}
        >
          הוסף לתלוש
        </Button>
      </div>

      {/* AI Button */}
      <button
        onClick={() => setShowAi(true)}
        className="fixed bottom-24 left-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-elevated flex items-center justify-center hover:scale-110 active:scale-95 transition-transform z-40"
      >
        <Sparkles size={22} />
      </button>

      {showAi && <AiAdvisor game={game} onClose={() => setShowAi(false)} />}
    </div>
  );
};

export default GameDetailPage;
