import { FormEvent, useEffect, useState } from 'react';
import {
  AUTH_SESSION_CHANGED_EVENT,
  AUTH_STORAGE_KEY,
  authApi,
  type AuthSession,
  type CurrentUserProfile,
  type PasswordResetGrant,
} from './lib/authApi';
import { AuthLayout } from './components/layout/AuthLayout';
import { AppShell, AppPage } from './components/layout/AppShell';
import { SignInPage } from './components/auth/SignInPage';
import { SignUpPage } from './components/auth/SignUpPage';
import { OtpPage } from './components/auth/OtpPage';
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { SkuSearchPage } from './pages/SkuSearchPage';
import { ImportPage } from './pages/ImportPage';
import { ProfilePage } from './pages/ProfilePage';
import { SecurityPage } from './pages/SecurityPage';

type AuthScreen = 'sign-in' | 'sign-up' | 'verify-sign-up' | 'forgot-password' | 'verify-reset' | 'reset-password';

const readStoredSession = (): AuthSession | null => {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as AuthSession) : null;
  } catch {
    return null;
  }
};

const isSession = (value: AuthSession | PasswordResetGrant): value is AuthSession =>
  'accessToken' in value && 'refreshToken' in value;

const isResetGrant = (value: AuthSession | PasswordResetGrant): value is PasswordResetGrant =>
  'resetToken' in value;

function App() {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession());
  const [authScreen, setAuthScreen] = useState<AuthScreen>('sign-in');
  const [page, setPage] = useState<AppPage>('dashboard');
  const [profile, setProfile] = useState<CurrentUserProfile | null>(null);
  
  // Auth state
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [rememberSession, setRememberSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  
  // Security page state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  // Global feedback state
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const persistSession = (nextSession: AuthSession | null) => {
    setSession(nextSession);
    if (nextSession && rememberSession) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
      return;
    }
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const clearFeedback = () => {
    setMessage('');
    setError('');
  };

  const runRequest = async (task: () => Promise<void>) => {
    setBusy(true);
    clearFeedback();
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!session?.accessToken) return;
    void authApi
      .me(session.accessToken)
      .then((response) => setProfile(response.data))
      .catch(() => undefined);
  }, [session?.accessToken]);

  useEffect(() => {
    const handleSessionChanged = (event: Event) => {
      const nextSession = (event as CustomEvent<AuthSession | null>).detail;
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setAuthScreen('sign-in');
      }
    };

    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, handleSessionChanged);
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, handleSessionChanged);
  }, []);

  const signIn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runRequest(async () => {
      const response = await authApi.login({ email, password });
      persistSession(response.data);
      setPage('dashboard');
      setMessage('Signed in successfully.');
    });
  };

  const signUp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runRequest(async () => {
      await authApi.register({ username, email, password });
      setAuthScreen('verify-sign-up');
      setMessage('Account created. Check your email for OTP.');
    });
  };

  const verifySignUp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runRequest(async () => {
      const response = await authApi.verifyOtp({ email, code: otp, purpose: 'registration' });
      if (isSession(response.data)) {
        persistSession(response.data);
        setPage('dashboard');
      }
      setMessage('Email verified.');
    });
  };

  const sendResetOtp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runRequest(async () => {
      await authApi.forgotPassword({ email });
      setAuthScreen('verify-reset');
      setMessage('If the account exists, a reset OTP has been sent.');
    });
  };

  const verifyResetOtp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runRequest(async () => {
      const response = await authApi.verifyOtp({ email, code: otp, purpose: 'password_reset' });
      if (isResetGrant(response.data)) {
        setResetToken(response.data.resetToken);
        setAuthScreen('reset-password');
        setMessage('OTP verified. Set a new password.');
      }
    });
  };

  const resetPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runRequest(async () => {
      const response = await authApi.changePassword({ resetToken, newPassword });
      persistSession(response.data);
      setPage('dashboard');
      setMessage('Password changed successfully.');
    });
  };

  const resendOtp = (purpose: 'registration' | 'password_reset') => {
    void runRequest(async () => {
      await authApi.resendOtp({ email, purpose });
      setMessage('OTP resent.');
    });
  };

  const refreshSession = () => {
    if (!session) return;
    void runRequest(async () => {
      const response = await authApi.refreshToken(session.refreshToken);
      persistSession({ ...session, ...response.data });
      setMessage('Session refreshed.');
    });
  };

  const logout = () => {
    if (!session) return;
    void runRequest(async () => {
      try {
        await authApi.logout(session.refreshToken, session.accessToken);
      } finally {
        persistSession(null);
        setProfile(null);
        setAuthScreen('sign-in');
      }
    });
  };

  const logoutAll = () => {
    if (!session) return;
    void runRequest(async () => {
      try {
        await authApi.logoutAll(session.accessToken);
      } finally {
        persistSession(null);
        setProfile(null);
        setAuthScreen('sign-in');
      }
    });
  };

  if (!session) {
    return (
      <AuthLayout>
        {authScreen === 'sign-in' && (
          <SignInPage
            busy={busy}
            email={email}
            password={password}
            rememberSession={rememberSession}
            showPassword={showPassword}
            message={message}
            error={error}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onRememberSessionChange={setRememberSession}
            onShowPasswordChange={setShowPassword}
            onSubmit={signIn}
            onForgot={() => setAuthScreen('forgot-password')}
            onSignUp={() => setAuthScreen('sign-up')}
          />
        )}
        {authScreen === 'sign-up' && (
          <SignUpPage
            busy={busy}
            email={email}
            username={username}
            password={password}
            showPassword={showPassword}
            message={message}
            error={error}
            onEmailChange={setEmail}
            onUsernameChange={setUsername}
            onPasswordChange={setPassword}
            onShowPasswordChange={setShowPassword}
            onSubmit={signUp}
            onSignIn={() => setAuthScreen('sign-in')}
          />
        )}
        {authScreen === 'verify-sign-up' && (
          <OtpPage
            title="Verify account"
            subtitle="Enter the registration OTP sent to your email."
            busy={busy}
            otp={otp}
            message={message}
            error={error}
            onOtpChange={setOtp}
            onSubmit={verifySignUp}
            onBack={() => setAuthScreen('sign-up')}
            onResend={() => resendOtp('registration')}
          />
        )}
        {authScreen === 'forgot-password' && (
          <ForgotPasswordPage
            busy={busy}
            email={email}
            message={message}
            error={error}
            onEmailChange={setEmail}
            onSubmit={sendResetOtp}
            onBack={() => setAuthScreen('sign-in')}
          />
        )}
        {authScreen === 'verify-reset' && (
          <OtpPage
            title="Verify reset"
            subtitle="Enter the password reset OTP."
            busy={busy}
            otp={otp}
            message={message}
            error={error}
            onOtpChange={setOtp}
            onSubmit={verifyResetOtp}
            onBack={() => setAuthScreen('forgot-password')}
            onResend={() => resendOtp('password_reset')}
          />
        )}
        {authScreen === 'reset-password' && (
          <ResetPasswordPage
            busy={busy}
            newPassword={newPassword}
            showNewPassword={showNewPassword}
            message={message}
            error={error}
            onNewPasswordChange={setNewPassword}
            onShowNewPasswordChange={setShowNewPassword}
            onSubmit={resetPassword}
            onBack={() => setAuthScreen('verify-reset')}
          />
        )}
      </AuthLayout>
    );
  }

  return (
    <AppShell
      page={page}
      session={session}
      profile={profile}
      busy={busy}
      message={message}
      error={error}
      onPageChange={(next) => {
        clearFeedback();
        setPage(next);
      }}
      onRefresh={refreshSession}
      onLogout={logout}
      onLogoutAll={logoutAll}
    >
      {page === 'dashboard' && <DashboardPage session={session} profile={profile} />}
      {page === 'sku' && <SkuSearchPage session={session} />}
      {page === 'import' && <ImportPage session={session} />}
      {page === 'profile' && (
        <ProfilePage
          session={session}
          profile={profile}
          onProfileChange={setProfile}
          onMessage={setMessage}
          onError={setError}
        />
      )}
      {page === 'security' && (
        <SecurityPage
          session={session}
          currentPassword={currentPassword}
          newPassword={newPassword}
          showNewPassword={showNewPassword}
          onCurrentPasswordChange={setCurrentPassword}
          onNewPasswordChange={setNewPassword}
          onShowNewPasswordChange={setShowNewPassword}
          onSessionChange={persistSession}
          onMessage={setMessage}
          onError={setError}
        />
      )}
    </AppShell>
  );
}

export default App;
