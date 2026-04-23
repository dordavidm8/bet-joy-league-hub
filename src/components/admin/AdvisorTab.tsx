// admin/AdvisorTab.tsx – לשונית ניהול יועץ AI
// מכילה 4 פאנלים פנימיים:
//   ConfigPanel    – מודל, טמפרטורה, מגבלת הודעות, system prompt
//   ApiKeysPanel   – ניהול מפתחות API מוצפנים (Groq, Odds API, etc.)
//   PlaygroundPanel– בדיקת היועץ בזמן אמת מה-Admin Dashboard
//   StatsPanel     – מדדי שימוש: הודעות, tokens, שגיאות
import React, { useState } from 'react';
import { Bot, BarChart2, Settings, Terminal, Key } from 'lucide-react';
import { StatsPanel } from './advisor/StatsPanel';
import { ConfigPanel } from './advisor/ConfigPanel';
import { PlaygroundPanel } from './advisor/PlaygroundPanel';
import { ApiKeysPanel } from './advisor/ApiKeysPanel';

type SubTab = 'stats' | 'config' | 'playground' | 'keys';

const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'stats',      label: 'סטטיסטיקות', icon: <BarChart2 size={13} /> },
  { id: 'config',     label: 'הגדרות',     icon: <Settings size={13} /> },
  { id: 'playground', label: 'Playground', icon: <Terminal size={13} /> },
  { id: 'keys',       label: 'API Keys',   icon: <Key size={13} /> },
];

export const AdvisorTab = () => {
  const [active, setActive] = useState<SubTab>('stats');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Bot size={18} className="text-primary" />
        <h2 className="font-black text-base">יועץ AI</h2>
      </div>

      <div className="flex gap-1 border-b border-border pb-2">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setActive(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              active === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div>
        {active === 'stats'      && <StatsPanel />}
        {active === 'config'     && <ConfigPanel />}
        {active === 'playground' && <PlaygroundPanel />}
        {active === 'keys'       && <ApiKeysPanel />}
      </div>
    </div>
  );
};
