import React, { useState, useEffect } from 'react';
import { Book, Brain, Info } from 'lucide-react';

interface KnowledgeAsset {
  id: string;
  title: string;
  asset_type: string;
  metadata: any;
  created_at: string;
}

interface AgentMemory {
  id: string;
  skill_name: string;
  entity_key: string;
  content: string;
  memory_type: string;
  importance_score: number;
  created_at: string;
}

export default function KnowledgePanel() {
  const [assets, setAssets] = useState<KnowledgeAsset[]>([]);
  const [memories, setMemories] = useState<AgentMemory[]>([]);
  const [activeTab, setActiveTab] = useState<'knowledge' | 'memories'>('knowledge');

  useEffect(() => {
    fetch('/api/agents/knowledge')
      .then(res => res.json())
      .then(data => setAssets(data.assets || []));

    fetch('/api/agents/memories')
      .then(res => res.json())
      .then(data => setMemories(data.memories || []));
  }, []);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-500" />
          <span>Paperclip Intelligence</span>
        </h3>
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('knowledge')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${activeTab === 'knowledge' ? 'border-b-2 border-purple-500 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          נכסי ידע ({assets.length})
        </button>
        <button
          onClick={() => setActiveTab('memories')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${activeTab === 'memories' ? 'border-b-2 border-purple-500 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          זכרונות סוכנים ({memories.length})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'knowledge' ? (
          assets.map(asset => (
            <div key={asset.id} className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-2">
                <Book className="w-4 h-4 text-purple-600" />
                <span className="font-bold text-sm">{asset.title}</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-purple-200 dark:bg-purple-800 rounded uppercase font-bold text-purple-700 dark:text-purple-300">
                  {asset.asset_type}
                </span>
              </div>
              <pre className="text-[11px] text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono">
                {JSON.stringify(asset.metadata, null, 2)}
              </pre>
            </div>
          ))
        ) : (
          memories.map(memory => (
            <div key={memory.id} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300">{memory.skill_name}</span>
                <span className="text-[10px] text-gray-500">{new Date(memory.created_at).toLocaleDateString()}</span>
              </div>
              <div className="text-[11px] font-bold text-gray-700 dark:text-gray-200 mb-1">{memory.entity_key}</div>
              <p className="text-[11px] text-gray-600 dark:text-gray-400 line-clamp-3">{memory.content}</p>
            </div>
          ))
        )}

        {((activeTab === 'knowledge' && assets.length === 0) || (activeTab === 'memories' && memories.length === 0)) && (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <Info className="w-8 h-8 opacity-20" />
            <p className="text-sm">אין נתונים זמינים</p>
          </div>
        )}
      </div>
    </div>
  );
}
