import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { authConfig, isAllowed, isEmail, isOtpCode, normalizeEmail, authErrorText } from '../domain/auth.js';

const cfg = authConfig(import.meta.env);
const supabase = cfg.enabled ? createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

const AuthContext = createContext({ user: null, signOut: null, enabled: false });
export const useAuth = () => useContext(AuthContext);

// Login con código o enlace por email (Supabase). Solo entran los usuarios que ya existen en
// Supabase (registro cerrado: los invita el administrador); si hay lista local, también tiene
// que estar en ella. Sin configuración, la app funciona sin login, como siempre.
export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = cargando
  const [denied, setDenied] = useState(null);
  useEffect(() => {
    if (!supabase) return undefined;
    let alive = true;
    const check = async (s) => {
      if (s?.user && !isAllowed(s.user.email, cfg.allowed)) {
        setDenied(s.user.email);
        await supabase.auth.signOut();
        if (alive) setSession(null);
        return;
      }
      if (alive) setSession(s || null);
    };
    supabase.auth.getSession().then(({ data }) => check(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { check(s); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);
  const value = useMemo(() => ({ user: session?.user || null, enabled: !!supabase, signOut: supabase ? () => supabase.auth.signOut() : null }), [session]);
  if (!supabase) return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  if (session === undefined) return <div className="auth-page"><p className="hint">Cargando…</p></div>;
  if (!session) return <LoginForm denied={denied} />;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function LoginForm({ denied }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(denied ? `${denied} no tiene acceso a esta app.` : null);
  const send = async (e) => {
    e.preventDefault();
    const em = normalizeEmail(email);
    if (!isEmail(em)) { setMsg('Escribí un email válido.'); return; }
    if (!isAllowed(em, cfg.allowed)) { setMsg('Ese email no tiene acceso. Pedile al administrador que te invite.'); return; }
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.signInWithOtp({ email: em, options: { shouldCreateUser: false, emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) setMsg(authErrorText(error)); else setSent(true);
  };
  const verify = async (e) => {
    e.preventDefault();
    if (!isOtpCode(code)) { setMsg('El código son los números que llegaron por email.'); return; }
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.verifyOtp({ email: normalizeEmail(email), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setMsg(authErrorText(error));
  };
  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={sent ? verify : send}>
        <div className="brand">Muebles<b>App</b></div>
        {!sent ? (
          <>
            <p>Entrá con tu email: te mandamos un código (o un enlace) para ingresar.</p>
            <label className="field"><span>Email</span><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></label>
            <button className="active" disabled={busy}>{busy ? 'Enviando…' : 'Enviar código'}</button>
          </>
        ) : (
          <>
            <p>Te mandamos un email a <b>{normalizeEmail(email)}</b>. Escribí el código o tocá el enlace del email.</p>
            <label className="field"><span>Código</span><input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} autoFocus /></label>
            <button className="active" disabled={busy}>{busy ? 'Verificando…' : 'Entrar'}</button>
            <button type="button" className="link" onClick={() => { setSent(false); setCode(''); setMsg(null); }}>Usar otro email</button>
          </>
        )}
        {msg && <p className="auth-msg" role="alert">{msg}</p>}
      </form>
    </div>
  );
}
