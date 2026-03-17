import { Home, Trophy, FileText, HelpCircle, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";

const tabs = [
  { path: "/", icon: Home, label: "בית" },
  { path: "/leagues", icon: Trophy, label: "ליגות" },
  { path: "/betslip", icon: FileText, label: "תלוש" },
  { path: "/quiz", icon: HelpCircle, label: "חידון" },
  { path: "/profile", icon: User, label: "פרופיל" },
];

const BottomTabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { betSlip } = useApp();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card shadow-elevated z-50 safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          const hasBadge = tab.path === "/betslip" && betSlip.length > 0;

          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors duration-200 relative ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {hasBadge && (
                  <span className="absolute -top-1 -left-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                    {betSlip.length}
                  </span>
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
