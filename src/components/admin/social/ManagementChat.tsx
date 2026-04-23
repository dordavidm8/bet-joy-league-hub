// admin/social/ManagementChat.tsx – צ'אט עם סוכנים
// ממשק צ'אט לשיחה ישירה עם managementChatAgent.
// הסוכן עונה על שאלות ניהול: ביצועים, המלצות, מצב pipeline.
import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User } from 'lucide-react';

const API = '/api/social';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts?: number;
}

async function sendMessage(messages: Message[]): Promise<string> {
  const r = await fetch(`${API}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!r.ok) throw new Error(await r.text());
  const d = await r.json();
  return d.reply ?? d.message ?? '';
}

const QUICK_ACTIONS = [
  { label: '📊 סטטוס מערכת', msg: 'מה הסטטוס הנוכחי של מערכת הסושיאל מדיה?' },
  { label: '🚀 הפעל pipeline', msg: 'הפעל את ה-pipeline היומי כעת' },
  { label: '📅 לוח שנה', msg: 'מה הנושא השבועי הנוכחי ומה מתוכנן?' },
  { label: '📈 אנליטיקס', msg: 'תן לי סיכום ביצועים של הפוסטים האחרונים' },
];

export const ManagementChat = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'שלום! אני מנהל הסוכנים. אוכל לעזור לך לנהל את הסושיאל מדיה של KickOff. מה תרצה לעשות?', ts: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text?: string) => {
    const content = text ?? input.trim();
    if (!content || loading) return;
    setInput('');

    const userMsg: Message = { role: 'user', content, ts: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const reply = await sendMessage(newMessages);
      setMessages(prev => [...prev, { role: 'assistant', content: reply, ts: Date.now() }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ שגיאה: ${e.message}`, ts: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 h-[600px]">
      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map(a => (
          <button key={a.label} onClick={() => send(a.msg)}
            className="text-xs font-medium border rounded-full px-3 py-1.5 hover:bg-secondary transition-colors">
            {a.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={14} className="text-white" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              m.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-tr-sm'
                : 'bg-secondary rounded-tl-sm'
            }`} dir="auto">
              {m.content}
            </div>
            {m.role === 'user' && (
              <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <User size={14} className="text-primary" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shrink-0">
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-secondary rounded-2xl rounded-tl-sm px-4 py-2.5 flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="שלח הוראה לאייגנטים..."
          dir="rtl"
          className="flex-1 bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/30 transition-all"
        />
        <button type="submit" disabled={!input.trim() || loading}
          className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
};
