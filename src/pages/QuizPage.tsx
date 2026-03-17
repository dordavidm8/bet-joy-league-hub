import { useQuizQuestions } from "@/hooks/useApi";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const QuizPage = () => {
  const { data: quizQuestions = [], isLoading } = useQuizQuestions();
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 px-5 pt-4 pb-24">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-[300px] rounded-[20px]" />
      </div>
    );
  }

  const question = quizQuestions[currentQ];
  if (!question) return null;

  const isAnswered = selected !== null;
  const isCorrect = selected === question.correctIndex;

  const handleSelect = (index: number) => {
    if (isAnswered) return;
    setSelected(index);
    if (index === question.correctIndex) {
      setScore((s) => s + 100);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }
  };

  const handleNext = () => {
    setSelected(null);
    setCurrentQ((q) => (q + 1) % quizQuestions.length);
  };

  return (
    <div className="flex flex-col gap-6 px-5 pt-4 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black">חידון יומי</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold">{score} נק׳</span>
          <span className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full">
            🔥 {streak}
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQ}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="card-kickoff flex flex-col gap-5"
        >
          <p className="text-xs text-muted-foreground">שאלה {currentQ + 1} מתוך {quizQuestions.length}</p>
          <h3 className="text-lg font-bold leading-relaxed">{question.question}</h3>

          <div className="flex flex-col gap-2">
            {question.options.map((option, idx) => {
              let variant: "option" | "option-selected" | "default" = "option";
              let icon = null;

              if (isAnswered) {
                if (idx === question.correctIndex) {
                  variant = "option-selected";
                  icon = <Check size={16} />;
                } else if (idx === selected) {
                  variant = "option";
                  icon = <X size={16} className="text-destructive" />;
                }
              }

              return (
                <Button
                  key={idx}
                  variant={variant}
                  size="lg"
                  className="justify-between"
                  onClick={() => handleSelect(idx)}
                >
                  <span>{option}</span>
                  {icon}
                </Button>
              );
            })}
          </div>

          {isAnswered && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
              <p className={`text-center font-bold ${isCorrect ? "text-primary" : "text-muted-foreground"}`}>
                {isCorrect ? "🎉 נכון! +100 נקודות" : "❌ לא נכון"}
              </p>
              <Button variant="cta" size="lg" onClick={handleNext}>
                שאלה הבאה
              </Button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default QuizPage;
