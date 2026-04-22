import { motion } from "framer-motion";
import { ChevronRight, HelpCircle, Trophy, Smartphone, Zap, ShieldCheck, Share2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const HelpPage = () => {
  const navigate = useNavigate();

  const sections = [
    {
      title: "איך מתחילים?",
      icon: <Zap className="text-yellow-500" size={20} />,
      content: "במבחן התוצאה, הכל פשוט. בוחרים משחק פעיל, מנחשים את המנצחת (1, X, 2) ואת התוצאה המדויקת. פגיעה בתוצאה המדויקת מעניקה בונוס משמעותי!"
    },
    {
      title: "מה זה ליגות ווטסאפ?",
      icon: <Smartphone className="text-green-500" size={20} />,
      content: "ניתן לחבר כל ליגה לקבוצת ווטסאפ. הבוט של Kickoff ישלח הודעה בכל בוקר עם המשחקים הרלוונטיים, וניתן להמר ישירות מהצ'אט על ידי השבה (Reply) להודעה."
    },
    {
      title: "צבירת נקודות",
      icon: <Trophy className="text-primary" size={20} />,
      content: "על כל הימור מוצלח מקבלים נקודות. ככל שיש יותר נקודות, כך הדירוג שלכם בטבלה עולה. יש גם 'הישגים' שמעניקים בונוסים על רצפים וניצחונות מיוחדים."
    },
    {
      title: "חיבור חשבון ווטסאפ",
      icon: <ShieldCheck className="text-blue-500" size={20} />,
      content: "כדי שההימורים שלכם בווטסאפ ייספרו בחשבון האתר, עליכם לחבר את המספר שלכם במסך הפרופיל. זהו תהליך חד-פעמי שמאבטח את החשבון שלכם."
    },
    {
        title: "הזמנת חברים",
        icon: <Share2 className="text-purple-500" size={20} />,
        content: "שתפו את לינק ההפניה האישי שלכם מהפרופיל. על כל חבר שנרשם דרככם, שניכם תקבלו בונוס של 1,000 נקודות!"
      }
  ];

  return (
    <div className="flex flex-col gap-6 px-5 pt-4 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center gap-2 text-primary">
          <HelpCircle size={28} />
          <h1 className="text-3xl font-black">עזרה והדרכה</h1>
        </div>
        <p className="text-muted-foreground">כל מה שצריך לדעת כדי להפוך לאלוף הקיקאוף הבא.</p>
      </motion.div>

      <div className="flex flex-col gap-4">
        {sections.map((section, i) => (
          <motion.section
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="card-kickoff flex flex-col gap-3 p-5"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-secondary shrink-0">
                {section.icon}
              </div>
              <h3 className="font-black text-lg">{section.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {section.content}
            </p>
          </motion.section>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-4 p-6 rounded-3xl bg-primary/10 border border-primary/20 flex flex-col items-center text-center gap-4"
      >
        <div className="text-4xl">⚽</div>
        <div>
          <h4 className="font-black text-lg">מוכנים להתחיל?</h4>
          <p className="text-xs text-muted-foreground mt-1">המשחקים הגדולים של היום כבר מחכים לכם</p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="bg-primary text-primary-foreground px-8 py-3 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:scale-105 transition-transform"
        >
          בואו נהמר!
        </button>
      </motion.div>

      {/* Credits Section */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mt-8 pt-8 border-t border-border flex flex-col items-center gap-6"
      >
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">יוצרי הפרויקט</p>
        
        <div className="flex flex-wrap justify-center gap-4 w-full">
          {/* Nir Dahan */}
          <a
            href="https://www.linkedin.com/in/nir-dahan01/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-secondary/50 hover:bg-secondary border border-border rounded-2xl px-5 py-3 transition-all group"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/20 group-hover:border-primary/50 transition-colors">
              <img src="https://media.licdn.com/dms/image/v2/D4E03AQE8S0_6Q2Qx3A/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1710344444444?e=1710344444&v=beta&t=444" alt="Nir Dahan" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = "https://ui-avatars.com/api/?name=Nir+Dahan&background=random"; }} />
            </div>
            <div className="flex flex-col text-right">
              <span className="text-sm font-black">ניר דהן</span>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <svg className="w-3 h-3 text-[#0a66c2]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
                <span>LinkedIn</span>
              </div>
            </div>
          </a>

          {/* Dor David */}
          <a
            href="https://www.linkedin.com/in/dor-david-/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-secondary/50 hover:bg-secondary border border-border rounded-2xl px-5 py-3 transition-all group"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/20 group-hover:border-primary/50 transition-colors">
              <img src="https://media.licdn.com/dms/image/v2/D4E03AQG_Q4Q4Q4Q4Q4/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1710344444444?e=1710344444&v=beta&t=444" alt="Dor David" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = "https://ui-avatars.com/api/?name=Dor+David&background=random"; }} />
            </div>
            <div className="flex flex-col text-right">
              <span className="text-sm font-black">דור דוד</span>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <svg className="w-3 h-3 text-[#0a66c2]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
                <span>LinkedIn</span>
              </div>
            </div>
          </a>
        </div>

        <p className="text-[10px] text-muted-foreground mb-4">
          © {new Date().getFullYear()} Kickoff Project. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
};

export default HelpPage;
