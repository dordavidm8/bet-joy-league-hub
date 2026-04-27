import React from 'react';
import AgentRoster from './panels/AgentRoster';
import PipelineTimeline from './panels/PipelineTimeline';
import AgentChat from './panels/AgentChat';
import DraftsInbox from './panels/DraftsInbox';
import KnowledgePanel from './panels/KnowledgePanel';
import IssuesBoard from './panels/IssuesBoard';
import CompanySwitcher from './panels/CompanySwitcher';
import ApprovalsInbox from './panels/ApprovalsInbox';
import { Users, Brain, LayoutGrid, Activity, Inbox } from 'lucide-react';

export default function SocialAgentsV2Tab() {
  const [leftTab, setLeftTab] = React.useState<'roster' | 'knowledge'>('roster');
  const [centerTab, setCenterTab] = React.useState<'pipeline' | 'issues' | 'approvals'>('issues');

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] mt-4">
      {/* Header Area ... existing ... */}
      <div className="flex justify-between items-center mb-4 px-1">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">
            Mission Control <span className="text-xs font-mono bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full ml-2">PAPERCLIP v2</span>
          </h2>
        </div>
        <CompanySwitcher />
      </div>

      <div className="flex-1 flex bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        {/* שמאל: Roster & Knowledge */}
        <div className="w-1/4 min-w-[300px] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col hidden md:flex">
          <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <button 
              onClick={() => setLeftTab('roster')}
              className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-bold transition-all ${leftTab === 'roster' ? 'bg-white dark:bg-gray-800 border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <Users className="w-4 h-4" />
              סגל סוכנים
            </button>
            <button 
              onClick={() => setLeftTab('knowledge')}
              className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-bold transition-all ${leftTab === 'knowledge' ? 'bg-white dark:bg-gray-800 border-b-2 border-purple-500 text-purple-600' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <Brain className="w-4 h-4" />
              בסיס ידע
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {leftTab === 'roster' ? <AgentRoster /> : <KnowledgePanel />}
          </div>
        </div>

        {/* אמצע: Engine/Pipeline & Chat */}
        <div className="flex-1 flex flex-col min-w-[400px] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
          {/* עליון: Tabs Selector */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button 
              onClick={() => setCenterTab('issues')}
              className={`px-6 py-3 flex items-center gap-2 text-sm font-bold transition-all ${centerTab === 'issues' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <LayoutGrid className="w-4 h-4" />
              לוח משימות
            </button>
            <button 
              onClick={() => setCenterTab('pipeline')}
              className={`px-6 py-3 flex items-center gap-2 text-sm font-bold transition-all ${centerTab === 'pipeline' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <Activity className="w-4 h-4" />
              Timeline
            </button>
            <button 
              onClick={() => setCenterTab('approvals')}
              className={`px-6 py-3 flex items-center gap-2 text-sm font-bold transition-all ${centerTab === 'approvals' ? 'border-b-2 border-red-500 text-red-600' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <Inbox className="w-4 h-4" />
              אישורים
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
             {centerTab === 'issues' ? <IssuesBoard /> : 
              centerTab === 'approvals' ? <ApprovalsInbox /> : 
              <PipelineTimeline />}
          </div>

          {/* תחתון: Chat */}
          <div className="h-1/3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
             <AgentChat />
          </div>
        </div>

        {/* ימין: Outbox / Drafts */}
        <div className="w-1/4 min-w-[300px] bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 overflow-y-auto hidden lg:block">
          <DraftsInbox />
        </div>
      </div>
    </div>
  );
}
