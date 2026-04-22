import { motion } from "framer-motion";
import { HelpCircle, Trophy, Smartphone, MessageSquare, Target, User, ChevronRight, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const HelpPage = () => {
  const navigate = useNavigate();

  const sections = [
    {
      id: "betting",
      icon: <Target className="text-primary" size={24} />,
      title: "איך מהמרים?",
      desc: "היכנסו למשחק שמעניין אתכם, בחרו את התוצאה (1/X/2) ואולי גם את התוצאה המדויקת. ניתן להמר הימור בודד או לשלב כמה משחקים לטופס אחד (Parlay) כדי להגדיל את היחס.",
    },
    {
      id: "whatsapp",
      icon: <Smartphone className="text-green-500" size={24} />,
      title: "חיבור לווטסאפ",
      desc: "חברו את הטלפון שלכם דרך מסך הפרופיל כדי לקבל עדכונים בזמן אמת על משחקים, תוצאות, ולהמר ישירות מתוך הווטסאפ באמצעות תגובה להודעות.",
    },
    {
      id: "leagues",
      icon: <Trophy className="text-yellow-500" size={24} />,
      title: "ליגות חברים",
      desc: "ניתן להקים ליגה פרטית או להצטרף לליגה קיימת. בתוך הליגה אתם מתחרים מול החברים שלכם על הטבלה. הניקוד שתצברו ממהימורים בליגה יקבע את מקומכם.",
    },
    {
      id: "minigames",
      icon: <Zap className="text-blue-500" size={24} />,
      title: "משחקי מיני וקומבו",
      desc: "בכל יום מחכים לכם משחקי ניחוש כמו GuessClub ו-MissingXI. פתרון המשחקים מזכה אתכם בנקודות שתוכלו להשתמש בהן להימורים.",
    },
    {
      id: "expert",
      icon: <MessageSquare className="text-purple-500" size={24} />,
      title: "ייעוץ מומחה AI",
      desc: "התייעצו עם ה-AI שלנו לקבלת ניתוחים, נתונים היסטוריים והמלצות חכמות לפני שאתם מציבים את ההימור.",
    },
    {
      id: "profile",
      icon: <User className="text-muted-foreground" size={24} />,
      title: "פרופיל ודירוג",
      desc: "במסך הפרופיל תוכלו לצפות בהישגים שלכם, בסטטיסטיקות האישיות ובדירוג הגלובלי שלכם מול כל משתמשי Kickoff.",
    },
  ];

  return (
    <div className="flex flex-col gap-6 px-5 pt-4 pb-24 max-w-lg mx-auto" dir="rtl">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <HelpCircle size={32} className="text-primary" />
          <h1 className="text-3xl font-black tracking-tight">מרכז עזרה</h1>
        </div>
        <p className="text-muted-foreground text-sm">כל מה שצריך לדעת כדי להתחיל לנצח ב-Kickoff</p>
      </header>

      <div className="grid gap-4">
        {sections.map((section, idx) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="card-kickoff flex flex-col gap-3 p-5"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-secondary shrink-0">
                {section.icon}
              </div>
              <h3 className="text-lg font-black">{section.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {section.desc}
            </p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-4 flex flex-col gap-3"
      >
        <h2 className="text-lg font-black text-center">מוכנים להתחיל?</h2>
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => navigate("/")}
            className="btn-primary w-full flex items-center justify-center gap-2 py-4"
          >
            חזרה לדף הבית
            <ChevronRight className="rotate-180" size={18} />
          </button>
        </div>
      </motion.div>

      <footer className="text-center mt-4">
        <p className="text-xs text-muted-foreground">Kickoff v1.0 • פותח באהבה לאוהדי כדורגל</p>
      </footer>
    </div>
  );
};

export default HelpPage;
