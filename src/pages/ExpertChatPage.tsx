import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Sparkles, TrendingUp, BarChart3 } from "lucide-react";
import { mockGames } from "@/lib/mockData";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  stats?: StatCard[];
  timestamp: Date;
}

interface StatCard {
  label: string;
  value: string;
  icon: "trend" | "chart";
}

const mockExpertResponses: Record<string, { content: string; stats: StatCard[] }> = {
  default: {
    content: "שלום! אני המומחה שלך להימורי ספורט 🧠\nשאל אותי על כל משחק — אני אציג לך סטטיסטיקות מתקדמות, מגמות וניתוחים שיעזרו לך להחליט.\n\nנסה לשאול: \"מי ינצח בין מכבי תל אביב להפועל באר שבע?\"",
    stats: [],
  },
  win: {
    content: "בהתבסס על הנתונים, הנה הניתוח שלי:",
    stats: [
      { label: "ניצחונות בבית (5 אחרונים)", value: "4/5 (80%)", icon: "trend" },
      { label: "ממוצע שערים למשחק", value: "2.4", icon: "chart" },
      { label: "מפגשים ישירים אחרונים", value: "3W-1D-1L", icon: "trend" },
      { label: "אחוז החזקת כדור", value: "58%", icon: "chart" },
    ],
  },
  goals: {
    content: "הנה הסטטיסטיקות על שערים:",
    stats: [
      { label: "ממוצע שערים במשחק", value: "2.7", icon: "chart" },
      { label: "מעל 2.5 שערים", value: "67% מהמשחקים", icon: "trend" },
      { label: "שני הצדדים מבקיעים", value: "55%", icon: "chart" },
      { label: "שער ראשון לפני דקה 30", value: "72%", icon: "trend" },
    ],
  },
  corners: {
    content: "סטטיסטיקות קרנות:",
    stats: [
      { label: "ממוצע קרנות למשחק", value: "9.3", icon: "chart" },
      { label: "מעל 8.5 קרנות", value: "61%", icon: "trend" },
      { label: "קרנות מחצית ראשונה", value: "4.1 ממוצע", icon: "chart" },
      { label: "קבוצת בית - ממוצע קרנות", value: "5.8", icon: "trend" },
    ],
  },
};

function getExpertResponse(message: string): { content: string; stats: StatCard[] } {
  const lower = message.toLowerCase();
  if (lower.includes("שער") || lower.includes("גול") || lower.includes("יבקיע")) {
    return mockExpertResponses.goals;
  }
  if (lower.includes("קרנ") || lower.includes("קורנר")) {
    return mockExpertResponses.corners;
  }
  if (lower.includes("ינצח") || lower.includes("מי") || lower.includes("תוצאה") || lower.includes("מנצח")) {
    return mockExpertResponses.win;
  }
  return {
    content: `ניתוח מעניין! הנה מה שאני רואה בנתונים לגבי "${message}":`,
    stats: [
      { label: "מגמה אחרונה", value: "חיובית ↑", icon: "trend" },
      { label: "רמת ביטחון", value: "68%", icon: "chart" },
      { label: "דגימת משחקים", value: "42 משחקים", icon: "chart" },
    ],
  };
}

const suggestedQuestions = [
  "מי ינצח היום?",
  "כמה שערים יהיו?",
  "כמה קרנות צפויות?",
  "איזו קבוצה בפורמה הכי טובה?",
];

const ExpertChatPage = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: mockExpertResponses.default.content,
      stats: [],
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const response = getExpertResponse(text);
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.content,
        stats: response.stats,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot size={22} className="text-primary" />
          </div>
          <div>
            <h1 className="font-black text-base">שאל את המומחה</h1>
            <p className="text-xs text-muted-foreground">סטטיסטיקות מתקדמות • ניתוח משחקים</p>
          </div>
          <div className="mr-auto">
            <span className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              פעיל
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                  msg.role === "assistant"
                    ? "bg-primary/10"
                    : "bg-secondary"
                }`}
              >
                {msg.role === "assistant" ? (
                  <Sparkles size={14} className="text-primary" />
                ) : (
                  <User size={14} className="text-muted-foreground" />
                )}
              </div>

              <div
                className={`flex flex-col gap-2 max-w-[80%] ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-secondary text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>

                {/* Stat Cards */}
                {msg.stats && msg.stats.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 w-full">
                    {msg.stats.map((stat, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 + i * 0.08 }}
                        className="bg-card border border-border rounded-xl p-3 flex flex-col gap-1"
                      >
                        <div className="flex items-center gap-1.5">
                          {stat.icon === "trend" ? (
                            <TrendingUp size={12} className="text-primary" />
                          ) : (
                            <BarChart3 size={12} className="text-primary" />
                          )}
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {stat.label}
                          </span>
                        </div>
                        <span className="text-sm font-black">{stat.value}</span>
                      </motion.div>
                    ))}
                  </div>
                )}

                <span className="text-[10px] text-muted-foreground">
                  {msg.timestamp.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles size={14} className="text-primary" />
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

      {/* Suggested questions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {suggestedQuestions.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="text-xs bg-secondary text-foreground px-3 py-1.5 rounded-full font-medium hover:bg-secondary/80 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-border">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="שאל על משחק, קבוצה או סטטיסטיקה..."
            className="flex-1 bg-secondary rounded-full px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
            disabled={isTyping}
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity"
          >
            <Send size={18} />
          </button>
        </form>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          ⚠️ בהתבסס על נתוני העבר בלבד. אין זה מהווה ייעוץ הימורים.
        </p>
      </div>
    </div>
  );
};

export default ExpertChatPage;
