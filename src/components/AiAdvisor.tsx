// AiAdvisor.tsx – קומפוננטת צ'אט יועץ AI
// מציג היסטוריית שיחה ושדה קלט.
// שולח הודעות ל-GET /advisor/:gameId/stream (SSE streaming).
// מציג chunks של תגובה בזמן אמת כשה-LLM מייצר אותם.
// מוגבל ל-20 הודעות ליום (מספר הודעות שנותרו מוצג).
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles, User } from "lucide-react";
import { askAdvisor, AdvisorMessage } from "@/lib/api";

interface AiAdvisorProps {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  onClose: () => void;
}

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

const WELCOME = (home: string, away: string) =>
  `שלום! אני יועץ ה-AI של Kickoff 🤖\nאני כאן לעזור לך עם המשחק **${home}** נגד **${away}**.\nשאל אותי על תחזית, אודס, או כל דבר שיעזור לך להחליט. הניתוח מבוסס על הנתונים הזמינים בלבד.`;

const AiAdvisor = ({ gameId, homeTeam, awayTeam, onClose }: AiAdvisorProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: WELCOME(homeTeam, awayTeam),
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

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

    try {
      // Send only role+content to the backend (no id/timestamp)
      const apiMessages: AdvisorMessage[] = nextMessages.map(({ role, content }) => ({ role, content }));
      const { reply, remaining: rem } = await askAdvisor(gameId, apiMessages);

      setRemaining(rem);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: reply,
          timestamp: new Date(),
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: err?.message === "הגעת למגבלת השימוש היומית (20 הודעות)"
            ? "הגעת למגבלת ה-20 הודעות להיום. נתראה מחר! 👋"
            : "אירעה שגיאה. נסה שוב בעוד רגע.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-foreground/20 z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="absolute bottom-0 left-0 right-0 bg-card rounded-t-[24px] flex flex-col"
          style={{ maxHeight: "80vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-border flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles size={18} className="text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-black text-sm">יועץ AI</h3>
              <p className="text-[10px] text-muted-foreground">
                {homeTeam} נגד {awayTeam}
                {remaining !== null && ` · ${remaining} הודעות נותרו`}
              </p>
            </div>
            <button onClick={onClose} className="text-muted-foreground p-1">
              <X size={20} />
            </button>
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

            {/* Typing indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2"
              >
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles size={13} className="text-primary" />
                </div>
                <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-3 flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested questions — only before first real user message */}
          {messages.filter((m) => m.role === "user").length === 0 && (
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
          <div className="px-4 pb-5 pt-2 border-t border-border shrink-0">
            <form
              onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="שאל על המשחק..."
                className="flex-1 bg-secondary rounded-full px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity"
              >
                <Send size={17} />
              </button>
            </form>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              ⚠️ בהתבסס על נתוני עבר בלבד. אין זה מהווה ייעוץ הימורים.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AiAdvisor;
