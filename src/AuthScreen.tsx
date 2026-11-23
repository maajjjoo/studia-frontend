import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Icons } from './Icons';
import { useTranslation } from './i18n/LanguageContext';
import {
  AUTH_LIMITS,
  AuthError,
  type Account,
  type AuthErrorCode,
  type LoginInput,
  type RegisterInput,
  passwordStrength,
  validateEmail,
  validatePassword,
  validateUsername,
} from './useAuth';

type Mode = 'login' | 'register';
type FieldName = 'identifier' | 'username' | 'email' | 'password' | 'confirm';

interface Props {
  onLogin: (input: LoginInput) => Promise<Account>;
  onRegister: (input: RegisterInput) => Promise<Account>;
  onEnter: (account: Account) => void;
}

const FIELD_FOR_ERROR: Partial<Record<AuthErrorCode, FieldName>> = {
  usernameRequired: 'username', usernameShort: 'username', usernameLong: 'username', usernameChars: 'username', usernameTaken: 'username',
  emailRequired: 'email', emailInvalid: 'email', emailLong: 'email', emailTaken: 'email',
  passwordRequired: 'password', passwordShort: 'password', passwordLong: 'password', passwordWeak: 'password',
  passwordMismatch: 'confirm',
  identifierRequired: 'identifier',
};

interface FieldProps {
  id: FieldName;
  label: string;
  icon: ReactNode;
  value: string;
  max: number;
  invalid: boolean;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
  trailing?: ReactNode;
  showCounter?: boolean;
  autoFocus?: boolean;
  index: number;
}

function Field({ id, label, icon, value, max, invalid, onChange, type = 'text', placeholder, autoComplete, hint, trailing, showCounter = true, autoFocus, index }: FieldProps) {
  const near = value.length >= max * 0.85;
  return (
    <div className="auth-field" style={{ animationDelay: `${80 + index * 55}ms` }}>
      <label className="form-label" htmlFor={`auth-${id}`}>
        <span>{label}</span>
        {showCounter && <span className={`char-counter ${near ? 'is-near' : ''}`}>{value.length}/{max}</span>}
      </label>
      <div className={`auth-input ${invalid ? 'is-invalid' : ''}`}>
        <span className="auth-input-icon">{icon}</span>
        <input
          id={`auth-${id}`}
          type={type}
          value={value}
          maxLength={max}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          spellCheck={false}
          aria-invalid={invalid}
          onChange={e => onChange(e.target.value)}
        />
        {trailing}
      </div>
      {hint && <span className="auth-hint">{hint}</span>}
    </div>
  );
}

export function AuthScreen({ onLogin, onRegister, onEnter }: Props) {
  const { t, language, setLanguage } = useTranslation();
  const [mode, setMode] = useState<Mode>('login');
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<{ code: AuthErrorCode; nonce: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Account | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const switchMode = (next: Mode) => {
    if (next === mode || busy) return;
    setMode(next);
    setError(null);
    setPassword('');
    setConfirm('');
    setShowPw(false);
  };

  const fail = (code: AuthErrorCode) => setError({ code, nonce: Date.now() });

  const errorText = (code: AuthErrorCode) =>
    t(`auth.errors.${code}`, {
      min: code.startsWith('username') ? AUTH_LIMITS.usernameMin : AUTH_LIMITS.passwordMin,
      max: code.startsWith('username') ? AUTH_LIMITS.usernameMax : code.startsWith('email') ? AUTH_LIMITS.emailMax : AUTH_LIMITS.passwordMax,
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || done) return;
    setError(null);

    if (mode === 'register') {
      const local = validateUsername(username) || validateEmail(email) || validatePassword(password) || (password !== confirm ? 'passwordMismatch' : null);
      if (local) return fail(local);
    } else {
      if (!identifier.trim()) return fail('identifierRequired');
      if (!password) return fail('passwordRequired');
    }

    setBusy(true);
    try {
      const acc = mode === 'register'
        ? await onRegister({ username, email, password, remember })
        : await onLogin({ identifier, password, remember });
      setDone(acc);
      timer.current = window.setTimeout(() => onEnter(acc), 900);
    } catch (err) {
      fail(err instanceof AuthError ? err.code : 'storage');
      setBusy(false);
    }
  };

  const errField = error ? FIELD_FOR_ERROR[error.code] : undefined;
  const strength = passwordStrength(password);
  const set = (fn: (v: string) => void, field: FieldName) => (v: string) => {
    fn(v);
    if (error && errField === field) setError(null);
  };

  const eye = (
    <button
      type="button"
      className="auth-eye"
      onClick={() => setShowPw(s => !s)}
      aria-label={showPw ? t('auth.hidePassword') : t('auth.showPassword')}
      title={showPw ? t('auth.hidePassword') : t('auth.showPassword')}
    >
      <span key={String(showPw)}>{showPw ? <Icons.EyeOff /> : <Icons.Eye />}</span>
    </button>
  );

  return (
    <div className="auth-screen">
      <div className="auth-aurora" aria-hidden="true"><span /><span /><span /></div>

      <section className="auth-brand">
        <div className="auth-brand-glow" aria-hidden="true" />
        <div className="auth-logo"><Icons.Logo /><span>Studia</span></div>

        <div className="auth-brand-copy">
          <h1>{t('auth.brandTagline')}</h1>
          <p>{t('auth.brandDesc')}</p>
          <ul className="auth-features">
            <li><span><Icons.CheckSquare /></span>{t('auth.feature1')}</li>
            <li><span><Icons.Timer /></span>{t('auth.feature2')}</li>
            <li><span><Icons.Spark /></span>{t('auth.feature3')}</li>
          </ul>
        </div>

        <div className="auth-floaters" aria-hidden="true">
          <div className="auth-chip chip-a"><span className="chip-check"><Icons.Check /></span><div><b /><i /></div></div>
          <div className="auth-chip chip-b"><Icons.Flame /><div><b /><i /></div></div>
          <div className="auth-ring"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="32" /><circle cx="40" cy="40" r="32" /></svg><Icons.Timer /></div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-lang">
          <button type="button" className={language === 'es' ? 'active' : ''} onClick={() => setLanguage('es')}>ES</button>
          <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>EN</button>
        </div>

        <div className="auth-card">
          {done && (
            <div className="auth-success" role="status">
              <div className="auth-success-mark">
                <svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="m15 27 7.5 7.5L37.5 19" /></svg>
              </div>
              <h2>{mode === 'register' ? t('auth.accountCreated') : t('auth.welcomeBack', { name: done.username })}</h2>
            </div>
          )}

          <div className="auth-tabs" role="tablist" data-mode={mode}>
            <span className="auth-tabs-pill" aria-hidden="true" />
            <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => switchMode('login')}>{t('auth.loginTab')}</button>
            <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => switchMode('register')}>{t('auth.registerTab')}</button>
          </div>

          <div className="auth-heading" key={`h-${mode}`}>
            <h2>{mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}</h2>
            <p>{mode === 'login' ? t('auth.loginSubtitle') : t('auth.registerSubtitle')}</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate key={`f-${mode}`}>
            {mode === 'login' ? (
              <>
                <Field index={0} id="identifier" label={t('auth.identifierLabel')} icon={<Icons.Mail />} value={identifier} max={AUTH_LIMITS.identifierMax}
                  onChange={set(setIdentifier, 'identifier')} invalid={errField === 'identifier' || error?.code === 'invalidCredentials'}
                  placeholder={t('auth.identifierPlaceholder')} autoComplete="username" showCounter={false} autoFocus />
                <Field index={1} id="password" label={t('auth.passwordLabel')} icon={<Icons.Lock />} value={password} max={AUTH_LIMITS.passwordMax}
                  onChange={set(setPassword, 'password')} invalid={errField === 'password' || error?.code === 'invalidCredentials'}
                  type={showPw ? 'text' : 'password'} autoComplete="current-password" showCounter={false} trailing={eye} />
              </>
            ) : (
              <>
                <Field index={0} id="username" label={t('auth.usernameLabel')} icon={<Icons.AtSign />} value={username} max={AUTH_LIMITS.usernameMax}
                  onChange={set(v => setUsername(v.replace(/\s/g, '')), 'username')} invalid={errField === 'username'}
                  placeholder={t('auth.usernamePlaceholder')} autoComplete="username" hint={t('auth.usernameHint')} autoFocus />
                <Field index={1} id="email" label={t('auth.emailLabel')} icon={<Icons.Mail />} value={email} max={AUTH_LIMITS.emailMax}
                  onChange={set(v => setEmail(v.replace(/\s/g, '')), 'email')} invalid={errField === 'email'}
                  type="email" placeholder={t('auth.emailPlaceholder')} autoComplete="email" showCounter={email.length > 40} />
                <Field index={2} id="password" label={t('auth.passwordLabel')} icon={<Icons.Lock />} value={password} max={AUTH_LIMITS.passwordMax}
                  onChange={set(setPassword, 'password')} invalid={errField === 'password'}
                  type={showPw ? 'text' : 'password'} placeholder={t('auth.passwordPlaceholder', { min: AUTH_LIMITS.passwordMin })}
                  autoComplete="new-password" trailing={eye} />
                <div className="auth-strength" data-score={strength} aria-live="polite" style={{ visibility: password ? 'visible' : 'hidden' }}>
                  <div className="auth-strength-bars"><i /><i /><i /><i /></div>
                  <span>{t(`auth.strength${strength}`)}</span>
                </div>
                <Field index={3} id="confirm" label={t('auth.confirmLabel')} icon={<Icons.Lock />} value={confirm} max={AUTH_LIMITS.passwordMax}
                  onChange={set(setConfirm, 'confirm')} invalid={errField === 'confirm'}
                  type={showPw ? 'text' : 'password'} placeholder={t('auth.confirmPlaceholder')} autoComplete="new-password" showCounter={false}
                  trailing={confirm && confirm === password ? <span className="auth-match"><Icons.Check /></span> : undefined} />
              </>
            )}

            {error && (
              <div className="error-msg" key={error.nonce} role="alert">
                <Icons.HelpCircle /> {errorText(error.code)}
              </div>
            )}

            <label className="auth-remember">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
              <span className="auth-remember-box"><Icons.Check /></span>
              {t('auth.remember')}
            </label>

            <button type="submit" className={`auth-submit ${busy ? 'is-busy' : ''}`} disabled={busy}>
              <span className="auth-submit-label">{mode === 'login' ? t('auth.loginBtn') : t('auth.registerBtn')}</span>
              <span className="auth-submit-icon">{busy ? <span className="auth-spinner" /> : <Icons.ArrowRight />}</span>
            </button>
          </form>

          <p className="auth-switch">
            {mode === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
            <button type="button" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? t('auth.switchToRegister') : t('auth.switchToLogin')}
            </button>
          </p>
        </div>
      </section>
    </div>
  );
}
