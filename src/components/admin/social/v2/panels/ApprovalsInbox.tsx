import React, { useState, useEffect } from 'react';
import { Check, X, MessageSquare, UserPlus, AlertCircle, Clock } from 'lucide-react';

interface Approval {
  id: string;
  issue_id: string;
  issue_title: string;
  request_type: string;
  payload: any;
  requested_by: string;
  created_at: string;
}

export default function ApprovalsInbox() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchApprovals = async () => {
    try {
      const res = await fetch('/api/agents/approvals');
      const data = await res.json();
      setApprovals(data.approvals || []);
    } catch (err) {
      console.error('Failed to fetch approvals');
    }
  };

  useEffect(() => {
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 10000);
    return () => clearInterval(interval);
  }, []);

  const [comment, setComment] = useState('');

  const decide = async (id: string, decision: 'approved' | 'denied' | 'rejected') => {
    setLoading(true);
    try {
      await fetch(`/api/agents/approvals/${id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, comment: comment || 'Action submitted via UI' })
      });
      setComment('');
      fetchApprovals();
    } catch (err) {
      console.error('Failed to submit decision');
    } finally {
      setLoading(false);
    }
  };

  const renderPayload = (app: Approval) => {
    const payload = typeof app.payload === 'string' ? JSON.parse(app.payload) : app.payload;

    if (app.request_type === 'video_text_review') {
      return (
        <div className="space-y-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
             <MessageSquare size={12} /> בדיקת טקסטים לסרטון ({payload.compositionId})
          </div>
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="p-2 border-l border-b font-bold w-1/3">סצנה</th>
                  <th className="p-2 border-b font-bold">טקסט</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payload.texts?.map((t: any, i: number) => (
                  <tr key={i}>
                    <td className="p-2 border-l bg-slate-50/50 dark:bg-slate-900/20 font-medium">{t.scene}</td>
                    <td className="p-2">{t.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (app.request_type === 'schedule_next_video') {
      return (
        <div className="space-y-3">
           <div className="text-[10px] font-bold text-slate-500 uppercase">תצוגה מקדימה ולו"ז</div>
           <video src={payload.mediaUrl} className="w-full rounded-lg border shadow-inner max-h-48 bg-black" controls />
           <p className="text-sm font-bold text-primary">האם לתזמן סרטון הסבר חדש למחר ב-09:00?</p>
        </div>
      );
    }

    return (
      <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
        <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1 mb-1">
          <MessageSquare className="w-3 h-3" /> פרטי הבקשה:
        </span>
        <p className="text-xs text-gray-600 dark:text-gray-400 italic">
          "{payload?.taskDescription || 'אין תיאור משימה'}"
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-orange-500" />
          תיבת אישורים
          {approvals.length > 0 && (
            <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse">
              {approvals.length} ממתינים
            </span>
          )}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {approvals.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
            <Check className="w-12 h-12 mb-2" />
            <p>אין בקשות הממתינות לאישור</p>
          </div>
        ) : (
          approvals.map(app => (
            <div key={app.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-start bg-gray-50/50 dark:bg-gray-800">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                      {app.request_type}
                    </span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(app.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm">בקשה מאת: {app.requested_by}</h4>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => decide(app.id, 'approved')}
                    disabled={loading}
                    className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all shadow-sm"
                    title="אשר"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => decide(app.id, 'denied')}
                    disabled={loading}
                    className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all shadow-sm"
                    title="דחה"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <div className="mb-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">הקשר (Issue):</span>
                  <p className="text-sm font-medium">{app.issue_title}</p>
                </div>
                
                {renderPayload(app)}

                {app.request_type === 'video_text_review' && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <textarea 
                      className="w-full p-2 text-xs border rounded bg-slate-50 dark:bg-slate-900/50"
                      placeholder="הערות לתיקון (אם בחרת לדחות)..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
