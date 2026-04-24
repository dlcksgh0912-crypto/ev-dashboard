import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import Dashboard from './Dashboard';

const LOGIN_COLORS = {
  bgTop: '#eef5ff',
  bgBottom: '#dbeafe',
  panel: 'rgba(255,255,255,0.96)',
  panelSoft: 'rgba(239,246,255,0.78)',
  border: '#cfe0fb',
  text: '#0f172a',
  sub: '#66758f',
  blue: '#2563eb',
  blueDeep: '#1d4ed8',
  blueSoft: '#eaf2ff',
  line: '#d8e6fb',
  white: '#ffffff',
  shadow: '0 24px 60px rgba(37, 99, 235, 0.14)',
};

function IconShield({ size = 26, color = LOGIN_COLORS.blue }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2L21 5.2V11.3C21 16.6 17.5 20.6 12 22C6.5 20.6 3 16.6 3 11.3V5.2L12 2Z" fill={color} />
    </svg>
  );
}

function IconMail({ size = 22, color = LOGIN_COLORS.blue }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 7L12 13L20 7" />
    </svg>
  );
}

function IconLock({ size = 22, color = LOGIN_COLORS.blue }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8A4 4 0 0 1 16 8V11" />
    </svg>
  );
}

function IconEye({ size = 22, color = '#64748b', off = false }) {
  return off ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94C16.19 19.17 14.16 20 12 20C7 20 2.73 15.89 1 12C1.72 10.38 2.74 8.89 4 7.64" />
      <path d="M10.58 10.58A2 2 0 0 0 13.41 13.41" />
      <path d="M9.88 4.24A10.94 10.94 0 0 1 12 4C17 4 21.27 8.11 23 12C22.34 13.48 21.44 14.84 20.35 16.03" />
      <path d="M1 1L23 23" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12S5.5 5 12 5S22 12 22 12S18.5 19 12 19S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconCheck({ size = 18, color = LOGIN_COLORS.blue }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 13L9 17L19 7" />
    </svg>
  );
}

function getRecoveryRedirectUrl() {
  if (typeof window === 'undefined') return undefined;
  return window.location.origin;
}

function LoginScreen({ mode, setMode }) {
  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const panelTitle = useMemo(() => {
    if (isReset) return '비밀번호 재설정';
    if (isForgot) return '비밀번호 찾기';
    if (isSignup) return '회원가입';
    return '로그인';
  }, [isForgot, isReset, isSignup]);

  const panelDesc = useMemo(() => {
    if (isReset) return '새 비밀번호를 입력한 후 저장해주세요.';
    if (isForgot) return '가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내드립니다.';
    if (isSignup) return '에버온 케어허브 계정을 등록하고 승인 후 이용하세요.';
    return '승인된 계정으로 로그인하여 EverOn Care Hub에 접속하세요.';
  }, [isForgot, isReset, isSignup]);

  const handleAuth = async () => {
    if (isForgot) {
      if (!email.trim()) {
        alert('이메일을 입력해주세요.');
        return;
      }

      setLoading(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: getRecoveryRedirectUrl(),
        });

        if (error) {
          alert(error.message);
          return;
        }

        alert('비밀번호 재설정 메일을 발송했습니다. 메일함에서 링크를 확인해주세요.');
        setMode('login');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (isReset) {
      if (!password.trim() || !confirmPassword.trim()) {
        alert('새 비밀번호와 비밀번호 확인을 입력해주세요.');
        return;
      }

      if (password !== confirmPassword) {
        alert('비밀번호가 서로 다릅니다. 다시 확인해주세요.');
        return;
      }

      if (password.length < 6) {
        alert('비밀번호는 6자 이상으로 입력해주세요.');
        return;
      }

      setLoading(true);
      try {
        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
          alert(error.message);
          return;
        }

        if (typeof window !== 'undefined') {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        alert('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.');
        await supabase.auth.signOut();
        setPassword('');
        setConfirmPassword('');
        setMode('login');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email.trim() || !password.trim()) {
      alert('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) {
          alert(error.message);
          return;
        }

        alert('회원가입이 완료되었습니다. 관리자 승인 후 로그인 가능합니다.');
        setMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          alert(error.message);
          return;
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={loginStyles.page}>
      <div style={loginStyles.bgWaveOne} />
      <div style={loginStyles.bgWaveTwo} />

      <div style={loginStyles.layout}>
        <section style={loginStyles.loginPanel}>
          <div style={loginStyles.brandWrap}>
            <div style={loginStyles.brandBadge}>
              <IconShield size={28} />
            </div>
            <div>
              <div style={loginStyles.brandTitle}>
                <span style={{ color: LOGIN_COLORS.blue }}>EverOn</span> Care Hub
              </div>
              <div style={loginStyles.brandSub}>에버온 통합 관리 시스템</div>
            </div>
          </div>

          <div style={loginStyles.loginBox}>
            <div style={loginStyles.titleBlock}>
              <div style={loginStyles.loginTitle}>{panelTitle}</div>
              <div style={loginStyles.loginDesc}>{panelDesc}</div>
            </div>

            {!isReset && (
              <>
                <div style={loginStyles.fieldLabel}>이메일</div>
                <div style={loginStyles.inputShell}>
                  <div style={loginStyles.inputIcon}><IconMail /></div>
                  <input
                    type="email"
                    placeholder="이메일을 입력하세요"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={loginStyles.input}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAuth();
                    }}
                  />
                </div>
              </>
            )}

            {!isForgot && (
              <>
                <div style={loginStyles.fieldLabel}>{isReset ? '새 비밀번호' : '비밀번호'}</div>
                <div style={loginStyles.inputShell}>
                  <div style={loginStyles.inputIcon}><IconLock /></div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={isReset ? '새 비밀번호를 입력하세요' : '비밀번호를 입력하세요'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={loginStyles.input}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAuth();
                    }}
                  />
                  <button
                    type="button"
                    style={loginStyles.eyeButton}
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                  >
                    <IconEye off={showPassword} />
                  </button>
                </div>
              </>
            )}

            {isReset && (
              <>
                <div style={loginStyles.fieldLabel}>비밀번호 확인</div>
                <div style={loginStyles.inputShell}>
                  <div style={loginStyles.inputIcon}><IconLock /></div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="새 비밀번호를 다시 입력하세요"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={loginStyles.input}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAuth();
                    }}
                  />
                </div>
              </>
            )}

            {!isSignup && !isForgot && !isReset && (
              <div style={loginStyles.utilityRow}>
                <button
                  type="button"
                  style={loginStyles.linkButton}
                  onClick={() => setMode('forgot')}
                >
                  비밀번호 찾기
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleAuth}
              style={{
                ...loginStyles.primaryButton,
                opacity: loading ? 0.75 : 1,
                cursor: loading ? 'default' : 'pointer',
              }}
              disabled={loading}
            >
              {loading
                ? '처리 중...'
                : isReset
                  ? '새 비밀번호 저장'
                  : isForgot
                    ? '재설정 메일 보내기'
                    : isSignup
                      ? '회원가입'
                      : '로그인'}
            </button>

            <div style={loginStyles.dividerRow}>
              <div style={loginStyles.dividerLine} />
              <div style={loginStyles.dividerText}>또는</div>
              <div style={loginStyles.dividerLine} />
            </div>

            {isForgot ? (
              <button
                type="button"
                style={loginStyles.secondaryButton}
                onClick={() => setMode('login')}
              >
                로그인으로 돌아가기
              </button>
            ) : isReset ? (
              <button
                type="button"
                style={loginStyles.secondaryButton}
                onClick={async () => {
                  if (typeof window !== 'undefined') {
                    window.history.replaceState({}, document.title, window.location.pathname);
                  }
                  await supabase.auth.signOut();
                  setMode('login');
                }}
              >
                재설정 취소
              </button>
            ) : (
              <button
                type="button"
                style={loginStyles.secondaryButton}
                onClick={() => setMode(isSignup ? 'login' : 'signup')}
              >
                {isSignup ? '로그인으로 전환' : '회원가입으로 전환'}
              </button>
            )}
          </div>
        </section>

        <aside style={loginStyles.infoPanel}>
          <div style={loginStyles.infoHeader}>
            <div style={loginStyles.infoIconWrap}>
              <IconShield size={34} />
            </div>
            <div style={loginStyles.infoTitle}>
              <span style={{ color: LOGIN_COLORS.blue }}>EverOn</span> Care Hub
            </div>
          </div>

          <div style={loginStyles.infoAccent} />

          <div style={loginStyles.featureList}>
            <div style={loginStyles.featureItem}>
              <div style={loginStyles.featureIcon}><IconCheck /></div>
              <div>실시간 운영 현황 확인</div>
            </div>
            <div style={loginStyles.featureItem}>
              <div style={loginStyles.featureIcon}><IconCheck /></div>
              <div>VOC 및 교체 예정 통합 관리</div>
            </div>
            <div style={loginStyles.featureItem}>
              <div style={loginStyles.featureIcon}><IconCheck /></div>
              <div>승인 기반 보안 시스템</div>
            </div>
            <div style={loginStyles.featureItem}>
              <div style={loginStyles.featureIcon}><IconCheck /></div>
              <div>협력업체 출동 및 자재 이력 관리</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [authMode, setAuthMode] = useState('login');

  useEffect(() => {
    let isMounted = true;

    const checkRecoveryMode = () => {
      if (typeof window === 'undefined') return false;
      const hash = window.location.hash || '';
      const query = window.location.search || '';
      return hash.includes('type=recovery') || query.includes('type=recovery');
    };

    supabase.auth.getSession().then(({ data }) => {
      const isRecovery = checkRecoveryMode();

      if (isMounted) {
        setSession(data.session ?? null);
        if (isRecovery) {
          setAuthMode('reset');
        }
      }
    });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession ?? null);

      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('reset');
        return;
      }

      if (!nextSession) {
        setAuthMode('login');
      }
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (session === undefined) {
    return (
      <div style={loadingStyles.page}>
        <div style={loadingStyles.card}>세션을 확인하는 중입니다...</div>
      </div>
    );
  }

  if (authMode === 'reset') {
    return <LoginScreen mode={authMode} setMode={setAuthMode} />;
  }

  if (!session) {
    return <LoginScreen mode={authMode} setMode={setAuthMode} />;
  }

  return <Dashboard />;
}

const loadingStyles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(180deg, #eef5ff 0%, #dbeafe 100%)',
    padding: 24,
    boxSizing: 'border-box',
    fontFamily: 'Arial, sans-serif',
  },
  card: {
    background: '#ffffff',
    border: '1px solid #d8e6fb',
    borderRadius: 18,
    padding: '20px 24px',
    boxShadow: '0 20px 50px rgba(37,99,235,0.12)',
    color: '#334155',
    fontWeight: 700,
  },
};

const loginStyles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #eef5ff 0%, #dbeafe 100%)',
    padding: 28,
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: 'Arial, sans-serif',
  },
  bgWaveOne: {
    position: 'absolute',
    left: '-10%',
    right: '-10%',
    bottom: '-120px',
    height: 260,
    background: 'rgba(147, 197, 253, 0.32)',
    borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
    transform: 'rotate(-2deg)',
  },
  bgWaveTwo: {
    position: 'absolute',
    left: '-10%',
    right: '-10%',
    bottom: '-180px',
    height: 240,
    background: 'rgba(96, 165, 250, 0.18)',
    borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
    transform: 'rotate(3deg)',
  },
  layout: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: 1320,
    minHeight: 'calc(100vh - 56px)',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.45fr) 420px',
    gap: 26,
    alignItems: 'center',
  },
  loginPanel: {
    background: 'rgba(255,255,255,0.96)',
    border: '1px solid #cfe0fb',
    borderRadius: 32,
    boxShadow: '0 24px 60px rgba(37,99,235,0.14)',
    padding: '54px 58px',
    minHeight: 760,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    boxSizing: 'border-box',
  },
  brandWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 34,
  },
  brandBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    background: '#eaf2ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brandTitle: {
    fontSize: 42,
    lineHeight: 1.05,
    fontWeight: 900,
    color: '#0f172a',
    letterSpacing: '-0.03em',
  },
  brandSub: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: 700,
    color: '#64748b',
  },
  loginBox: {
    width: '100%',
    maxWidth: 660,
  },
  titleBlock: {
    marginBottom: 28,
  },
  loginTitle: {
    fontSize: 40,
    fontWeight: 900,
    color: '#0f172a',
    marginBottom: 10,
    letterSpacing: '-0.03em',
  },
  loginDesc: {
    fontSize: 16,
    color: '#66758f',
    lineHeight: 1.6,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: 800,
    color: '#475569',
    marginBottom: 10,
    marginTop: 18,
  },
  inputShell: {
    height: 76,
    borderRadius: 18,
    border: '1px solid #d8e6fb',
    background: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '0 18px',
    boxSizing: 'border-box',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
  },
  inputIcon: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  input: {
    width: '100%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 20,
    color: '#0f172a',
  },
  eyeButton: {
    border: 'none',
    background: 'transparent',
    padding: 0,
    cursor: 'pointer',
    width: 30,
    height: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  utilityRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  linkButton: {
    border: 'none',
    background: 'transparent',
    color: '#2563eb',
    fontWeight: 800,
    fontSize: 15,
    cursor: 'pointer',
    padding: 0,
  },
  primaryButton: {
    marginTop: 26,
    width: '100%',
    height: 78,
    borderRadius: 18,
    border: 'none',
    background: 'linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)',
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 900,
    boxShadow: '0 18px 36px rgba(37,99,235,0.26)',
  },
  dividerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    margin: '24px 0',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: '#d8e6fb',
  },
  dividerText: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: 700,
  },
  secondaryButton: {
    width: '100%',
    height: 74,
    borderRadius: 18,
    border: '2px solid #8bb6ff',
    background: '#ffffff',
    color: '#2563eb',
    fontSize: 26,
    fontWeight: 900,
    cursor: 'pointer',
  },
  infoPanel: {
    background: 'rgba(239,246,255,0.78)',
    border: '1px solid #cfe0fb',
    borderRadius: 28,
    padding: '34px 34px 38px',
    boxSizing: 'border-box',
    minHeight: 480,
    boxShadow: '0 18px 40px rgba(37,99,235,0.1)',
    backdropFilter: 'blur(8px)',
  },
  infoHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 30,
  },
  infoIconWrap: {
    width: 74,
    height: 74,
    borderRadius: 999,
    background: '#dbeafe',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoTitle: {
    fontSize: 28,
    fontWeight: 900,
    color: '#0f172a',
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
  },
  infoAccent: {
    width: 56,
    height: 4,
    borderRadius: 999,
    background: '#2563eb',
    marginBottom: 26,
  },
  featureList: {
    display: 'grid',
    gap: 18,
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    color: '#0f172a',
    fontSize: 18,
    fontWeight: 700,
  },
  featureIcon: {
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
};
