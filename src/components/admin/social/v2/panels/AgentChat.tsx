import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts?: number;
}

const QUICK_ACTIONS = [
  { label: '📊 סטטוס סוכנים', msg: 'מה הסטטוס הנוכחי של סוכני ה-V2?' },
  { label: '🚀 רעיונות ל-Hook', msg: 'תגיד ל-Strategy Agent לחשוב על hook לדרבי הקרוב.' },
  { label: '📈 בקשת אנליטיקס', msg: 'הבא לי ניתוח מתחרים לאפליקציה המתחרה.' },
];

export default function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'שלום! אני סוכן האסטרטגיה הראשי (V2). יש לך שאלה לגבי מהלך הפרסום הבא?', ts: Date.now() }
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
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setLoading(true);

    try {
      // Mocking endpoint for now (Day 3 focuses on UI rendering)
      // await fetch('/api/agents/chat', ... )
      setTimeout(() => {
         setMessages([...newMsgs, { role: 'assistant', content: 'קיבלתי. אני מעביר את ההנחיה לסוכני השטח שלי ואצור עבורך סקירה ראשונית בדקות הקרובות.', ts: Date.now() }]);
         setLoading(false);
      }, 1000);
    } catch (e: any) {
      setMessages([...newMsgs, { role: 'assistant', content: `❌ ${e.message}`, ts: Date.now() }]);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-l border-border relative">
      <div className="p-3 border-b border-border flex items-center gap-2 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur sticky top-0 z-10 text-sm font-bold">
        <Bot size={16} className="text-primary" /> Strategy Chat
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 text-sm ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`flex items-center justify-center h-8 w-8 rounded-full shrink-0 ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-slate-200 dark:bg-slate-800'}`}>
              {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div className={`p-3 rounded-2xl max-w-[85%] ${m.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-white dark:bg-slate-800 border border-border shadow-sm rounded-tl-none leading-relaxed whitespace-pre-wrap'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3 flex-row">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0">
              <Bot size={14} />
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border items-center justify-center flex shadow-sm rounded-tl-none">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length < 3 && (
        <div className="flex flex-wrap items-center justify-end gap-2 px-4 pb-2">
          {QUICK_ACTIONS.map(a => (
            <button key={a.label} onClick={() => send(a.msg)} className="text-xs bg-white dark:bg-slate-800 border shadow-sm px-3 py-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              {a.label}
            </button>
          ))}
        </div>
      )}

      <div className="p-3 border-t bg-background">
        <div className="relative">
          <input
            autoFocus
            className="w-full text-sm rounded-full bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:bg-background h-10 px-4 py-2 outline-none pr-10"
            placeholder="דבר עם מנהל הקמפיינים..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
          />
          <button onClick={() => send()} disabled={!input.trim() || loading} className="absolute right-1 top-1 bottom-1 h-8 w-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors">
            <Send size={14} className="ml-0.5 mt-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
