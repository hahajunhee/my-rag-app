// src/app/page.tsx
'use client'; 
import { Fragment } from 'react';

export default function Home() {
  return (
    // <style jsx> 태그를 제거하고 className만 사용합니다.
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
          <a href="/login" className="cta-button">
            시작하기 (로그인)
          </a>
        </div>
        
        <div>

        </div>
      </div>
    </Fragment>
  );
}