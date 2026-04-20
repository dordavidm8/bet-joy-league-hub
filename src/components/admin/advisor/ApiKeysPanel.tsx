import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { advisorGetSecrets, advisorUpdateSecret, advisorTestSecret } from '@/lib/api';
import { Edit2, CheckCircle, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';

const KEY_LABELS: Record<string, string> = {
  GROQ_API_KEY:         'Groq API Key',
  THE_ODDS_API_KEY:     'The Odds API Key',
  FIREBASE_API_KEY:     'Firebase API Key',
  FIREBASE_PRIVATE_KEY: 'Firebase Private Key',
  FIREBASE_CLIENT_EMAIL:'Firebase Client Email',
  WHATSAPP_API_KEY:     'WhatsApp API Key',
};

type TestResult = { ok: boolean; message: string } | null;

const SecretRow = ({ secret, onTest }: {
  secret: { key: string; preview: string | null; source?: string; updated_at: string | null };
  onTest: (key: string) => Promise<TestResult>;
}) => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [showVal, setShowVal] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>(null);

  const mutation = useMutation({
    mutationFn: () => advisorUpdateSecret(secret.key, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['advisor-secrets'] });
      setEditing(false);
      setValue('');
      setTestResult(null);
    },
  });

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await onTest(secret.key);
    setTestResult(res);
    setTesting(false);
  };

  return (
    <div className="border border-border rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-bold text-sm">{KEY_LABELS[secret.key] ?? secret.key}</span>
          {secret.source === 'env' && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">env</span>}
          {secret.updated_at && (
            <span className="ml-2 text-xs text-muted-foreground">עודכן {new Date(secret.updated_at).toLocaleDateString('he-IL')}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleTest} disabled={testing}
            className="text-xs px-2 py-1 rounded-lg border border-border hover:bg-secondary disabled:opacity-60 flex items-center gap-1">
            {testing ? <Loader2 size={11} className="animate-spin" /> : null} בדוק
          </button>
          <button onClick={() => { setEditing(!editing); setValue(''); setTestResult(null); }}
            className="text-xs px-2 py-1 rounded-lg border border-border hover:bg-secondary flex items-center gap-1">
            <Edit2 size={11} /> ערוך
          </button>
        </div>
      </div>

      <div className="font-mono text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1">
        {secret.preview ?? '—'}
      </div>

      {testResult && (
        <div className={`flex items-center gap-1.5 text-xs font-bold ${testResult.ok ? 'text-green-600' : 'text-destructive'}`}>
          {testResult.ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
          {testResult.message}
        </div>
      )}

      {editing && (
        <div className="flex flex-col gap-2 mt-1">
          <div className="flex gap-2">
            <input
              type={showVal ? 'text' : 'password'}
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={`ערך חדש עבור ${secret.key}`}
              className="flex-1 border border-border rounded-lg px-3 py-1.5 text-xs bg-background font-mono"
            />
            <button onClick={() => setShowVal(s => !s)} className="text-muted-foreground hover:text-foreground">
              {showVal ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {mutation.isError && <p className="text-destructive text-xs">{(mutation.error as Error).message}</p>}
          <div className="flex gap-2">
            <button onClick={() => mutation.mutate()} disabled={!value || mutation.isPending}
              className="bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-lg font-bold disabled:opacity-60 flex items-center gap-1">
              {mutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />} שמור
            </button>
            <button onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-secondary">
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const ApiKeysPanel = () => {
  const { data, isLoading } = useQuery({ queryKey: ['advisor-secrets'], queryFn: advisorGetSecrets });

  if (isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">טוען...</div>;

  return (
    <div className="flex flex-col gap-3 max-w-lg">
      <p className="text-xs text-muted-foreground">
        הערכים מוצפנים (AES-256-GCM) ב-DB. המפתח הראשי נשמר רק ב-Railway env כ-SECRETS_MASTER_KEY.
        שינויים נכנסים לתוקף תוך 5 דקות.
      </p>
      {(data ?? []).map(s => (
        <SecretRow key={s.key} secret={s} onTest={advisorTestSecret} />
      ))}
    </div>
  );
};
