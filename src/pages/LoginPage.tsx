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

  // Auto-switch to register when arriving via referral link
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
        // forgot
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

  const titleMap = { login: 'התחבר לחשבון שלך', register: 'צור חשבון חדש', forgot: 'איפוס סיסמה' };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl p-6 shadow-xl border border-gray-700">
        <div className="flex justify-center mb-2">
          <img src="/kickoff_logo_cropped.png" alt="Kickoff" className="h-[150px] w-auto" />
        </div>
        <h1 className="text-2xl font-bold text-white text-center mb-1">Kickoff</h1>
        <p className="text-gray-400 text-center text-sm mb-6">{titleMap[mode]}</p>

        <form onSubmit={handle} className="space-y-3">
          {mode === 'register' && (
            <>
              <input
                type="text"
                placeholder="שם מלא"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm border border-gray-600 focus:border-green-500 outline-none"
              />
              <div className="relative flex items-center">
                <span className="absolute left-3 text-gray-400 text-sm select-none pointer-events-none">@</span>
                <input
                  type="text"
                  placeholder="שם משתמש"
                  value={username}
                  onChange={e => setUsername(e.target.value.replace(/[@\s]+/g, ''))}
                  required
                  className="w-full bg-gray-800 text-white rounded-lg pl-7 pr-4 py-2.5 text-sm border border-gray-600 focus:border-green-500 outline-none"
                />
              </div>
              <input
                type="text"
                placeholder="קוד הפניה (אופציונלי)"
                value={referralCode}
                onChange={e => setReferralCode(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm border border-gray-600 focus:border-green-500 outline-none"
              />
            </>
          )}

          {/* Email OR username for login/forgot; plain email for register */}
          <input
            type={mode === 'register' ? 'email' : 'text'}
            placeholder={mode === 'register' ? 'אימייל' : mode === 'forgot' ? 'אימייל או שם משתמש' : 'אימייל או שם משתמש'}
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm border border-gray-600 focus:border-green-500 outline-none"
          />

          {mode !== 'forgot' && (
            <input
              type="password"
              placeholder="סיסמה"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm border border-gray-600 focus:border-green-500 outline-none"
            />
          )}

          {mode === 'register' && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={e => setAgeConfirmed(e.target.checked)}
                className="mt-0.5 accent-green-500"
              />
              <span className="text-xs text-gray-400">אני מאשר/ת שאני מעל גיל 18</span>
            </label>
          )}

          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          {successMsg && <p className="text-green-400 text-xs text-center">{successMsg}</p>}

          <button
            type="submit"
            disabled={loading || (mode === 'register' && !ageConfirmed)}
            className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
          >
            {loading ? '...' : mode === 'login' ? 'התחבר' : mode === 'register' ? 'הרשמה' : 'שלח קישור לאיפוס'}
          </button>
        </form>

        {mode === 'login' && (
          <p className="text-center mt-2">
            <button onClick={() => switchMode('forgot')} className="text-gray-500 hover:text-gray-300 text-xs">
              שכחתי סיסמה
            </button>
          </p>
        )}

        {mode !== 'forgot' && (
          <>
            <div className="flex items-center my-4">
              <div className="flex-1 border-t border-gray-700" />
              <span className="px-3 text-gray-500 text-xs">או</span>
              <div className="flex-1 border-t border-gray-700" />
            </div>

            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-900 font-semibold rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              המשך עם Google
            </button>
          </>
        )}

        <p className="text-center text-gray-500 text-xs mt-5">
          {mode === 'forgot' ? (
            <button onClick={() => switchMode('login')} className="text-green-400 hover:underline">חזרה להתחברות</button>
          ) : mode === 'login' ? (
            <>אין לך חשבון?{' '}<button onClick={() => switchMode('register')} className="text-green-400 hover:underline">הרשמה</button></>
          ) : (
            <>יש לך חשבון?{' '}<button onClick={() => switchMode('login')} className="text-green-400 hover:underline">התחבר</button></>
          )}
        </p>
      </div>
    </div>
  );
}
