import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/context/AppContext";
import TopBar from "@/components/TopBar";
import BottomTabBar from "@/components/BottomTabBar";
import HomePage from "@/pages/HomePage";
import GameDetailPage from "@/pages/GameDetailPage";
import BetSlipPage from "@/pages/BetSlipPage";
import LeaguesPage from "@/pages/LeaguesPage";
import QuizPage from "@/pages/QuizPage";
import ProfilePage from "@/pages/ProfilePage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen max-w-lg mx-auto relative">
    <TopBar />
    <main>{children}</main>
    <BottomTabBar />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppLayout><HomePage /></AppLayout>} />
            <Route path="/game/:gameId" element={<AppLayout><GameDetailPage /></AppLayout>} />
            <Route path="/betslip" element={<AppLayout><BetSlipPage /></AppLayout>} />
            <Route path="/leagues" element={<AppLayout><LeaguesPage /></AppLayout>} />
            <Route path="/quiz" element={<AppLayout><QuizPage /></AppLayout>} />
            <Route path="/profile" element={<AppLayout><ProfilePage /></AppLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
