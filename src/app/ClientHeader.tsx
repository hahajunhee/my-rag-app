// src/app/ClientHeader.tsx
'use client'; // ✅ 이 파일은 *반드시* 클라이언트 컴포넌트여야 합니다.

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient'; // Supabase 클라이언트 가져오기

export default function ClientHeader() {
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    // 1. 컴포넌트가 로드될 때 현재 사용자 정보를 가져옵니다.
    async function getUserSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || null);
      }
    }
    getUserSession();

    // 2. 로그인/로그아웃 상태 변경을 실시간으로 감지합니다.
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          setUserEmail(session.user.email || null);
        } else if (event === 'SIGNED_OUT') {
          setUserEmail(null);
        }
      }
    );

    // 3. 컴포넌트가 사라질 때 리스너를 정리합니다.
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []); // 이 효과는 처음에 한 번만 실행됩니다.

  return (
    <header className="app-header">
      <nav className="nav-container">
        {/* 왼쪽 링크들 */}
        <div className="nav-links">
          <a href="/">🏠 홈</a>
          <a href="/login">로그인</a>
          <a href="/upload">업무 등록</a>
          <a href="/list">내 업무 리스트</a>
          <a href="/ask">AI 질문하기</a>
        </div>
        
        {/* 오른쪽: 로그인한 사용자 이메일 */}
        {userEmail && (
          <div className="nav-user-email">
            {userEmail}
          </div>
        )}
      </nav>
    </header>
  );
}