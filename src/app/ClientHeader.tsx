// src/app/ClientHeader.tsx
'use client'; 

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation'; // ✅ 페이지 이동(redirect)을 위해 추가

export default function ClientHeader() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const router = useRouter(); // ✅ useRouter 훅 사용

  useEffect(() => {
    // 1. 컴포넌트 로드 시 현재 사용자 정보 가져오기
    async function getUserSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || null);
      }
    }
    getUserSession();

    // 2. 로그인/로그아웃 상태 변경 실시간 감지
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          setUserEmail(session.user.email || null);
        } else if (event === 'SIGNED_OUT') {
          setUserEmail(null);
        }
      }
    );

    // 3. 리스너 정리
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // ✅ 4. 로그아웃 함수 (신규)
  async function handleLogout() {
    await supabase.auth.signOut();
    setUserEmail(null); // 상태를 로그아웃으로 변경
    router.push('/login'); // 로그아웃 후 로그인 페이지로 이동
  }

  return (
    <header className="app-header">
      <nav className="nav-container">
        {/* --- ✅ 왼쪽 링크들 (로그인 링크 제거) --- */}
        <div className="nav-links">
          <a href="/">🏠 홈</a>
          <a href="/upload">업무 등록</a>
          <a href="/list">내 업무 리스트</a>
          <a href="/ask">AI 질문하기</a>
        </div>
        
        {/* --- ✅ 오른쪽 (로그인/로그아웃 상태) --- */}
        <div className="nav-user-actions">
          {userEmail ? (
            // 1. 로그인된 경우: 이메일과 로그아웃 버튼
            <>
              <div className="nav-user-email">
                {userEmail}
              </div>
              <button onClick={handleLogout} className="nav-logout-button">
                로그아웃
              </button>
            </>
          ) : (
            // 2. 로그아웃된 경우: 로그인 버튼
            <a href="/login" className="nav-login-button">
              로그인
            </a>
          )}
        </div>
      </nav>
    </header>
  );
}