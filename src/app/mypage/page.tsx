'use client';
import { useState } from 'react';

export default function MyPage() {
  const [loading, setLoading] = useState(false);

  async function handlePayplePay() {
    setLoading(true);
    const res = await fetch('/api/payple/checkout', { method: 'POST' });
    const { url } = await res.json();
    window.location.href = url; // 결제 페이지로 이동
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>마이페이지</h1>
      <button onClick={handlePayplePay} disabled={loading}>
        {loading ? '처리중...' : 'PRO 구독하기 (₩9,900)'}
      </button>
    </div>
  );
}
