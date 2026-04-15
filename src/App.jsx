import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import Dashboard from './Dashboard'

function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignup, setIsSignup] = useState(false)

  const handleAuth = async () => {
    if (isSignup) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        alert(error.message)
        return
      }
      alert('회원가입 완료')
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) alert(error.message)
    }
  }

  return (
    <div style={{ padding: 40 }}>
      <h2>EV 대시보드 로그인</h2>

      <input
        placeholder="이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <br /><br />

      <input
        type="password"
        placeholder="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <br /><br />

      <button onClick={handleAuth}>
        {isSignup ? '회원가입' : '로그인'}
      </button>

      <br /><br />

      <button onClick={() => setIsSignup(!isSignup)}>
        {isSignup ? '로그인으로 전환' : '회원가입으로 전환'}
      </button>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!session) return <AuthScreen />

  return <Dashboard />
}