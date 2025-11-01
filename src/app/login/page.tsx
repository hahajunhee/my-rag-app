// src/app/login/page.tsx
'use client';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState, Fragment } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, _session) => {});
    return () => { listener.subscription.unsubscribe(); };
  }, []);

  function resetMessages() { setMsg(null); setOk(null); }

  function validateInputs(): string | null {
    const e = email.trim(); const p = password;
    if (!e) return '이메일을 입력하세요.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return '올바른 이메일 형식이 아닙니다.';
    if (!p) return '비밀번호를 입력하세요.';
    if (p.length < 6) return '비밀번호는 최소 6자 이상이어야 합니다.';
    return null;
  }

  async function signIn() {
    resetMessages(); const v = validateInputs();
    if (v) { setMsg(v); return; }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setMsg(mapAuthError(error.message));
    } else {
      setOk('로그인 성공. 메인 페이지로 이동합니다.');
      setTimeout(() => { location.href = '/'; }, 1000);
    }
  }

  async function signUp() {
    resetMessages(); const v = validateInputs();
    if (v) { setMsg(v); return; }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? `${location.origin}/login` : undefined
      }
    });
    if (error) { setMsg(mapAuthError(error.message)); return; }
    setOk('회원가입 요청 완료. (이메일 확인을 켰다면 받은 메일에서 확인하세요)');
  }

  async function signOut() {
    resetMessages(); await supabase.auth.signOut(); setOk('로그아웃 되었습니다.');
  }

  function mapAuthError(raw: string): string {
    const s = raw.toLowerCase();
    if (s.includes('invalid login credentials')) return '로그인 정보가 올바르지 않습니다.';
    if (s.includes('user already registered')) return '이미 가입된 이메일입니다. 로그인해주세요.';
    return raw;
  }

  return (
    // <style jsx> 태그를 제거하고 className만 사용합니다.
    <Fragment>
      <div className="login-container">
        <h1 className="title">로그인 / 회원가입</h1>
        <input
          placeholder="Email"
          className="form-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={() => resetMessages()}
        />
        <input
          placeholder="Password (최소 6자)"
          type="password"
          className="form-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onFocus={() => resetMessages()}
        />
        {msg && <div className="message-area error-msg">{msg}</div>}
        {ok && <div className="message-area success-msg">{ok}</div>}
        <div className="button-group">
          <button onClick={signIn} className="form-button primary">
            로그인
          </button>
          <button onClick={signUp} className="form-button secondary">
            회원가입
          </button>
          <button onClick={signOut} className="form-button tertiary">
            로그아웃
          </button>
        </div>
      </div>
    </Fragment>
  );
}