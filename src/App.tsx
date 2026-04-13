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
import PublicProfilePage from "@/pages/PublicProfilePage";
import BetHistoryPage from "@/pages/BetHistoryPage";
import StatsPage from "@/pages/StatsPage";
import { Navigate } from "react-router-dom";
import { useState } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";

const queryClient = new QueryClient();

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen max-w-lg mx-auto relative">
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
  const { firebaseUser, loading } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState(
    () => !!localStorage.getItem("kickoff_onboarding_done")
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">טוען...</div>;
  if (!firebaseUser) return <LoginPage />;
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
      <Route path="/admin" element={
        ADMIN_EMAILS.includes(firebaseUser?.email ?? "")
          ? <AdminDashboard />
          : <Navigate to="/" replace />
      } />
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
