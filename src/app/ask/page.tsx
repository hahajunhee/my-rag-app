// src/app/ask/page.tsx
'use client';
import { useState, Fragment, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

// --- 타입 정의 ---
type Citation = {
  idx: number;
  chunk_id: string;
  document_id: string;
  excerpt: string;
};

// 채팅 메시지 타입 (사용자 또는 AI)
type ChatMessage = {
  role: 'user' | 'ai';
  content: string;
  citations?: Citation[]; // AI 답변에만 포함
};

export default function AskPage() {
  // --- 상태(State) 정의 ---
  const [currentQuery, setCurrentQuery] = useState(''); // 현재 입력창의 텍스트
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]); // 채팅 내역
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // 자동 스크롤을 위한 Ref
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- 효과(Effect) 정의 ---
  // chatHistory나 loading 상태가 변경될 때마다 맨 아래로 스크롤
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, loading]);

  // --- 함수 정의 ---
  async function ask() {
    // 입력이 비어있으면 무시
    if (!currentQuery.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    
    // 1. 사용자 메시지를 채팅 내역에 추가
    const userMessage: ChatMessage = {
      role: 'user',
      content: currentQuery,
    };
    // (중요) 새 메시지를 추가할 때, 로딩 상태를 표시하기 위해 chatHistory를 즉시 업데이트
    setChatHistory(prev => [...prev, userMessage]);

    const queryToSubmit = currentQuery; // 현재 쿼리 저장
    setCurrentQuery(''); // 입력창 비우기

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setErrorMsg('로그인이 필요합니다. 먼저 /login 페이지에서 로그인해주세요.');
      setLoading(false);
      return;
    }

    try {
      const r = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, question: queryToSubmit }),
      });
      
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'ask failed');

      // 2. AI 응답 메시지를 채팅 내역에 추가
      const aiMessage: ChatMessage = {
        role: 'ai',
        content: j.answer,
        citations: j.citations || [],
      };
      setChatHistory(prev => [...prev, aiMessage]);

    } catch (e: any) {
      setErrorMsg(e.message || '오류');
      // 오류 발생 시, AI가 오류 메시지를 보낸 것처럼 처리
      const errorMessage: ChatMessage = {
        role: 'ai',
        content: `죄송합니다. 오류가 발생했습니다: ${e.message}`,
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  // Enter 키로 전송하는 핸들러
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 한글 입력 중 Enter 키(조합 완료) 방지
    if (e.key === 'Enter' && !e.nativeEvent.isComposing && !loading) {
      e.preventDefault(); // Form 전송 방지 (여기선 Form이 없지만)
      ask();
    }
  };

  return (
    <Fragment>
      {/* --- 스타일 --- */}
      <style jsx>{`
        .chat-container {
          max-width: 820px;
          margin: 2rem auto;
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          display: flex;
          flex-direction: column;
          height: calc(80vh - 40px); /* 화면 높이에 맞춰 조절 (네비바 등 제외) */
        }
        .title {
          text-align: center;
          font-size: 1.8em;
          font-weight: 700;
          color: #212529;
          padding: 1.5rem;
          border-bottom: 1px solid #e9ecef;
        }
        .chat-history {
          flex-grow: 1; /* 남은 공간을 모두 차지 */
          padding: 1.5rem;
          overflow-y: auto; /* 스크롤바 */
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .message-bubble {
          padding: 12px 18px;
          border-radius: 18px;
          max-width: 75%;
          line-height: 1.6;
        }
        .user {
          background-color: #007bff;
          color: white;
          align-self: flex-end; /* 오른쪽 정렬 */
          border-bottom-right-radius: 5px;
        }
        .ai {
          background-color: #f1f3f5;
          color: #343a40;
          align-self: flex-start; /* 왼쪽 정렬 */
          border-bottom-left-radius: 5px;
          white-space: pre-wrap; /* \n 줄바꿈 적용 */
        }
        .loading-indicator {
          align-self: flex-start;
          color: #868e96;
          font-style: italic;
        }
        /* --- 근거 단락 스타일 --- */
        .citation-container {
          margin-top: 1rem;
          border-top: 1px dashed #ced4da;
          padding-top: 1rem;
        }
        .citation-title {
          font-weight: 600;
          font-size: 0.9em;
          margin-bottom: 0.5rem;
          color: #495057;
        }
        .citation-list {
          display: grid; gap: 0.5rem; padding-left: 0; list-style: none;
        }
        .citation-item {
          background: #e9ecef; padding: 8px 12px; border-radius: 6px;
          font-size: 0.85em;
        }
        .citation-meta {
          font-size: 0.8em; color: #6c757d; display: block;
        }
        /* --- 입력창 --- */
        .input-container {
          border-top: 1px solid #e9ecef;
          padding: 1rem 1.5rem;
          display: flex;
          gap: 0.5rem;
        }
        .chat-input {
          flex-grow: 1;
          padding: 12px 15px;
          border: 1px solid #ced4da;
          border-radius: 20px;
          font-size: 1em;
        }
        .chat-input:focus {
          outline: none; border-color: #007bff;
          box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.2);
        }
        .send-button {
          padding: 10px 15px;
          border-radius: 50%; /* 동그란 버튼 */
          border: none;
          background-color: #007bff;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.2s;
        }
        .send-button:hover { background-color: #0056b3; }
        .send-button:disabled { background-color: #a0cfff; cursor: not-allowed; }
        .error-msg {
          text-align: center; color: #dc3545; padding: 0 1.5rem 1rem;
        }
      `}</style>

      {/* --- HTML 구조 --- */}
      <div className="chat-container">
        <h1 className="title">업무 질문 AI</h1>
        
        {/* --- 채팅 내역 --- */}
        <div className="chat-history">
          {chatHistory.map((msg, index) => (
            <div
              key={index}
              className={`message-bubble ${msg.role === 'user' ? 'user' : 'ai'}`}
            >
              {msg.content}
              
              {/* AI 답변이고, 근거가 있을 때만 표시 */}
              {msg.role === 'ai' && msg.citations && msg.citations.length > 0 && (
                <div className="citation-container">
                  <span className="citation-title">근거 단락</span>
                  <ul className="citation-list">
                    {msg.citations.map(c => (
                      <li key={c.chunk_id} className="citation-item">
                        <span className="citation-meta">
                          Doc: {c.document_id}
                        </span>
                        {c.excerpt}...
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}

          {/* 로딩 중일 때 "..." 표시 */}
          {loading && (
            <div className="loading-indicator">
              AI가 답변을 생각 중입니다...
            </div>
          )}
          
          {/* 스크롤을 위한 빈 div */}
          <div ref={chatEndRef} />
        </div>
        
        {/* 로그인 에러 등 공통 에러 메시지 */}
        {errorMsg && <div className="error-msg">⚠️ {errorMsg}</div>}

        {/* --- 입력창 --- */}
        <div className="input-container">
          <input
            className="chat-input"
            placeholder="업무에 대해 질문해보세요..."
            value={currentQuery}
            onChange={e => setCurrentQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            onClick={ask}
            disabled={loading || !currentQuery.trim()}
            className="send-button"
            aria-label="Send message"
          >
            {/* 전송 아이콘 (SVG) */}
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    </Fragment>
  );
}