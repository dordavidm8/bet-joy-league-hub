import React from 'react';
import { useDrafts } from '../hooks/useDrafts';
import CopyButton from '../ui/CopyButton';
import { Share2, Image as ImageIcon } from 'lucide-react';

export default function DraftsInbox() {
  const { data: drafts, isLoading } = useDrafts();

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-r border-border">
      <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur z-10 w-full">
        <h2 className="text-lg font-bold flex items-center gap-2">
           <Share2 size={18} className="text-primary" /> תוצרים סופיים
        </h2>
        <div className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded-full">
          {drafts?.length || 0} טיוטות
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {isLoading && <div className="text-center p-8 text-muted-foreground animate-pulse">טוען טיוטות...</div>}
        
        {drafts?.length === 0 && (
          <div className="text-center p-8 text-muted-foreground bg-white dark:bg-slate-800 rounded-lg border border-dashed">
            אין טיוטות ממתינות. הפעל את ה-Pipeline!
          </div>
        )}

        {drafts?.map(draft => (
          <div key={draft.id} className="bg-white dark:bg-slate-800 border rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-slate-800/50 border-b text-xs font-bold capitalize">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-green-500"></span>
                {draft.platform}
              </span>
              <span className="text-muted-foreground font-mono font-normal">
                {new Date(draft.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            
            {draft.image_url && (
              <div className="h-32 bg-slate-200 dark:bg-slate-700 flex items-center justify-center border-b relative overflow-hidden">
                {draft.image_url.startsWith('http') ? (
                  <img src={draft.image_url} className="w-full h-full object-cover" alt="Draft creative" />
                ) : (
                  <ImageIcon className="text-slate-400" size={32} />
                )}
              </div>
            )}
            
            <div className="p-3 text-sm flex-1 whitespace-pre-wrap leading-relaxed text-gray-800 dark:text-gray-200">
              {draft.final_caption || draft.caption}
            </div>

            <div className="p-3 border-t bg-slate-50 dark:bg-slate-900/50 flex justify-between gap-2">
               <CopyButton 
                 text={draft.final_caption || draft.caption} 
                 label={`העתק ל-${draft.platform}`}
                 className="flex-1"
               />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
