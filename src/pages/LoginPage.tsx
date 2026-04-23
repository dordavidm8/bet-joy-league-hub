import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

function friendlyError(err: any): string {
  const code: string = err?.code ?? '';
  const msg: string = err?.message ?? '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found')
    return 'שם המשתמש, האימייל או הסיסמה שגויים';
  if (code === 'auth/email-already-in-use') return 'כתובת האימייל כבר קיימת במערכת';
  if (code === 'auth/weak-password') return 'הסיסמה חייבת להכיל לפחות 6 תווים';
  if (code === 'auth/invalid-email') return 'כתובת האימייל אינה תקינה';
  if (code === 'auth/too-many-requests') return 'יותר מדי ניסיונות. אנא המתן מספר דקות ונסה שוב';
  if (code === 'auth/network-request-failed') return 'בעיית חיבור לאינטרנט. בדוק את החיבור ונסה שוב';
  if (code === 'auth/user-disabled') return 'החשבון הושהה. פנה לתמיכה';
  if (msg.includes('User not found') || msg.includes('404')) return 'שם המשתמש לא נמצא במערכת';
  if (msg.includes('already exists') || msg.includes('409')) return 'שם המשתמש כבר תפוס, אנא בחר שם אחר';
  return 'שגיאה לא מוכרת, אנא נסו במועד מאוחר יותר';
}

const features = [
  {
    label: 'ניחשו משחקים',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-green-600" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 1.5a8.49 8.49 0 0 1 5.273 1.822l-1.93 1.402-2.02-.656-1.02-1.928A8.52 8.52 0 0 1 12 3.5zm-2.273.36 1.02 1.928-1.17 2.212H6.79A8.51 8.51 0 0 1 9.727 3.86zm6.064 1.05 1.716-1.247A8.498 8.498 0 0 1 20.2 9.5h-2.083l-1.47-2.778.543-1.811h.601zm-3.818.73 2.02.656.543 1.812L12 9.5l-2.536-1.39.543-1.812 2.02-.656h-.054zM6.79 8H9.577L12 9.5l-1.126 3.463H7.386L5.797 10.13 6.79 8zm10.633 0 .993 2.13L16.727 12.963H13.126L12 9.5 14.423 8h2.787zM4.033 10.84l1.295 2.778-.38 2.777A8.496 8.496 0 0 1 3.5 12c0-.395.028-.784.082-1.165l.45.005zm15.95 0 .435-.005A8.5 8.5 0 0 1 20.5 12a8.496 8.496 0 0 1-1.448 4.795l-.38-2.777 1.311-3.178zM7.386 14.037h3.075l1.539 2.13-.87 2.595a8.53 8.53 0 0 1-4.516-2.688l.772-2.037zm6.153 0h3.075l.772 2.037a8.53 8.53 0 0 1-4.516 2.688l-.87-2.595 1.539-2.13zm-3.348 2.63L11 18.814a8.54 8.54 0 0 1-1-.048l.191-2.099zm3.618 0 .809 2.1a8.54 8.54 0 0 1-1 .047l.191-2.146z"/>
      </svg>
    ),
  },
  {
    label: 'ליגות עם חברים',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-green-600" xmlns="http://www.w3.org/2000/svg">
        <path d="M7 3H4a1 1 0 0 0-1 1v5c0 3.314 2.686 6 6 6h6c3.314 0 6-2.686 6-6V4a1 1 0 0 0-1-1h-3V2H7v1zm0 2V4h10v1H7zm-2 0h2v3c0 2.21-1.79 4-4 4V5h2zm14 0h2v3c0 2.21-1.79 4-4 4H7c-2.21 0-4-1.79-4-4H5v3zm-8 8h2v3h3v2H8v-2h3v-3z"/>
      </svg>
    ),
  },
  {
    label: 'עקבו אחרי הדירוג',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-green-600" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 13h2v8H3v-8zm4-5h2v13H7V8zm4-4h2v17h-2V4zm4 7h2v10h-2V11zm4-3h2v13h-2V8z"/>
      </svg>
    ),
  },
];

export default function LoginPage() {
  const { signIn, signUp, signInWithGoogle, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [referralCode, setReferralCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('ref') ?? '';
  });
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('ref')) setMode('register');
  }, []);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else if (mode === 'register') {
        await signUp(email, password, username, referralCode || undefined, displayName || undefined);
      } else {
        await sendPasswordReset(email);
        setSuccessMsg('נשלח אימייל לאיפוס סיסמה. בדוק את תיבת הדואר שלך.');
      }
    } catch (err: any) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle(username || undefined, referralCode || undefined);
    } catch (err: any) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: 'login' | 'register' | 'forgot') => {
    setMode(next);
    setError('');
    setSuccessMsg('');
  };

  const inputClass =
    'w-full bg-gray-50 text-gray-900 placeholder-gray-400 rounded-lg px-4 py-2.5 text-sm border border-gray-200 focus:border-green-500 focus:bg-white outline-none transition-colors';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-700 via-green-800 to-green-950 p-4 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-0 left-0 w-80 h-80 rounded-full bg-white/10 blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-white/10 blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />

      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl relative z-10">
        {/* Logo & title */}
        <div className="flex justify-center mb-2">
          <img src="/kickoff_logo_cropped.png" alt="Kickoff" className="h-[130px] w-auto" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-1">Kickoff</h1>
        <p className="text-green-600 font-semibold text-center text-sm mb-5">
          {mode === 'login' ? 'ניחש. התחרה. נצח.' : mode === 'register' ? 'צור חשבון חדש' : 'איפוס סיסמה'}
        </p>

        {/* Feature strip — shown only on login view */}
        {mode === 'login' && (
          <div className="flex justify-around mb-5 py-3 border-y border-gray-100">
            {features.map(f => (
              <div key={f.label} className="flex flex-col items-center gap-1.5">
                {f.icon}
                <span className="text-[11px] text-gray-500 font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handle} className="space-y-3">
          {mode === 'register' && (
            <>
              <input
                type="text"
                placeholder="שם מלא"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required
                className={inputClass}
              />
              <div className="relative flex items-center">
                <span className="absolute left-3 text-gray-400 text-sm select-none pointer-events-none">@</span>
                <input
                  type="text"
                  placeholder="שם משתמש"
                  value={username}
                  onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase())}
                  required
                  className={`${inputClass} pl-7`}
                />
              </div>
              <input
                type="text"
                placeholder="קוד הפניה (אופציונלי)"
                value={referralCode}
                onChange={e => setReferralCode(e.target.value)}
                className={inputClass}
              />
            </>
          )}

          <input
            type={mode === 'register' ? 'email' : 'text'}
            placeholder={mode === 'register' ? 'אימייל' : 'אימייל או שם משתמש'}
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className={inputClass}
          />

          {mode !== 'forgot' && (
            <input
              type="password"
              placeholder="סיסמה"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className={inputClass}
            />
          )}

          {mode === 'register' && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={e => setAgeConfirmed(e.target.checked)}
                className="mt-0.5 accent-green-600"
              />
              <span className="text-xs text-gray-500">אני מאשר/ת שאני מעל גיל 18</span>
            </label>
          )}

          {error && <p className="text-red-500 text-xs text-center">{error}</p>}
          {successMsg && <p className="text-green-600 text-xs text-center">{successMsg}</p>}

          <button
            type="submit"
            disabled={loading || (mode === 'register' && !ageConfirmed)}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
          >
            {loading ? '...' : mode === 'login' ? 'התחבר' : mode === 'register' ? 'הרשמה' : 'שלח קישור לאיפוס'}
          </button>
        </form>

        {mode === 'login' && (
          <p className="text-center mt-2">
            <button onClick={() => switchMode('forgot')} className="text-gray-400 hover:text-gray-600 text-xs transition-colors">
              שכחתי סיסמה
            </button>
          </p>
        )}

        {mode !== 'forgot' && (
          <>
            <div className="flex items-center my-4">
              <div className="flex-1 border-t border-gray-200" />
              <span className="px-3 text-gray-400 text-xs">או</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-800 font-semibold rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2 border border-gray-200"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 2.18 2.18 4.93l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              המשך עם Google
            </button>
          </>
        )}

        <p className="text-center text-gray-400 text-xs mt-5">
          {mode === 'forgot' ? (
            <button onClick={() => switchMode('login')} className="text-green-600 hover:underline">חזרה להתחברות</button>
          ) : mode === 'login' ? (
            <>אין לך חשבון?{' '}<button onClick={() => switchMode('register')} className="text-green-600 hover:underline font-semibold">הרשמה</button></>
          ) : (
            <>יש לך חשבון?{' '}<button onClick={() => switchMode('login')} className="text-green-600 hover:underline">התחבר</button></>
          )}
        </p>
      </div>
    </div>
  );
}
