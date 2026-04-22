import React, { useState } from 'react';
import { Wand2, Loader2, Copy, Check } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';

const API = '/api/social';

async function generateFormats(text: string) {
  const r = await fetch(`${API}/magic-switch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

interface MagicSwitchModalProps {
  initialText: string;
  onClose: () => void;
  onSelectContent?: (content: string) => void;
}

export const MagicSwitchModal = ({ initialText, onClose, onSelectContent }: MagicSwitchModalProps) => {
  const [copied, setCopied] = useState<string | null>(null);

  const { mutate, data, isPending, error } = useMutation({
    mutationFn: generateFormats,
  });

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <Wand2 size={24} />
            <h2 className="text-xl font-black">מטה הקסם</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:bg-secondary p-2 rounded-full transition-colors">
            ✖
          </button>
        </div>
        <p className="text-sm text-muted-foreground -mt-4">
          ממיר באופן אוטומטי תוכן לפורמטים מותאמים לכל הפלטפורמות.
        </p>

        {/* Source Content */}
        {!data && (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold">תוכן מקור:</h3>
            <textarea 
              readOnly
              value={initialText}
              className="w-full bg-secondary text-sm border-border border rounded-xl p-4 min-h-[100px] resize-none outline-none"
              dir="auto"
            />
            <button 
              onClick={() => mutate(initialText)} 
              disabled={isPending || !initialText}
              className="flex items-center justify-center gap-2 bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold px-4 py-3 rounded-xl disabled:opacity-60 hover:shadow-lg transition-all"
            >
              {isPending ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
              {isPending ? 'מייצר קסמים...' : 'המר לכל הפלטפורמות'}
            </button>
            {error && <p className="text-destructive text-sm mt-2">Error: {(error as Error).message}</p>}
          </div>
        )}

        {/* Results */}
        {data?.formats && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {Object.entries(data.formats).map(([key, content]: [string, any]) => (
              <div key={key} className="border rounded-2xl p-4 bg-card shadow-sm flex flex-col gap-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-bold text-sm capitalize">{key.replace('_', ' ')}</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleCopy(content, key)}
                      className="text-muted-foreground hover:text-foreground text-xs p-1.5 rounded-md hover:bg-secondary flex gap-1 items-center"
                    >
                      {copied === key ? <Check size={14} className="text-emerald-500"/> : <Copy size={14} />} {copied === key ? 'הועתק' : 'העתק'}
                    </button>
                    {onSelectContent && (
                      <button 
                        onClick={() => onSelectContent(content)}
                        className="bg-primary/10 text-primary font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors"
                      >
                        השתמש
                      </button>
                    )}
                  </div>
                </div>
                {Array.isArray(content) ? (
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide py-2">
                    {content.map((slide, i) => (
                      <div key={i} className="min-w-[200px] shrink-0 bg-secondary rounded-xl p-3 text-sm flex items-center justify-center border text-center aspect-square" dir="auto">
                        {slide}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap pt-2 leading-relaxed" dir="auto">{content}</p>
                )}
              </div>
            ))}
            
            <button 
              onClick={() => mutate(initialText)} 
              disabled={isPending}
              className="mt-4 flex items-center justify-center gap-2 border text-foreground font-bold px-4 py-2.5 rounded-xl disabled:opacity-60 hover:bg-secondary transition-colors"
            >
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
               נסה שוב
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
