import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, User, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getGames, askAdvisorStream, AdvisorMessage, Game } from "@/lib/api";

interface ChatMessage extends AdvisorMessage {
  id: string;
  timestamp: Date;
}

const SUGGESTED = [
  "על מי כדאי להמר?",
  "כמה שערים צפויים?",
  "מה הסיכוי שיהיה תיקו?",
  "איזו קבוצה בפורמה טובה יותר?",
];

const WELCOME_GENERIC = `שלום! אני יועץ ה-AI של Kickoff 🤖\nבחר משחק למעלה ואני אעזור לך לנתח אותו לפני שתמר.`;

const WELCOME_GAME = (home: string, away: string) =>
  `מוכן לנתח את **${home}** נגד **${away}**! שאל אותי כל דבר שיעזור לך להחליט.`;

const ExpertChatPage = () => {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", content: WELCOME_GENERIC, timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [thinkingStep, setThinkingStep] = useState<string>('');
  const [showPicker, setShowPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["games-advisor"],
    queryFn: () => getGames({ status: "scheduled" }),
  });
  const upcomingGames = data?.games ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSelectGame = (game: Game) => {
    setSelectedGame(game);
    setShowPicker(false);
    setMessages([
      { id: "welcome", role: "assistant", content: WELCOME_GAME(game.home_team, game.away_team), timestamp: new Date() },
    ]);
    setRemaining(null);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading || !selectedGame) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    const nextMessages = [...messages.filter((m) => m.id !== "welcome"), userMsg];
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setThinkingStep("מתכנן...");

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", timestamp: new Date() }]);

    try {
      const apiMessages: AdvisorMessage[] = nextMessages.map(({ role, content }) => ({ role, content }));
      let reply = "";

      await askAdvisorStream(selectedGame.id, apiMessages, (type, data) => {
        if (type === "thinking") {
          const step = data.step as string;
          setThinkingStep(step === "planning" ? "מתכנן..." : step === "reflecting" ? "מעבד נתונים..." : "מסכם...");
        } else if (type === "tool_call") {
          const toolLabels: Record<string, string> = {
            get_team_form: "מחפש פורמה...",
            get_head_to_head: "מחפש היסטוריית מפגשים...",
            get_upcoming_games: "מחפש משחקים קרובים...",
            get_match_odds: "מחפש הימורים...",
            get_live_stats: "מחפש נתוני חי...",
          };
          setThinkingStep(toolLabels[data.tool as string] ?? "מחפש נתונים...");
        } else if (type === "token") {
          reply += data.delta as string;
          setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: reply } : m));
        } else if (type === "done") {
          setRemaining((prev) => (prev !== null ? prev - 1 : null));
          setThinkingStep("");
        } else if (type === "error") {
          setMessages((prev) => prev.map((m) =>
            m.id === assistantId ? { ...m, content: "אירעה שגיאה. נסה שוב בעוד רגע." } : m
          ));
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId ? {
          ...m,
          content: msg.includes("20 הודעות")
            ? "הגעת למגבלת ה-20 הודעות להיום. נתראה מחר! 👋"
            : "אירעה שגיאה. נסה שוב בעוד רגע.",
        } : m
      ));
    } finally {
      setIsLoading(false);
      setThinkingStep("");
    }
  };

  const userMessageCount = messages.filter((m) => m.role === "user").length;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles size={20} className="text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="font-black text-base">שאל את המומחה</h1>
            <p className="text-xs text-muted-foreground">
              {remaining !== null ? `${remaining} הודעות נותרו היום` : "ניתוח משחקים · מבוסס AI"}
            </p>
          </div>
          <span className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            פעיל
          </span>
        </div>

        {/* Game picker */}
        <div className="relative">
          <button
            onClick={() => setShowPicker((v) => !v)}
            className="w-full flex items-center justify-between bg-secondary rounded-xl px-4 py-2.5 text-sm font-medium"
          >
            <span className={selectedGame ? "text-foreground" : "text-muted-foreground"}>
              {selectedGame
                ? `${selectedGame.home_team} נגד ${selectedGame.away_team}`
                : "בחר משחק לניתוח..."}
            </span>
            <ChevronDown
              size={16}
              className={`text-muted-foreground transition-transform ${showPicker ? "rotate-180" : ""}`}
            />
          </button>

          <AnimatePresence>
            {showPicker && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-xl shadow-elevated z-10 max-h-52 overflow-y-auto"
              >
                {upcomingGames.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-4 py-3">אין משחקים מתוכננים</p>
                ) : (
                  upcomingGames.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => handleSelectGame(g)}
                      className="w-full text-right px-4 py-3 text-sm hover:bg-secondary transition-colors flex flex-col gap-0.5 border-b border-border last:border-0"
                    >
                      <span className="font-semibold">{g.home_team} נגד {g.away_team}</span>
                      <span className="text-xs text-muted-foreground">
                        {g.competition_name} · {new Date(g.start_time).toLocaleDateString("he-IL")}
                      </span>
                    </button>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                  msg.role === "assistant" ? "bg-primary/10" : "bg-secondary"
                }`}
              >
                {msg.role === "assistant" ? (
                  <Sparkles size={13} className="text-primary" />
                ) : (
                  <User size={13} className="text-muted-foreground" />
                )}
              </div>
              <div
                className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line max-w-[80%] ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-secondary text-foreground rounded-bl-md"
                }`}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Thinking step indicator */}
        {isLoading && thinkingStep && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-xs text-muted-foreground px-1"
          >
            <Sparkles size={12} className="text-primary animate-pulse shrink-0" />
            {thinkingStep}
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested questions */}
      {selectedGame && userMessageCount === 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2 shrink-0">
          {SUGGESTED.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              disabled={isLoading}
              className="text-xs bg-secondary text-foreground px-3 py-1.5 rounded-full font-medium hover:bg-secondary/80 transition-colors disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-border shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={selectedGame ? "שאל על המשחק..." : "בחר משחק קודם..."}
            maxLength={500}
            className="flex-1 bg-secondary rounded-full px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-shadow disabled:opacity-50"
            disabled={isLoading || !selectedGame}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || !selectedGame}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity"
          >
            <Send size={17} />
          </button>
        </form>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          ⚠️ בהתבסס על נתוני עבר בלבד. אין זה מהווה ייעוץ הימורים.
        </p>
      </div>
    </div>
  );
};

export default ExpertChatPage;
