// src/app/upload/page.tsx
'use client';
import { useState, Fragment } from 'react';
import { supabase } from '@/lib/supabaseClient';

type StructuredTask = { title: string; manual: string; };

export default function UploadPage() {
  const [raw, setRaw] = useState('');
  const [loadingAnalyze, setLoadingAnalyze] = useState(false);
  const [loadingSaveAll, setLoadingSaveAll] = useState(false);
  const [tasks, setTasks] = useState<StructuredTask[]>([]);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function resetMessages() { setErrorMsg(null); setSuccessMsg(null); }

  async function handleAnalyze() {
    setLoadingAnalyze(true); resetMessages(); setTasks([]); setEditIndex(null);
    if (!raw.trim()) {
      setErrorMsg('분석할 텍스트를 입력해주세요.'); setLoadingAnalyze(false); return;
    }
    try {
      const r = await fetch('/api/structure', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: raw }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed to structure text');
      setTasks(j.tasks || []);
      setSuccessMsg(`✅ AI가 ${j.tasks?.length || 0}개의 업무를 감지했습니다.`);
    } catch (e: any) { setErrorMsg(e.message || '분석 중 오류 발생');
    } finally { setLoadingAnalyze(false); }
  }
  
  function handleDeleteTask(indexToDelete: number) {
    const taskTitle = tasks[indexToDelete].title;
    if (confirm(`[${taskTitle}] 항목을 목록에서 삭제하시겠습니까?`)) {
      setTasks(prevTasks => prevTasks.filter((_, index) => index !== indexToDelete));
      setSuccessMsg("항목을 목록에서 삭제했습니다.");
    }
  }

  function handleTaskChange(index: number, field: 'title' | 'manual', value: string) {
    setTasks(prevTasks => {
      const newTasks = [...prevTasks];
      newTasks[index] = { ...newTasks[index], [field]: value };
      return newTasks;
    });
  }
  
  async function handleSaveAll() {
    if (tasks.length === 0) { setErrorMsg("저장할 업무가 없습니다."); return; }
    setLoadingSaveAll(true); resetMessages(); setEditIndex(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setErrorMsg('저장을 위해 로그인이 필요합니다.'); setLoadingSaveAll(false); return;
    }
    let successCount = 0; let failCount = 0;
    const savePromises = tasks.map(task => {
      return fetch('/api/ingest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, title: task.title, raw_text: task.manual }),
      })
      .then(response => {
        if (response.ok) successCount++; else failCount++;
        return response.json();
      }).catch(() => { failCount++; });
    });
    try {
      await Promise.all(savePromises);
      if (failCount > 0) {
        setErrorMsg(`총 ${tasks.length}개 중 ${failCount}개 저장 실패, ${successCount}개 저장 성공.`);
      } else {
        setSuccessMsg(`✅ ${successCount}개의 모든 업무가 '내 업무 리스트'에 성공적으로 저장되었습니다.`);
        setTasks([]); setRaw('');
      }
    } catch (e: any) { setErrorMsg(`저장 중 예외 발생: ${e.message}`);
    } finally { setLoadingSaveAll(false); }
  }

  return (
    // <style jsx> 태그를 제거하고 className만 사용합니다.
    <Fragment>
      <div className="upload-container">
        <h1 className="title">업무 지식 등록 (AI 분석)</h1>
        <div className="form-group">
          <label htmlFor="raw" className="form-label">
            분석할 업무 내용 (여러 개를 한 번에 붙여넣으세요)
          </label>
          <textarea
            id="raw"
            placeholder={`(예시)\n[업무 1: 인보이스 발행]\n1. SAP 접속...`}
            className="form-textarea"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onFocus={resetMessages}
          />
        </div>
        {errorMsg && <div className="message-area error-msg">{errorMsg}</div>}
        {successMsg && <div className="message-area success-msg">{successMsg}</div>}
        <div className="button-container">
          <button
            onClick={handleAnalyze}
            disabled={loadingAnalyze || loadingSaveAll}
            className="form-button primary"
          >
            {loadingAnalyze ? 'AI 분석 중...' : 'AI로 분석하기'}
          </button>
        </div>

        {tasks.length > 0 && (
          <div className="results-container">
            <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              AI 분석 결과 (편집/저장)
            </h2>
            {tasks.map((task, index) => {
              const isEditing = editIndex === index;
              return (
                <div key={index} className="task-card">
                  {isEditing ? (
                    <div className="edit-area">
                      <div>
                        <label className="form-label">제목</label>
                        <input
                          className="edit-input"
                          value={task.title}
                          onChange={(e) => handleTaskChange(index, 'title', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label">매뉴얼 내용</label>
                        <textarea
                          className="edit-textarea"
                          value={task.manual}
                          onChange={(e) => handleTaskChange(index, 'manual', e.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="task-header">
                        <h3 className="task-title">{task.title}</h3>
                      </div>
                      <pre className="task-manual">{task.manual}</pre>
                    </>
                  )}
                  <div className="task-actions">
                    <button
                      onClick={() => setEditIndex(isEditing ? null : index)}
                      className={`action-button ${isEditing ? 'edit-btn-done' : 'edit-btn'}`}
                      disabled={loadingSaveAll}
                    >
                      {isEditing ? '✅ 수정 완료' : '✏️ 편집하기'}
                    </button>
                    <button
                      onClick={() => handleDeleteTask(index)}
                      className="action-button delete-btn"
                      disabled={loadingSaveAll}
                    >
                      ❌ 삭제하기
                    </button>
                  </div>
                </div>
              );
            })}
            
            <div className="save-all-container">
              <button
                onClick={handleSaveAll}
                disabled={loadingSaveAll || loadingAnalyze || editIndex !== null}
                className="save-all-button"
              >
                {loadingSaveAll ? '저장 중...' : `총 ${tasks.length}개 업무 리스트에 모두 저장`}
              </button>
              {editIndex !== null && (
                <p style={{color: '#dc3545', fontSize: '0.9em', marginTop: '0.5rem'}}>
                  '수정 완료' 버튼을 눌러 모든 편집을 완료해주세요.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Fragment>
  );
}