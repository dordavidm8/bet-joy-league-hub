import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

const SCREENS = [
  {
    emoji: "⚽",
    title: "ברוכים הבאים ל-Kickoff!",
    desc: "המרו על משחקי כדורגל עם נקודות - בחינם, ללא כסף אמיתי.\nכל משחק הוא הזדמנות לנקודות ולהתחרות עם חברים.",
    sub: "קיבלת 5000 נקודות פתיחה!",
    subColor: "text-green-600",
  },
  {
    emoji: "🎯",
    title: "איך מהמרים?",
    desc: "בחרו משחק, ענו על שאלות ההימור (מי ינצח? כמה שערים?) וקבעו כמה נקודות אתם מהמרים.\nנכון? קיבלתם נקודות. לא נכון? נסו בפעם הבאה.",
    sub: "הימור זמין עד 10 דקות לפני שריקת הפתיחה, אז כדאי שתזדרזו!",
    subColor: "text-orange-500",
  },
  {
    emoji: "🏆",
    title: "ליגות פרטיות",
    desc: "צרו ליגה עם חברים, קבעו דמי כניסה ותחלקו את הקופה.\nהזמינו חברים בקוד ייחודי, תחברו את הליגה לקבוצת הווטסאפ שלהן וצברו נקודות לאורך העונה.",
    sub: "הזמינו חבר - קבלו 1,000 נקודות בונוס!",
    subColor: "text-purple-600",
  },
];

interface Props {
  onDone: () => void;
}

export default function OnboardingPage({ onDone }: Props) {
  const [step, setStep] = useState(0);

  const isLast = step === SCREENS.length - 1;
  const screen = SCREENS[step];

  const next = () => {
    if (isLast) {
      localStorage.setItem("kickoff_onboarding_done", "1");
      onDone();
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        {/* Dots */}
        <div className="flex gap-2">
          {SCREENS.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step ? "w-6 bg-green-500" : "w-2 bg-gray-300"
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="w-full bg-white rounded-2xl p-8 shadow-lg flex flex-col items-center gap-5 text-center"
          >
            <span className="text-6xl">{screen.emoji}</span>
            <h2 className="text-2xl font-black">{screen.title}</h2>
            <p className="text-gray-500 text-sm leading-relaxed whitespace-pre-line">{screen.desc}</p>
            {screen.sub && (
              <p className={`text-sm font-bold ${screen.subColor}`}>{screen.sub}</p>
            )}
          </motion.div>
        </AnimatePresence>

        <Button variant="cta" size="xl" className="w-full" onClick={next}>
          {isLast ? "יאללה, מתחילים! 🚀" : "הבא"}
        </Button>

        {!isLast && (
          <button
            onClick={() => {
              localStorage.setItem("kickoff_onboarding_done", "1");
              onDone();
            }}
            className="text-gray-400 text-xs hover:underline"
          >
            דלג
          </button>
        )}
      </div>
    </div>
  );
}
