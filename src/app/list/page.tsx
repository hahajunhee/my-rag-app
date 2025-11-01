// src/app/list/page.tsx
'use client';
import { useState, useEffect, Fragment, useMemo, ChangeEvent } from 'react'; 
import { supabase } from '@/lib/supabaseClient';
import * as XLSX from 'xlsx'; 

type Document = {
  id: string; title: string | null; created_at: string; raw_text: string;
};
type SortConfig = {
  key: keyof Document | 'index'; direction: 'asc' | 'desc';
};

export default function ListPage() {
  const [docs, setDocs] = useState<Document[]>([]); // DB 원본
  const [editableDocs, setEditableDocs] = useState<Document[]>([]); // UI 편집용
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedIds, setSelectedIds] = useState(new Set<string>()); // 삭제용
  const [modifiedIds, setModifiedIds] = useState(new Set<string>()); // 저장용

  const [sortConfig, setSortConfig] = useState<SortConfig>({ 
    key: 'created_at', direction: 'desc' 
  });
  
  // 모달 상태 (수기 등록용)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'new' | 'edit' | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalManual, setModalManual] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const sortedDocs = useMemo(() => {
    let sortableDocs = [...editableDocs];
    if (sortConfig.key) {
      sortableDocs.sort((a, b) => {
        let valA, valB;
        if (sortConfig.key === 'index') {
          valA = new Date(a.created_at).getTime();
          valB = new Date(b.created_at).getTime();
        } else {
          valA = a[sortConfig.key as keyof Document] || '';
          valB = b[sortConfig.key as keyof Document] || '';
          if (sortConfig.key === 'created_at') {
            valA = new Date(valA).getTime();
            valB = new Date(valB).getTime();
          }
        }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableDocs;
  }, [editableDocs, sortConfig]);

  const requestSort = (key: keyof Document | 'index') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    if (key === 'index' && direction === 'asc' && sortConfig.key !== 'index') {
       direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIndicator = (key: keyof Document | 'index') => {
    if (sortConfig.key !== key) return ' ↕️';
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };
  
  async function fetchDocuments() {
    setLoading(true); setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('문서를 보려면 로그인이 필요합니다.'); setLoading(false); return;
    }
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, created_at, raw_text')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDocs(data || []);
      setEditableDocs(data || []); 
      setSortConfig({ key: 'created_at', direction: 'desc' });
    } catch (e: any) { setError(e.message || '문서 로드 실패');
    } finally { 
      setLoading(false);
      setSelectedIds(new Set()); 
      setModifiedIds(new Set()); 
    }
  }

  useEffect(() => { fetchDocuments(); }, []);

  const handleRowCheck = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(docs.map(doc => doc.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleCellChange = (
    docId: string, 
    field: 'title' | 'raw_text', 
    value: string
  ) => {
    setEditableDocs(prev => 
      prev.map(doc => 
        doc.id === docId ? { ...doc, [field]: value } : doc
      )
    );
    setModifiedIds(prev => new Set(prev).add(docId));
  };
  
  async function handleGlobalSave() {
    const numModified = modifiedIds.size;
    if (numModified === 0) return;
    
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('저장을 위해 로그인이 필요합니다.'); setLoading(false); return;
    }

    const updatesToSave = editableDocs.filter(doc => modifiedIds.has(doc.id));

    const savePromises = updatesToSave.map(doc => {
      return fetch(`/api/document/${doc.id}`, { 
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          title: doc.title,
          raw_text: doc.raw_text,
        }),
      });
    });

    try {
      const results = await Promise.all(savePromises);
      const failed = results.filter(res => !res.ok);
      if (failed.length > 0) {
        throw new Error(`${failed.length}개 항목 저장 실패`);
      }
      await fetchDocuments(); 
    } catch (e: any) {
      setError(e.message || '저장 중 오류 발생');
      setLoading(false);
    }
  }

  async function handleBatchDelete() {
    const numSelected = selectedIds.size;
    if (numSelected === 0) return;
    if (!confirm(`정말 ${numSelected}개의 항목을 삭제하시겠습니까?`)) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .in('id', Array.from(selectedIds));
      if (error) throw error;
      await fetchDocuments();
    } catch (e: any) {
      setError(e.message || '삭제 중 오류 발생');
      setLoading(false);
    }
  }

  function openNewModal() {
    setModalMode('new');
    setModalTitle(''); setModalManual('');
    setModalError(null); setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false); setModalLoading(false);
    setModalError(null); setModalMode(null);
  }

  async function handleModalSave() { 
    setModalLoading(true); setModalError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setModalError('세션이 만료되었습니다.'); setModalLoading(false); return;
    }
    if (!modalTitle.trim()) {
      setModalError('제목은 비워둘 수 없습니다.'); setModalLoading(false); return;
    }
    try {
      const r = await fetch(`/api/ingest`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, title: modalTitle, raw_text: modalManual }),
      });
      const jsonData = await r.json();
      if (!r.ok) throw new Error(jsonData.error || '저장 중 오류 발생');
      
      setModalLoading(false); closeModal();
      await fetchDocuments(); 
    } catch (e: any) {
      setModalError(e.message); setModalLoading(false);
    }
  }

  function handleExcelDownload() {
    if (docs.length === 0) { alert("다운로드할 데이터가 없습니다."); return; }
    const dataForExcel = sortedDocs.map(doc => ({
      "주제": doc.title || '제목 없음', "업무내용": doc.raw_text
    }));
    const ws = XLSX.utils.json_to_sheet(dataForExcel);
    ws['!cols'] = [{ wch: 30 }, { wch: 80 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "업무 리스트");
    XLSX.writeFile(wb, "내_업무_리스트.xlsx");
  }

  return (
    <Fragment>
      {/* <style jsx> 태그는 없습니다.
        모든 스타일은 src/app/globals.css 파일에서 관리됩니다.
        (사용자님이 제공해주신 globals.css 코드에 체크박스 중앙 정렬 CSS가
         이미 포함되어 있습니다.)
      */}
      
      <div className="list-container">
        <div className="title-container">
          <h1 className="title">내 업무 리스트</h1>
          <div className="header-buttons">
            <button
              onClick={openNewModal}
              className="new-doc-button"
              disabled={loading}
            >
              수기 등록 ＋
            </button>
            <button
              onClick={handleExcelDownload}
              className="excel-download-button"
              disabled={loading || docs.length === 0}
            >
              엑셀 다운로드 📥
            </button>
            <button
              onClick={handleGlobalSave}
              className="save-button-global"
              disabled={loading || modifiedIds.size === 0}
            >
              저장 💾
            </button>
            <button
              onClick={handleBatchDelete}
              className="delete-button-global"
              disabled={loading || selectedIds.size === 0}
            >
              삭제 ❌
            </button>
          </div>
        </div>
        
        {loading && <div className="loading">목록을 불러오는 중...</div>}
        {error && <div className="error">⚠️ {error}</div>}
        {!loading && !error && docs.length === 0 && (
          <div className="empty">
            아직 저장된 업무가 없습니다. <br />
            [업무 등록] 또는 [수기 등록] 버튼을 이용해 문서를 추가해주세요.
          </div>
        )}

        {!loading && !error && docs.length > 0 && (
          <div className="doc-table-container">
            <table className="doc-table">
              <thead>
                <tr>
                  <th className="col-check">
                    <input
                      type="checkbox"
                      className="large-checkbox"
                      onChange={handleSelectAll}
                      checked={docs.length > 0 && selectedIds.size === docs.length}
                    />
                  </th>
                  <th className="col-num" onClick={() => requestSort('index')}>
                    번호{getSortIndicator('index')}
                  </th>
                  <th className="col-title" onClick={() => requestSort('title')}>
                    제목{getSortIndicator('title')}
                  </th>
                  <th className="col-content" onClick={() => requestSort('raw_text')}>
                    내용{getSortIndicator('raw_text')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedDocs.map((doc, index) => {
                  const isSelected = selectedIds.has(doc.id);
                  const isModified = modifiedIds.has(doc.id);
                  return (
                    <tr 
                      key={doc.id} 
                      className={`${isSelected ? 'row-selected' : ''} ${isModified ? 'row-modified' : ''}`}
                      // ✅ <tr>에서 onClick 제거
                    >
                      <td 
                        className="col-check"
                        onClick={() => handleRowCheck(doc.id)} // ✅ 체크박스 셀 클릭 시 토글
                      >
                        <input
                          type="checkbox"
                          className="large-checkbox"
                          checked={isSelected}
                          onChange={() => handleRowCheck(doc.id)}
                          onClick={(e) => e.stopPropagation()} // ✅ 체크박스 클릭 시 이중 토글 방지
                        />
                      </td>
                      <td 
                        className="col-num"
                        onClick={() => handleRowCheck(doc.id)} // ✅ 번호 셀 클릭 시 토글
                      >
                        {index + 1}
                      </td>
                      <td 
                        className="col-title" 
                        onClick={(e) => e.stopPropagation()} // ✅ 편집 셀은 토글 방지
                      >
                        <input
                          type="text"
                          className="td-input"
                          value={doc.title || ''}
                          onChange={(e) => handleCellChange(doc.id, 'title', e.target.value)}
                        />
                      </td>
                      <td 
                        className="col-content" 
                        onClick={(e) => e.stopPropagation()} // ✅ 편집 셀은 토글 방지
                      >
                        <textarea
                          className="td-textarea"
                          value={doc.raw_text}
                          onChange={(e) => handleCellChange(doc.id, 'raw_text', e.target.value)}
                          rows={Math.max(3, doc.raw_text.split('\n').length)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- 수기 등록용 모달 --- */}
      {isModalOpen && modalMode === 'new' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              새 문서 등록
            </div>
            <div className="modal-body">
              <div>
                <label htmlFor="modal-title" className="modal-label">제목</label>
                <input
                  id="modal-title"
                  className="modal-input"
                  value={modalTitle}
                  onChange={e => setModalTitle(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="modal-manual" className="modal-label">매뉴얼 내용</label>
                <textarea
                  id="modal-manual"
                  className="modal-textarea"
                  value={modalManual}
                  onChange={e => setModalManual(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <div className="modal-error">
                {modalError}
              </div>
              <div className="modal-button-group">
                <button
                  onClick={closeModal}
                  className="modal-button modal-cancel"
                >
                  취소
                </button>
                <button
                  onClick={handleModalSave}
                  className="modal-button modal-save"
                  disabled={modalLoading}
                >
                  {modalLoading ? '등록 중...' : '등록하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Fragment>
  );
}