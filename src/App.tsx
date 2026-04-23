import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import TopBar from "@/components/TopBar";
import BottomTabBar from "@/components/BottomTabBar";
import HomePage from "@/pages/HomePage";
import GameDetailPage from "@/pages/GameDetailPage";
import BetSlipPage from "@/pages/BetSlipPage";
import LeaguesPage from "@/pages/LeaguesPage";
import LeagueDetailPage from "@/pages/LeagueDetailPage";
import QuizPage from "@/pages/QuizPage";
import ProfilePage from "@/pages/ProfilePage";
import ExpertChatPage from "@/pages/ExpertChatPage";
import LoginPage from "@/pages/LoginPage";
import OnboardingPage from "@/pages/OnboardingPage";
import NotFound from "./pages/NotFound.tsx";
import AllGamesPage from "@/pages/AllGamesPage";
import FinishedGamesPage from "@/pages/FinishedGamesPage";
import MiniGamesHubPage from "@/pages/MiniGamesHubPage";
import MiniGamePlayPage from "@/pages/MiniGamePlayPage";
import AdminDashboard, { ADMIN_EMAILS } from "@/pages/AdminDashboard";
import ScrollToTop from "@/components/ScrollToTop";
import PublicProfilePage from "@/pages/PublicProfilePage";
import BetHistoryPage from "@/pages/BetHistoryPage";
import StatsPage from "@/pages/StatsPage";
import HelpPage from "@/pages/HelpPage";
import { Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminGetMe, getApprovedTeamTranslations } from "@/lib/api";
import { setDynamicTranslations } from "@/lib/teamNames";
import ErrorBoundary from "@/components/ErrorBoundary";

const BlockedScreen = () => {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white gap-6 p-8" dir="rtl">
      <div className="text-6xl">🚫</div>
      <div className="text-center flex flex-col gap-2">
        <h1 className="text-xl font-black">אין גישה לאפליקציה</h1>
        <p className="text-gray-400 text-sm max-w-xs">החשבון שלך אינו מורשה להיכנס. פנה למנהל המערכת.</p>
      </div>
      <button
        onClick={signOut}
        className="mt-2 text-sm text-gray-500 underline hover:text-gray-300 transition-colors"
      >
        התנתק וחזור למסך הכניסה
      </button>
    </div>
  );
};

const AdminRoute = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-me"],
    queryFn: adminGetMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">בודק הרשאות...</div>;
  if (isError || !data?.is_admin) return <Navigate to="/" replace />;
  return <AdminDashboard />;
};

const queryClient = new QueryClient();

// Loads approved dynamic team translations from DB once on startup
function DynamicTranslationsLoader() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['team-translations'],
    queryFn: getApprovedTeamTranslations,
    staleTime: 10 * 60 * 1000,
  });
  useEffect(() => {
    if (data?.translations) {
      setDynamicTranslations(data.translations);
      // Force game components to re-render so they pick up the updated translations
      queryClient.invalidateQueries({ queryKey: ['games'] });
      queryClient.invalidateQueries({ queryKey: ['game'] });
      queryClient.invalidateQueries({ queryKey: ['finished-games'] });
      queryClient.invalidateQueries({ queryKey: ['all-games'] });
    }
  }, [data, queryClient]);
  return null;
}

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen max-w-lg md:max-w-7xl mx-auto relative">
    <TopBar />
    <main>{children}</main>
    <div className="pb-16" />
    <BottomTabBar />
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none" style={{ bottom: '64px' }}>
      <span className="text-[9px] text-muted-foreground/40 pb-0.5">
        v{import.meta.env.VITE_GIT_HASH ?? "dev"}
      </span>
    </div>
  </div>
);

function AuthGate() {
  const { firebaseUser, loading, isGuest } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState(
    () => !!localStorage.getItem("kickoff_onboarding_done")
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">טוען...</div>;
  if (!firebaseUser && !isGuest) return <LoginPage />;

  if (isGuest) {
    return (
      <Routes>
        <Route path="/" element={<AppLayout><HomePage /></AppLayout>} />
        <Route path="/game/:gameId" element={<AppLayout><GameDetailPage /></AppLayout>} />
        <Route path="/games" element={<AppLayout><AllGamesPage /></AppLayout>} />
        <Route path="/games/finished" element={<AppLayout><FinishedGamesPage /></AppLayout>} />
        <Route path="/leagues" element={<AppLayout><LeaguesPage /></AppLayout>} />
        <Route path="/leagues/:leagueId" element={<AppLayout><LeagueDetailPage /></AppLayout>} />
        <Route path="/profile/:username" element={<AppLayout><PublicProfilePage /></AppLayout>} />
        <Route path="/help" element={<AppLayout><HelpPage /></AppLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (!onboardingDone) return <OnboardingPage onDone={() => setOnboardingDone(true)} />;

  return (
    <Routes>
      <Route path="/" element={<AppLayout><HomePage /></AppLayout>} />
      <Route path="/game/:gameId" element={<AppLayout><GameDetailPage /></AppLayout>} />
      <Route path="/games" element={<AppLayout><AllGamesPage /></AppLayout>} />
      <Route path="/games/finished" element={<AppLayout><FinishedGamesPage /></AppLayout>} />
      <Route path="/betslip" element={<AppLayout><BetSlipPage /></AppLayout>} />
      <Route path="/minigames" element={<AppLayout><MiniGamesHubPage /></AppLayout>} />
      <Route path="/minigames/play/:id" element={<AppLayout><MiniGamePlayPage /></AppLayout>} />
      <Route path="/leagues" element={<AppLayout><LeaguesPage /></AppLayout>} />
      <Route path="/leagues/:leagueId" element={<AppLayout><LeagueDetailPage /></AppLayout>} />
      <Route path="/quiz" element={<AppLayout><QuizPage /></AppLayout>} />
      <Route path="/expert" element={<AppLayout><ExpertChatPage /></AppLayout>} />
      <Route path="/profile" element={<AppLayout><ProfilePage /></AppLayout>} />
      <Route path="/profile/:username" element={<AppLayout><PublicProfilePage /></AppLayout>} />
      <Route path="/bets" element={<AppLayout><BetHistoryPage /></AppLayout>} />
      <Route path="/stats" element={<AppLayout><StatsPage /></AppLayout>} />
      <Route path="/help" element={<AppLayout><HelpPage /></AppLayout>} />
      <Route path="/admin" element={<AdminRoute />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <DynamicTranslationsLoader />
            <ErrorBoundary>
              <AuthGate />
            </ErrorBoundary>
          </BrowserRouter>
        </AuthProvider>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
