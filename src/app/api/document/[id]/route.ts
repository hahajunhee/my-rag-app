// src/app/api/document/[id]/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer'; // 기존 서버 클라이언트

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params; // URL에서 문서 ID 추출
    const { user_id, title, raw_text } = await req.json(); // 클라이언트에서 전송한 데이터

    if (!id || !user_id || !title || raw_text === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: id, user_id, title, raw_text' },
        { status: 400 },
      );
    }

    // supabaseServer(서비스 키)를 사용하므로,
    // RLS를 우회하는 대신 쿼리에서 .eq('user_id', user_id)를 통해 수동으로 소유권을 확인합니다.
    const { data, error } = await supabaseServer
      .from('documents')
      .update({
        title: title,
        raw_text: raw_text,
        // 필요하다면 structured_json도 여기서 업데이트
      })
      .eq('id', id)
      .eq('user_id', user_id) // ✅ 중요: 본인 문서만 수정하도록 강제
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // PostgREST 에러: 0개의 행이 반환됨 (즉, 문서가 없거나 user_id가 불일치)
        return NextResponse.json(
          { error: 'Document not found or access denied' },
          { status: 404 },
        );
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (e: any) {
    console.error('Update API Error:', e);
    return NextResponse.json(
      { error: e.message ?? 'Update failed' },
      { status: 500 },
    );
  }
}