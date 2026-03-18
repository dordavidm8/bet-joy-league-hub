import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getNextQuestion, answerQuestion } from "@/lib/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";

const QuizPage = () => {
  const queryClient = useQueryClient();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [result, setResult] = useState<{ correct: boolean; correct_option: string; points_earned: number } | null>(null);
  const [sessionScore, setSessionScore] = useState(0);
  const [streak, setStreak] = useState(0);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["quiz-next"],
    queryFn: getNextQuestion,
  });

  const answerMutation = useMutation({
    mutationFn: (selected_option: string) =>
      answerQuestion(data!.question!.id, selected_option),
    onSuccess: (res) => {
      setResult(res);
      if (res.correct) {
        setSessionScore((s) => s + res.points_earned);
        setStreak((s) => s + 1);
        queryClient.invalidateQueries({ queryKey: ["my-stats"] });
      } else {
        setStreak(0);
      }
    },
  });

  const handleSelect = (optionKey: string) => {
    if (selectedKey || answerMutation.isPending) return;
    setSelectedKey(optionKey);
    answerMutation.mutate(optionKey);
  };

  const handleNext = () => {
    setSelectedKey(null);
    setResult(null);
    refetch();
  };

  const question = data?.question;

  if (isLoading) {
    return <div className="p-5 text-sm text-muted-foreground">טוען שאלה...</div>;
  }

  if (!question) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 pt-20 px-5 pb-24">
        <span className="text-5xl">🏆</span>
        <h2 className="text-xl font-black">ענית על כל השאלות!</h2>
        <p className="text-muted-foreground text-sm text-center">כל הכבוד, אין יותר שאלות זמינות עכשיו</p>
        <p className="text-lg font-black text-primary">+{sessionScore} נקודות השאלה הזאת</p>
      </div>
    );
  }

  const options: string[] = Array.isArray(question.options) ? question.options : [];

  return (
    <div className="flex flex-col gap-6 px-5 pt-4 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black">חידון יומי</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold">{sessionScore} נק׳</span>
          <span className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full">
            🔥 {streak}
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="card-kickoff flex flex-col gap-5"
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{question.category}</span>
            <span>+{question.points_reward} נק׳ על תשובה נכונה</span>
          </div>

          <h3 className="text-lg font-bold leading-relaxed">{question.question_text}</h3>

          <div className="flex flex-col gap-2">
            {options.map((option, idx) => {
              const isSelected = selectedKey === option;
              const isCorrect = result?.correct_option === option;
              const isWrong = isSelected && !result?.correct;

              let cls = "justify-between py-3 px-4 rounded-xl border text-sm font-semibold transition-colors text-right w-full flex items-center";
              if (!result) {
                cls += isSelected
                  ? " bg-primary text-primary-foreground border-primary"
                  : " bg-secondary border-border hover:border-primary/40";
              } else {
                if (isCorrect) cls += " bg-primary/10 border-primary text-primary";
                else if (isWrong) cls += " bg-destructive/10 border-destructive text-destructive";
                else cls += " bg-secondary border-border opacity-50";
              }

              return (
                <button key={idx} className={cls} onClick={() => handleSelect(option)} disabled={!!result}>
                  <span>{option}</span>
                  {result && isCorrect && <Check size={16} />}
                  {result && isWrong && <X size={16} />}
                </button>
              );
            })}
          </div>

          {result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
              <p className={`text-center font-bold ${result.correct ? "text-primary" : "text-muted-foreground"}`}>
                {result.correct ? `🎉 נכון! +${result.points_earned} נקודות` : "❌ לא נכון"}
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
