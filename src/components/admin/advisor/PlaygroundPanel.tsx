import React, { useRef, useState } from 'react';
import { advisorPlaygroundStream } from '@/lib/api';
import { Send, Loader2, Wrench } from 'lucide-react';

type Message = { role: 'user' | 'assistant'; content: string };
type ToolEvent = { tool: string; args: Record<string, unknown> };

export const PlaygroundPanel = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolEvent[]>([]);
  const [thinkingStep, setThinkingStep] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setToolCalls([]);
    setThinkingStep('');

    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setLoading(true);

    let reply = '';
    setMessages(msgs => [...msgs, { role: 'assistant', content: '' }]);

    try {
      await advisorPlaygroundStream(newMessages, (type, data) => {
        const d = data as Record<string, unknown>;
        if (type === 'thinking') {
          setThinkingStep(String(d.step ?? ''));
        } else if (type === 'tool_call') {
          setToolCalls(tc => [...tc, { tool: String(d.tool), args: (d.args as Record<string, unknown>) ?? {} }]);
        } else if (type === 'token') {
          reply += String(d.delta ?? '');
          setMessages(msgs => {
            const updated = [...msgs];
            updated[updated.length - 1] = { role: 'assistant', content: reply };
            return updated;
          });
        } else if (type === 'done') {
          setThinkingStep('');
        } else if (type === 'error') {
          setMessages(msgs => {
            const updated = [...msgs];
            updated[updated.length - 1] = { role: 'assistant', content: `שגיאה: ${d.message}` };
            return updated;
          });
        }
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    } finally {
      setLoading(false);
      setThinkingStep('');
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <p className="text-xs text-muted-foreground">Playground עוקף את מגבלת השימוש היומית.</p>

      <div className="rounded-xl border border-border bg-card min-h-[320px] max-h-[480px] overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-10">שאל שאלה כדי לבדוק את הסוכן…</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
              m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}>
              {m.content || (loading && m.role === 'assistant' ? <span className="animate-pulse">…</span> : '')}
            </div>
          </div>
        ))}
        {thinkingStep && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" /> {thinkingStep}…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {toolCalls.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-1 text-xs font-bold mb-2"><Wrench size={12} /> Tool calls</div>
          {toolCalls.map((tc, i) => (
            <div key={i} className="text-xs font-mono text-muted-foreground">
              {tc.tool}({JSON.stringify(tc.args)})
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="כדאי להמר על ארסנל נגד צ׳לסי?"
          disabled={loading}
          className="flex-1 border border-border rounded-xl px-3 py-2 text-sm bg-background disabled:opacity-60"
        />
        <button onClick={send} disabled={loading || !input.trim()}
          className="bg-primary text-primary-foreground rounded-xl px-4 py-2 disabled:opacity-60 flex items-center gap-1.5 text-sm font-bold">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          שלח
        </button>
      </div>
    </div>
  );
};
