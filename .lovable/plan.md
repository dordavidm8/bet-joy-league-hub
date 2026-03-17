

## Plan: Connect Frontend to Real Backend API

### Current State
The frontend currently uses **only mock data** (`src/lib/mockData.ts`) with no API calls whatsoever. All data (games, bets, leagues, quiz, user points) is hardcoded. There is no API client or HTTP layer in the frontend.

The backend is deployed at `https://bet-joy-league-hub-production.up.railway.app` with endpoints like `/api/games`, `/api/bets`, `/api/leagues`, `/api/quiz`, `/api/leaderboard`, `/api/users`, `/api/auth`.

### What We'll Build

1. **Create an API client module** (`src/lib/api.ts`)
   - Base URL: `https://bet-joy-league-hub-production.up.railway.app`
   - Typed fetch wrapper with error handling
   - Auth token header support (for future Firebase auth integration)
   - Functions for each endpoint: `getGames()`, `getGameById()`, `placeBet()`, `getLeagues()`, `getLeaderboard()`, `getQuiz()`, `getUserProfile()`, etc.

2. **Create React Query hooks** (`src/hooks/useApi.ts`)
   - Install `@tanstack/react-query`
   - Add `QueryClientProvider` to `App.tsx`
   - Hooks: `useGames()`, `useGame(id)`, `useLeagues()`, `useLeaderboard()`, `useQuizQuestions()`, `usePlaceBet()`, etc.
   - Fallback to mock data if API calls fail (graceful degradation)

3. **Update pages to use real data**
   - `HomePage.tsx` → fetch games from API, show loading states
   - `GameDetailPage.tsx` → fetch game + bet questions from API
   - `BetSlipPage.tsx` → submit bets via API
   - `LeaguesPage.tsx` → fetch leagues from API
   - `QuizPage.tsx` → fetch quiz questions from API
   - `ProfilePage.tsx` → fetch user stats from API
   - `ExpertChatPage.tsx` → send questions to API (if endpoint exists, else keep mock)

4. **Update AppContext** to sync user points from API and handle auth token storage

### Technical Details
- API base URL stored as a constant in `src/lib/api.ts`
- All API responses will be typed based on existing TypeScript interfaces in `mockData.ts`
- Loading skeletons and error states added to each page
- Mock data kept as fallback

