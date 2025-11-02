'use client';
import { Fragment, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // --- 1️⃣ 로컬 세션 즉시 확인 (초기 깜빡임 방지)
    const sessionStr = localStorage.getItem('sb-rag-auth-auth-token');
    if (sessionStr) {
      try {
        const parsed = JSON.parse(sessionStr);
        setUser(parsed?.user ?? null);
      } catch {}
    }

    // --- 2️⃣ Supabase에서 실제 유저 세션 동기화
    async function fetchUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
      setReady(true);
    }
    fetchUser();

    // --- 3️⃣ 로그인/로그아웃 상태 변화 감지
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!ready && !user) {
    return <div className="p-4 text-gray-500">로딩 중...</div>;
  }

  const isLoggedIn = Boolean(user);

  // 🌐 환경 감지: 로컬 vs 실서버
  const isLocal =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const buttonHref = isLoggedIn
    ? isLocal
      ? 'http://localhost:3000/upload'
      : 'https://logichology.com/upload'
    : '/login';

  const buttonText = isLoggedIn ? '업무 등록하러 가기' : '시작하기 (로그인)';

  return (
    <Fragment>
      <div className="home-container container">
        <div className="hero-section">
          <h1>
            당신의 업무, <br />
            AI가 기억합니다.
          </h1>
          <p className="subtitle">
            업무 기록, 매뉴얼, 노하우를 업로드하세요.
            필요할 때 AI가 즉시 찾아주고, 절차를 알려드립니다.
          </p>
          <a href={buttonHref} className="cta-button">
            {buttonText}
          </a>
        </div>
      </div>
    </Fragment>
  );
}
