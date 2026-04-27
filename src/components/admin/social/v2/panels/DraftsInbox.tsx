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
            
            {/* RICH MEDIA RENDERING (Phase 6) */}
            {(draft.media_url || draft.image_url) && (
              <div className="bg-slate-200 dark:bg-slate-700 flex flex-col items-center justify-center border-b relative overflow-hidden min-h-[160px]">
                {draft.media_type === 'image' || (!draft.media_type && (draft.image_url || draft.media_url?.match(/\.(jpg|jpeg|png|webp|gif)$/i))) ? (
                  <img src={draft.media_url || draft.image_url} className="w-full h-full object-cover max-h-64" alt="Draft creative" />
                ) : draft.media_type === 'audio' || draft.media_url?.endsWith('.mp3') ? (
                  <div className="w-full flex flex-col items-center p-6 gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Podcast Draft</span>
                    <audio controls className="w-full h-10">
                      <source src={draft.media_url} type="audio/mpeg" />
                    </audio>
                  </div>
                ) : draft.media_type === 'pdf' || draft.media_url?.endsWith('.pdf') ? (
                  <div className="w-full flex flex-col items-center p-4 gap-2">
                     <span className="text-[10px] font-bold text-slate-500 uppercase">Slide Deck (PDF)</span>
                     <iframe src={`${draft.media_url}#toolbar=0`} className="w-full h-64 border-0 rounded" title="PDF Preview" />
                     <a href={draft.media_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 underline">פתח במסך מלא</a>
                  </div>
                ) : (
                  <div className="flex flex-col items-center p-4 text-slate-400">
                    <ImageIcon size={32} />
                    <span className="text-[10px] mt-2 font-mono">{draft.media_type || 'Unknown Media'}</span>
                    <a href={draft.media_url} target="_blank" rel="noreferrer" className="text-xs mt-1 underline">Download Media</a>
                  </div>
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
