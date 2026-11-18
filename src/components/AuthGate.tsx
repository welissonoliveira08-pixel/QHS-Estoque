import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';

type AuthMode = 'login' | 'first_access' | 'reset';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    accessStatus,
    authError,
    firebaseUser,
    signInWithEmail,
    registerFirstAccessWithEmail,
    resendVerificationEmail,
    checkEmailVerified,
    sendPasswordReset,
    signInWithGoogle,
    signOutGoogle,
  } = useApp();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);

  if (accessStatus === 'ready') {
    return <>{children}</>;
  }

  if (accessStatus === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white">
        <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center font-black text-lg shadow-lg shadow-red-950/50 border border-red-500 mb-4">
          QHS
        </div>
        <div className="flex items-center gap-2.5 text-sm font-medium text-zinc-300">
          <Loader2 className="w-4 h-4 animate-spin text-red-500" />
          <span>Conectando ao banco de dados QHS Engenharia...</span>
        </div>
      </div>
    );
  }

  if (accessStatus === 'email_unverified') {
    const handleCheckVerified = async () => {
      setSubmitting(true);
      setLocalError(null);
      setLocalSuccess(null);
      const res = await checkEmailVerified();
      setSubmitting(false);
      if (!res.verified && res.message) {
        setLocalError(res.message);
      }
    };

    const handleResend = async () => {
      setSubmitting(true);
      setLocalError(null);
      setLocalSuccess(null);
      const res = await resendVerificationEmail();
      setSubmitting(false);
      if (res.success && res.message) {
        setLocalSuccess(res.message);
      } else if (res.message) {
        setLocalError(res.message);
      }
    };

    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden">
          <div className="bg-zinc-900 px-6 py-5 flex items-center gap-3 border-b border-zinc-800">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center text-white font-black text-sm border border-red-500">
              QHS
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-white tracking-tight">
                QHS <span className="text-red-500">ENGENHARIA</span>
              </h1>
              <p className="text-[11px] text-zinc-400">Confirmação de Primeiro Acesso</p>
            </div>
          </div>

          <div className="p-6 space-y-5 text-center">
            <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center mx-auto text-amber-600">
              <MailCheck className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-zinc-900">Confirme seu E-mail</h2>
              <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
                Enviamos um link de confirmação para o e-mail abaixo. Abra sua caixa de entrada (ou pasta de spam), clique no link e depois clique em <strong>Já confirmei meu e-mail</strong>.
              </p>
            </div>

            {firebaseUser?.email && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-700 break-all font-mono font-semibold">
                {firebaseUser.email}
              </div>
            )}

            {localError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-800 text-left">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{localError}</span>
              </div>
            )}

            {localSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2 text-xs text-emerald-800 text-left">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{localSuccess}</span>
              </div>
            )}

            <div className="space-y-2.5">
              <button
                onClick={handleCheckVerified}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Já confirmei meu e-mail — Entrar
              </button>

              <button
                onClick={handleResend}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-60 text-zinc-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reenviar link de confirmação
              </button>

              <button
                onClick={() => {
                  setLocalError(null);
                  setLocalSuccess(null);
                  void signOutGoogle();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-zinc-500 hover:text-zinc-900 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair e usar outro e-mail
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (accessStatus === 'unauthorized') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden">
          <div className="bg-zinc-900 px-6 py-5 flex items-center gap-3 border-b border-zinc-800">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center text-white font-black text-sm border border-red-500">
              QHS
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-white tracking-tight">
                QHS <span className="text-red-500">ENGENHARIA</span>
              </h1>
              <p className="text-[11px] text-zinc-400">Almoxarifado & Materiais</p>
            </div>
          </div>

          <div className="p-6 space-y-5 text-center">
            <div className="w-14 h-14 bg-red-50 border border-red-200 rounded-full flex items-center justify-center mx-auto text-red-600">
              <Lock className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-zinc-900">Acesso Não Autorizado</h2>
              <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
                {authError ||
                  'Este e-mail não está vinculado a um usuário ativo na QHS Engenharia.'}
              </p>
            </div>

            {firebaseUser?.email && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-700 break-all">
                Conta conectada: <strong className="font-mono">{firebaseUser.email}</strong>
              </div>
            )}

            <p className="text-[11px] text-zinc-500">
              Solicite ao Administrador o cadastro e ativação do seu e-mail na aba Configurações.
            </p>

            <button
              onClick={signOutGoogle}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sair e Trocar E-mail
            </button>
          </div>
        </div>
      </div>
    );
  }

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setLocalError(null);
    setLocalSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setLocalSuccess(null);

    if (mode === 'login') {
      setSubmitting(true);
      const res = await signInWithEmail(email, password);
      setSubmitting(false);
      if (!res.success && res.message) {
        setLocalError(res.message);
      }
      return;
    }

    if (mode === 'first_access') {
      if (password.length < 6) {
        setLocalError('A senha deve ter no mínimo 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('As senhas digitadas não coincidem.');
        return;
      }
      setSubmitting(true);
      const res = await registerFirstAccessWithEmail(email, password);
      setSubmitting(false);
      if (!res.success && res.message) {
        setLocalError(res.message);
      } else if (res.success && res.message) {
        setLocalSuccess(res.message);
      }
      return;
    }

    if (mode === 'reset') {
      setSubmitting(true);
      const res = await sendPasswordReset(email);
      setSubmitting(false);
      if (res.success && res.message) {
        setLocalSuccess(res.message);
      } else if (res.message) {
        setLocalError(res.message);
      }
    }
  };

  const displayedError = localError || authError;

  // Unauthenticated Screen
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden">
        <div className="bg-zinc-900 px-6 py-5 border-b border-zinc-800 flex items-center gap-3.5">
          <div className="w-11 h-11 bg-red-600 rounded-xl flex items-center justify-center text-white font-black tracking-tight text-base shadow-md shadow-red-950/40 border border-red-500">
            QHS
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white tracking-tight leading-none">
              QHS <span className="text-red-500">ENGENHARIA</span>
            </h1>
            <p className="text-[11px] text-zinc-400 uppercase tracking-wider mt-1 font-medium">
              Almoxarifado & Controle de Estoque
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-7 space-y-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-red-600 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              Acesso Corporativo por E-mail
            </div>
            <h2 className="text-xl font-bold text-zinc-900">
              {mode === 'login'
                ? 'Entrar no Sistema'
                : mode === 'first_access'
                ? 'Primeiro Acesso com E-mail'
                : 'Definir ou Redefinir Senha'}
            </h2>
            <p className="text-xs text-zinc-600 leading-relaxed">
              {mode === 'login'
                ? 'Entre com o e-mail autorizado pelo Administrador e sua senha.'
                : mode === 'first_access'
                ? 'Informe o e-mail liberado pelo Administrador e crie sua senha pessoal para o primeiro acesso.'
                : 'Informe seu e-mail autorizado para receber um link de criação ou redefinição de senha.'}
            </p>
          </div>

          {/* Mode Tabs */}
          {mode !== 'reset' && (
            <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-100 rounded-xl border border-zinc-200">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-zinc-900 shadow-xs border border-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                Já tenho senha
              </button>
              <button
                type="button"
                onClick={() => switchMode('first_access')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mode === 'first_access'
                    ? 'bg-white text-red-600 shadow-xs border border-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Primeiro Acesso
              </button>
            </div>
          )}

          {displayedError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2 text-xs text-red-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{displayedError}</span>
              </div>
              {mode !== 'reset' && email.trim().includes('@') && (
                <div className="flex flex-wrap gap-2 pl-6 pt-1">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={async () => {
                      setLocalError(null);
                      setLocalSuccess(null);
                      setSubmitting(true);
                      const res = await sendPasswordReset(email);
                      setSubmitting(false);
                      if (res.success && res.message) {
                        setLocalSuccess(res.message);
                      } else if (res.message) {
                        setLocalError(res.message);
                      }
                    }}
                    className="px-2.5 py-1 bg-white border border-red-300 hover:bg-red-100 text-red-800 rounded-md text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    Definir senha por e-mail
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLocalError(null);
                      void signInWithGoogle();
                    }}
                    className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-white rounded-md text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    Entrar com Google agora
                  </button>
                </div>
              )}
            </div>
          )}

          {localSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{localSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                E-mail Autorizado
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@empresa.com.br"
                  className="w-full pl-9 pr-3 py-2.5 text-xs border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-zinc-700">
                    {mode === 'first_access'
                      ? 'Criar Senha do App (mín. 6 caracteres)'
                      : 'Senha do Aplicativo'}
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('reset')}
                      className="text-[11px] font-semibold text-red-600 hover:text-red-700 cursor-pointer"
                    >
                      Esqueci / Definir senha
                    </button>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete={mode === 'first_access' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full pl-9 pr-9 py-2.5 text-xs border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {mode === 'login' && (
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Se usa Gmail e ainda não criou senha neste app, clique em{' '}
                    <strong className="text-zinc-700">Continuar com conta Google</strong> abaixo ou em{' '}
                    <strong className="text-zinc-700">Esqueci / Definir senha</strong>.
                  </p>
                )}
              </div>
            )}

            {mode === 'first_access' && (
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita sua senha"
                    className="w-full pl-9 pr-3 py-2.5 text-xs border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === 'first_access' ? (
                <UserPlus className="w-4 h-4" />
              ) : mode === 'reset' ? (
                <Mail className="w-4 h-4" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              <span>
                {mode === 'login'
                  ? 'Entrar com E-mail'
                  : mode === 'first_access'
                  ? 'Ativar Primeiro Acesso'
                  : 'Enviar Link de Redefinição'}
              </span>
            </button>

            {mode === 'reset' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="w-full py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer"
              >
                Voltar para o login
              </button>
            )}
          </form>

          <div className="relative flex items-center py-1">
            <div className="grow border-t border-zinc-200" />
            <span className="shrink mx-3 text-[11px] font-medium text-zinc-400 uppercase">
              ou
            </span>
            <div className="grow border-t border-zinc-200" />
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all border border-zinc-800 cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.8-5.4 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
              />
            </svg>
            <span>Continuar com conta Google</span>
          </button>

          <div className="pt-3 border-t border-zinc-100 text-[11px] text-zinc-500 text-center">
            Dados sincronizados em nuvem · QHS Engenharia
          </div>
        </div>
      </div>
    </div>
  );
};
