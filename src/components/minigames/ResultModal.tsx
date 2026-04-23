// minigames/ResultModal.tsx – מסך תוצאת משחק
// Modal שמוצג לאחר סיום כל מיני-גיים.
// מציג: ניצחת/הפסדת, נקודות שנצברו, תשובה נכונה.
import React from 'react';
import { CheckCircle2, XCircle, ArrowRight, RotateCcw, AlertCircle } from 'lucide-react';

interface ResultModalProps {
  isOpen: boolean;
  isCorrect: boolean;
  solution: string;
  pointsEarned?: number;
  submitError?: string | null;
  showAnswer?: boolean;
  attemptsLeft?: number;
  onClose: () => void;
  onRetry?: () => void;
}

const ResultModal: React.FC<ResultModalProps> = ({
  isOpen, isCorrect, solution, pointsEarned = 0, submitError,
  showAnswer = false, attemptsLeft, onClose, onRetry,
}) => {
  if (!isOpen) return null;

  const isExhausted = !isCorrect && showAnswer;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-sm rounded-[32px] shadow-2xl border border-border p-8 flex flex-col items-center text-center gap-6 animate-in zoom-in-95 duration-300">
        <div className={`p-4 rounded-full ${isCorrect ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}`}>
          {isCorrect ? <CheckCircle2 size={64} /> : <XCircle size={64} />}
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-black text-foreground">
            {isCorrect ? 'כל הכבוד!' : isExhausted ? 'נגמרו הניסיונות' : 'אופס, לא בדיוק...'}
          </h2>
          {isCorrect && pointsEarned > 0 && (
            <p className="text-green-500 text-xl font-black">+{pointsEarned} נקודות!</p>
          )}
          <p className="text-muted-foreground text-sm font-medium px-4">
            {isCorrect
              ? pointsEarned > 0
                ? 'כל הנקודות נוספו לדירוג שלכם.'
                : submitError
                  ? 'התשובה נכונה, אך לא הצלחנו לשמור את הנקודות.'
                  : 'כבר ענית על אתגר זה היום.'
              : isExhausted
                ? `התשובה הנכונה הייתה: ${solution}. אל תדאגו, תמיד יש אתגרים חדשים!`
                : attemptsLeft !== undefined
                  ? attemptsLeft === 1 ? 'נשאר לכם ניסיון 1 נוסף' : `נשארו לכם ${attemptsLeft} ניסיונות נוספים`
                  : 'נסו שוב!'}
          </p>
          {submitError && (
            <div className="flex items-center gap-2 bg-destructive/10 text-destructive text-xs font-medium px-3 py-2 rounded-xl mt-1">
              <AlertCircle size={14} />
              <span>{submitError}</span>
            </div>
          )}
        </div>

        <div className="w-full flex flex-col gap-3 mt-2">
          {isCorrect || isExhausted ? (
            <button
              onClick={onClose}
              className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
            >
              {isCorrect ? 'המשך למרכז האתגרים' : 'חזרה לרשימה'}
              <ArrowRight size={20} />
            </button>
          ) : (
            <>
              <button
                onClick={onRetry}
                className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
              >
                נסו שוב
                <RotateCcw size={18} />
              </button>
              <button
                onClick={onClose}
                className="w-full bg-secondary text-secondary-foreground py-4 rounded-2xl font-bold hover:opacity-90 active:scale-95 transition-all"
              >
                חזרה לרשימה
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultModal;
