import React, { useState } from 'react';
import { Bot, Layers, MessageSquare, BarChart2, BookOpen, Eye, Settings, Zap } from 'lucide-react';
import { LiveWorkFeed } from './social/LiveWorkFeed';
import { ManagementChat } from './social/ManagementChat';
import { AgentStatusGrid } from './social/AgentStatusGrid';
import { PostHistoryGallery } from './social/PostHistoryGallery';
import { KnowledgeBaseManager } from './social/KnowledgeBaseManager';
import { SocialListeningFeed } from './social/SocialListeningFeed';
import { AgentConfigModal } from './social/AgentConfigModal';

type SocialSubTab = 'feed' | 'chat' | 'status' | 'history' | 'kb' | 'listening' | 'config';

const SUB_TABS: { id: SocialSubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'feed',      label: 'Work Feed 🔴',   icon: <Eye size={13} /> },
  { id: 'chat',      label: 'ניהול צ׳אט',     icon: <MessageSquare size={13} /> },
  { id: 'status',    label: 'סטטוס אייגנטים', icon: <Bot size={13} /> },
  { id: 'history',   label: 'היסטוריה',        icon: <Layers size={13} /> },
  { id: 'kb',        label: 'Knowledge Base',  icon: <BookOpen size={13} /> },
  { id: 'listening', label: 'Social Listening',icon: <BarChart2 size={13} /> },
  { id: 'config',    label: 'הגדרות',          icon: <Settings size={13} /> },
];

export const SocialAgentTab = () => {
  const [active, setActive] = useState<SocialSubTab>('feed');

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-sm">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <h2 className="font-black text-base leading-tight">סוכני סושיאל מדיה</h2>
            <p className="text-[10px] text-muted-foreground">Groq llama-3.3-70b · Gemini Imagen 3 · Nano Banana Pro</p>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-border pb-2 overflow-x-auto scrollbar-hide">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setActive(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
              active === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {active === 'feed'      && <LiveWorkFeed />}
        {active === 'chat'      && <ManagementChat />}
        {active === 'status'    && <AgentStatusGrid />}
        {active === 'history'   && <PostHistoryGallery />}
        {active === 'kb'        && <KnowledgeBaseManager />}
        {active === 'listening' && <SocialListeningFeed />}
        {active === 'config'    && <AgentConfigModal />}
      </div>
    </div>
  );
};
