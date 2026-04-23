// minigames/TriviaGame.tsx – שאלות טריוויה
// מציג שאלה עם 4 אפשרויות. לחיצה → בדיקה מיידית + ניקוד.
// שאלות מגיעות מ-quiz_questions table.
import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface TriviaGameProps {
  data: {
    question_text: string;
    options: string[];
  };
  onSolve: (guess: string) => void;
}

const TriviaGame: React.FC<TriviaGameProps> = ({ data, onSolve }) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const handleSelect = (opt: string) => {
    setSelectedOption(opt);
    // Slight delay so the user sees the click effect before navigating away
    setTimeout(() => {
      onSolve(opt);
    }, 400);
  };

  return (
    <div className="max-w-md mx-auto pt-8 px-4 flex flex-col items-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-3xl mb-4"
      >
        🧠
      </motion.div>
      <h2 className="text-2xl font-black mb-2 text-center text-primary">טריוויה</h2>
      <p className="text-sm text-muted-foreground mb-8 text-center">היעזר בידע שלך בכדורגל כדי לענות נכונה ולצבור נקודות!</p>

      <div className="bg-secondary/40 w-full rounded-2xl p-6 shadow-sm border border-border/50 text-center mb-6">
        <h3 className="font-bold text-lg leading-snug">{data.question_text}</h3>
      </div>

      <div className="flex flex-col w-full gap-3">
        {data.options.map((opt, i) => (
          <motion.button
            key={i}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSelect(opt)}
            disabled={selectedOption !== null}
            className={`w-full py-4 px-4 rounded-xl font-bold border transition-colors flex items-center justify-start text-right ${
              selectedOption === opt
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-secondary/50 border-border shadow-sm'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-secondary/80 flex items-center justify-center mr-0 ml-3 text-sm shrink-0">
              {String.fromCharCode(65 + i)}
            </div>
            <span className="flex-1">{opt.replace(/^[A-D]\.\s*/, '')}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default TriviaGame;
