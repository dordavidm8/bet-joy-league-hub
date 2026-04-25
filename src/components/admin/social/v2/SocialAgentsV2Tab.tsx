import React from 'react';
import AgentRoster from './panels/AgentRoster';
import PipelineTimeline from './panels/PipelineTimeline';
import AgentChat from './panels/AgentChat';
import DraftsInbox from './panels/DraftsInbox';

export default function SocialAgentsV2Tab() {
  return (
    <div className="flex h-[calc(100vh-100px)] bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden mt-4">
      {/* שמאל: Roster */}
      <div className="w-1/4 min-w-[280px] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto hidden md:block">
        <AgentRoster />
      </div>

      {/* אמצע: Engine/Pipeline & Chat */}
      <div className="flex-1 flex flex-col min-w-[400px]">
        {/* עליון: Timeline */}
        <div className="h-1/2 border-b border-gray-200 dark:border-gray-700 p-4 overflow-y-auto bg-gray-50 dark:bg-gray-900">
           <PipelineTimeline />
        </div>
        {/* תחתון: Chat */}
        <div className="h-1/2 bg-white dark:bg-gray-800">
           <AgentChat />
        </div>
      </div>

      {/* ימין: Outbox / Drafts */}
      <div className="w-1/4 min-w-[300px] bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 overflow-y-auto hidden lg:block">
        <DraftsInbox />
      </div>
    </div>
  );
}
