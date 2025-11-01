export const runtime = 'nodejs'; // Next Edge 환경 이슈 회피

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { openai } from '@/lib/openai';
import { cleanText, simpleChunk } from '@/lib/chunk';

export async function POST(req: NextRequest) {
  try {
    const { user_id, title, raw_text } = await req.json();
    if (!user_id || !raw_text) {
      return NextResponse.json({ error: 'user_id & raw_text required' }, { status: 400 });
    }

    // 1) 구조화
    const prompt = `
다음 자유 텍스트를 아래 스키마 JSON으로만 출력하세요:
{
  "핵심목적": "...",
  "배경": "...",
  "담당자_시스템": ["..."],
  "절차": ["1. ...", "2. ..."],
  "예외_주의": ["..."],
  "관련용어": ["..."],
  "검색키워드": ["..."]
}
`;
    const input = cleanText(raw_text);

    const comp = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'You convert messy notes into structured JSON only.' },
        { role: 'user', content: `${prompt}\n\nTEXT:\n${input}` }
      ]
    });

    let structured: any = {};
    try { structured = JSON.parse(comp.choices[0].message.content || '{}'); } catch {}

    // 2) 문서 저장
    const { data: doc, error: docErr } = await supabaseServer
      .from('documents')
      .insert({
        user_id,
        title: title || (structured?.핵심목적 ?? 'Untitled'),
        raw_text: input,
        structured_json: structured
      })
      .select()
      .single();
    if (docErr) throw docErr;

    // 3) 청크 + 임베딩(1536)
    const chunks = simpleChunk(input, 900);
    for (let i = 0; i < chunks.length; i++) {
      const emb = await openai.embeddings.create({
        model: 'text-embedding-3-small', // ✅ 1536
        input: chunks[i]
      });

      const section = structured?.절차 ? '절차' : null;
      const keywords = structured?.검색키워드 ?? null;

      const { error: cErr } = await supabaseServer.from('chunks').insert({
        document_id: doc.id,
        user_id,
        chunk_index: i,
        content: chunks[i],
        section: section ?? undefined,
        keywords,
        embedding: emb.data[0].embedding as any
      });
      if (cErr) throw cErr;
    }

    return NextResponse.json({ ok: true, document_id: doc.id, chunks: chunks.length });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message ?? 'ingest failed' }, { status: 500 });
  }
}
