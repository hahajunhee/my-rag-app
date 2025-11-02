'use client'; 
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation'; // ✅ 페이지 이동용

export default function ClientHeader() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // 1️⃣ 현재 유저 세션 불러오기
    async function getUserSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserEmail(user.email || null);
    }
    getUserSession();

    // 2️⃣ 로그인/로그아웃 상태 실시간 감지
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          setUserEmail(session.user.email || null);
        } else if (event === 'SIGNED_OUT') {
          setUserEmail(null);
        }
      }
    );

    // 3️⃣ 리스너 정리
    return () => authListener?.subscription.unsubscribe();
  }, []);

  // ✅ 로그아웃 함수
  async function handleLogout() {
    await supabase.auth.signOut();
    setUserEmail(null);
    router.push('/login');
  }

  // ✅ 마이페이지 이동
  function goMyPage() {
    router.push('/mypage');
  }

  return (
    <header className="app-header">
      <nav className="nav-container">
        {/* --- 왼쪽 네비게이션 --- */}
        <div className="nav-links">
          <a href="/">🏠 홈</a>
          <a href="/upload">업무 등록</a>
          <a href="/list">내 업무 리스트</a>
          <a href="/ask">AI 질문하기</a>
        </div>

        {/* --- 오른쪽 (유저 정보 / 로그인 상태) --- */}
        <div className="nav-user-actions">
          {userEmail ? (
            <>
              {/* 이메일 표시 */}
              <div className="nav-user-email">
                {userEmail}
              </div>

              {/* 마이페이지 버튼 추가 */}
              <button
                onClick={goMyPage}
                className="nav-mypage-button"
                style={{
                  backgroundColor: '#444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                마이페이지
              </button>

              {/* 로그아웃 버튼 */}
              <button
                onClick={handleLogout}
                className="nav-logout-button"
                style={{
                  backgroundColor: '#888',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                로그아웃
              </button>
            </>
          ) : (
            <a href="/login" className="nav-login-button">
              로그인
            </a>
          )}
        </div>
      </nav>
    </header>
  );
}
