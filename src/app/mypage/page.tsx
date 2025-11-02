'use client';
import { useState } from 'react';

// --- 스타일 객체 정의 ---
// 컴포넌트 외부에 정의해도 되지만, 가독성을 위해 함수 내 상단에 둡니다.

const pageStyle: React.CSSProperties = {
  padding: '48px 24px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  backgroundColor: '#f9fafb', // 페이지 배경색
  minHeight: '100vh',
};

const titleStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '2.5rem',
  fontWeight: 'bold',
  marginBottom: 48,
  color: '#111827',
};

const plansContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: 24,
  flexWrap: 'wrap', // 화면이 작아지면 줄바꿈
};

const planCardBaseStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 32,
  width: 300,
  textAlign: 'center',
  backgroundColor: '#ffffff',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
};

// Pro 플랜을 강조하기 위한 추가 스타일
const proCardStyle: React.CSSProperties = {
  ...planCardBaseStyle,
  border: '2px solid #3b82f6', // 파란색 테두리
  transform: 'scale(1.03)', // 살짝 크게
  boxShadow: '0 8px 20px rgba(59, 130, 246, 0.15)',
};

const planTitleStyle: React.CSSProperties = {
  fontSize: '1.75rem',
  fontWeight: 600,
  marginBottom: 16,
  color: '#111827',
};

const planFeatureStyle: React.CSSProperties = {
  fontSize: '1.1rem',
  color: '#4b5563',
  marginBottom: 32,
  minHeight: '2.5em', // 카드 높이를 맞추기 위한 최소 높이
  fontWeight: 500,
};

const buttonBaseStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 0',
  fontSize: '1rem',
  fontWeight: 600,
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  transition: 'background-color 0.2s ease, opacity 0.2s',
};

// 플랜별 버튼 스타일
const freeButtonStyle: React.CSSProperties = {
  ...buttonBaseStyle,
  backgroundColor: '#e5e7eb',
  color: '#374151',
  cursor: 'not-allowed',
};

const basicButtonStyle: React.CSSProperties = {
  ...buttonBaseStyle,
  backgroundColor: '#d1d5db',
  color: '#4b5563',
  cursor: 'not-allowed',
};

const proButtonStyle: React.CSSProperties = {
  ...buttonBaseStyle,
  backgroundColor: '#3b82f6',
  color: 'white',
};

const proButtonLoadingStyle: React.CSSProperties = {
  ...proButtonStyle,
  backgroundColor: '#93c5fd', // 로딩 중 연한 파란색
  cursor: 'wait',
};


// --- 컴포넌트 본체 ---

export default function MyPage() {
  const [loading, setLoading] = useState(false);

  // 결제 처리 함수
  async function handlePayplePay() {
    setLoading(true);
    try {
      const res = await fetch('/api/payple/checkout', { method: 'POST' });
      
      if (!res.ok) {
        throw new Error(`API Error: ${res.statusText}`);
      }
      
      const { url } = await res.json();
      
      if (url) {
        window.location.href = url; // 결제 페이지로 이동
      } else {
        throw new Error('결제 URL을 받지 못했습니다.');
      }
    } catch (error) {
      console.error('결제 처리 중 오류 발생:', error);
      alert('결제 진행 중 문제가 발생했습니다. 다시 시도해 주세요.');
      setLoading(false); // 오류 발생 시 로딩 상태 해제
    }
  }

  // --- JSX 렌더링 ---

  return (
    <div style={pageStyle}>
      <h1 style={titleStyle}>구독 플랜</h1>

      <div style={plansContainerStyle}>
        
        {/* --- Free 플랜 카드 --- */}
        <div style={planCardBaseStyle}>
          <h2 style={planTitleStyle}>Free</h2>
          <p style={planFeatureStyle}>
            <strong>4o mini</strong> 모델
          </p>
          <button style={freeButtonStyle} disabled>
            현재 플랜
          </button>
        </div>

        {/* --- Basic 플랜 카드 --- */}
        <div style={planCardBaseStyle}>
          <h2 style={planTitleStyle}>Basic</h2>
          <p style={planFeatureStyle}>
            <strong>GPT-4o</strong> 모델
          </p>
          <button style={basicButtonStyle} disabled>
            준비중
          </button>
        </div>

        {/* --- Pro 플랜 카드 (강조) --- */}
        <div style={proCardStyle}>
          <h2 style={planTitleStyle}>Pro</h2>
          <p style={planFeatureStyle}>
            <strong>GPT-5</strong> (출시 시) 우선 접근
          </p>
          <button
            style={loading ? proButtonLoadingStyle : proButtonStyle}
            onClick={handlePayplePay}
            disabled={loading}
          >
            {loading ? '처리중...' : 'PRO 구독하기 (₩9,900)'}
          </button>
        </div>

      </div>
    </div>
  );
}