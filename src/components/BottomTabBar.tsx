// BottomTabBar.tsx – ניווט תחתון למובייל
// 5 tabs: בית, ליגות, הימורים, מיני-גיימס, פרופיל.
// מוצגת רק במסכים קטנים. מדגישה את ה-tab הפעיל.
import { Home, Trophy, FileText, HelpCircle, User, Bot, Gamepad2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";

const tabs = [
  { path: "/", icon: Home, label: "בית", guestAllowed: true },
  { path: "/leagues", icon: Trophy, label: "ליגות", guestAllowed: true },
  { path: "/minigames", icon: Gamepad2, label: "אתגרים", guestAllowed: false },
  { path: "/betslip", icon: FileText, label: "תלוש", guestAllowed: false },
  { path: "/expert", icon: Bot, label: "מומחה", guestAllowed: false },
  { path: "/profile", icon: User, label: "פרופיל", guestAllowed: false },
];

const BottomTabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { betSlip } = useApp();
  const { backendUser, isGuest, exitGuest } = useAuth();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card shadow-elevated z-50 safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg md:max-w-7xl md:px-8 mx-auto">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          const hasBadge = tab.path === "/betslip" && betSlip.length > 0;
          const isAiLocked = tab.path === "/expert" && !isGuest && !['nirdahan', 'dordavidm8'].includes(backendUser?.username);
          const isGuestLocked = isGuest && !tab.guestAllowed;

          return (
            <button
              key={tab.path}
              onClick={() => {
                if (isGuestLocked) {
                  exitGuest();
                  return;
                }
                if (isAiLocked) {
                  alert("תכונה זו בשלבי הרצה וזמינה כרגע למנהלים בלבד.");
                  return;
                }
                navigate(tab.path);
              }}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors duration-200 relative ${
                isActive ? "text-primary" : "text-muted-foreground"
              } ${isAiLocked ? "opacity-50 grayscale" : ""}`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {hasBadge && (
                  <span className="absolute -top-1 -left-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                    {betSlip.length}
                  </span>
                )}
                {isAiLocked && (
                  <span className="absolute -top-1 -left-2 text-[10px]">🔒</span>
                )}
              </div>
              <span className="text-[11px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomTabBar;
