import React, { useState, useEffect } from 'react';
import { Plus, Play, CheckCircle2, Clock, AlertCircle, ChevronRight } from 'lucide-react';

interface Issue {
  id: string;
  title: string;
  body: string;
  assigned_skill: string;
  status: 'open' | 'in_progress' | 'done' | 'failed';
  priority: string;
}

export default function IssuesBoard() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchIssues = async () => {
    try {
      const res = await fetch('/api/agents/issues');
      const data = await res.json();
      setIssues(data.issues || []);
    } catch (err) {
      console.error('Failed to fetch issues');
    }
  };

  useEffect(() => {
    fetchIssues();
    const interval = setInterval(fetchIssues, 10000);
    return () => clearInterval(interval);
  }, []);

  const runIssue = async (id: string) => {
    setLoading(true);
    try {
      await fetch(`/api/agents/issues/${id}/run`, { method: 'POST' });
      fetchIssues();
    } catch (err) {
      console.error('Failed to run issue');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { id: 'open', title: 'פתוח', icon: <AlertCircle className="w-4 h-4 text-gray-400" /> },
    { id: 'in_progress', title: 'בטיפול', icon: <Clock className="w-4 h-4 text-blue-500 animate-spin" /> },
    { id: 'done', title: 'הושלם', icon: <CheckCircle2 className="w-4 h-4 text-green-500" /> }
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800">
        <h3 className="text-lg font-bold">לוח משימות סוכנים</h3>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all">
          <Plus className="w-4 h-4" />
          משימה חדשה
        </button>
      </div>

      <div className="flex-1 flex gap-4 p-4 overflow-x-auto">
        {columns.map(col => (
          <div key={col.id} className="w-80 min-w-[320px] flex flex-col gap-3">
            <div className="flex items-center gap-2 px-2">
              {col.icon}
              <span className="font-bold text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                {col.title} ({issues.filter(i => i.status === col.id).length})
              </span>
            </div>
            
            <div className="flex-1 space-y-3">
              {issues.filter(i => i.status === col.id).map(issue => (
                <div key={issue.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] uppercase font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">
                      {issue.assigned_skill}
                    </span>
                    {issue.status === 'open' && (
                      <button 
                        onClick={() => runIssue(issue.id)}
                        disabled={loading}
                        className="opacity-0 group-hover:opacity-100 p-1.5 bg-green-500 text-white rounded-full hover:scale-110 transition-all"
                      >
                        <Play className="w-3 h-3 fill-current" />
                      </button>
                    )}
                  </div>
                  <h4 className="font-bold text-sm mb-1">{issue.title}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{issue.body}</p>
                </div>
              ))}
              
              {issues.filter(i => i.status === col.id).length === 0 && (
                <div className="h-32 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl flex items-center justify-center text-gray-400 text-sm">
                  אין משימות
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
