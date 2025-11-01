// src/app/api/ask/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { openai } from '@/lib/openai';
import { hybridSearch } from '@/lib/search';

// ✅ Citaton 타입을 백엔드에도 정의해줍니다.
type Citation = {
  idx: number;
  chunk_id: string;
  document_id: string;
  excerpt: string;
};

export async function POST(req: NextRequest) {
  try {
    const { user_id, question } = await req.json();
    if (!user_id || !question) {
      return NextResponse.json(
        { error: 'user_id & question required' },
        { status: 400 },
      );
    }

    // 1. RAG 검색 (3개)
    const contexts = await hybridSearch(user_id, question, 3);
    const contextText = contexts
      .map((c: any, i: number) => `[${i + 1}] ${c.content}`)
      .join('\n\n');

    // 2. 시스템 프롬프트
    const sys = `당신은 유능하고 친절한 업무 보조 AI입니다.
당신의 첫 번째 임무는 사용자의 질문에 대해, [컨텍스트]로 제공된 3개의 가장 관련성 높은 업무 매뉴얼을 바탕으로 "최고의 답변"을 생성하는 것입니다.

[규칙]
1.  **[컨텍스트] 절대 우선:** [컨텍스트]에 있는 3개의 정보만을 조합하고 재구성하여 답변을 생성해야 합니다.
2.  **최고의 답변:** 3개의 [컨텍스트]를 모두 "다시 한번 생각"하여, 사용자의 질문에 가장 정확하고 완전한, 요약된 답변을 제공하세요.
3.  **근거 제시:** [컨텍스트]를 사용한 경우, 반드시 근거가 된 [index]를 "근거 목록"으로 제시해야 합니다. (예: "근거 목록: [1], [3]")
4.  **정보가 없는 경우 (RAG 실패):** 만약 3개의 [컨텍스트]에 사용자의 질문과 관련된 정보가 전혀 없다면, "업무 매뉴얼에서 관련 정보를 찾을 수 없습니다."라고 먼저 말한 뒤, 당신의 일반 지식(GPT)을 활용하여 질문에 답변하세요.
5.  **일반 지식 답변:** 일반 지식으로 답변할 때는 "근거 목록"을 절대 제시하지 마세요.
6.  **절차 안내:** "how" 또는 "절차"에 대한 질문에는 단계별로 명확하게 설명하세요.`;

    const userMsg = `질문: ${question}\n\n[컨텍스트]\n${contextText}\n\n[답변]`;

    // 3. OpenAI에 질문
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.1,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: userMsg },
      ],
    });

    const answer = completion.choices[0].message.content ?? '';

    // 4. ✅ AI가 근거를 사용했는지 여부 판단 (타입 명시)
    let finalCitations: Citation[] = []; // <-- ✅ 빨간 줄 해결: 타입을 명확히 지정
    const usedContext = /\[\d+\]/.test(answer) || answer.includes('근거 목록');

    if (usedContext) {
      // AI가 컨텍스트를 사용했다면, 3개의 근거 단락을 반환
      finalCitations = contexts.map((c: any, i: number) => ({
        idx: i + 1,
        chunk_id: c.id,
        document_id: c.document_id,
        excerpt: c.content.slice(0, 300),
      }));
    }
    // (일반 지식 사용 시 finalCitations는 빈 배열)

    // 5. 로그 저장 및 응답 반환
    await supabaseServer.from('qa_logs').insert({
      user_id,
      question,
      answer,
      citations: finalCitations, // ✅ finalCitations는 이제 Citation[] | never[] 가 아닌 Citation[] 타입입니다.
    });

    return NextResponse.json({ answer, citations: finalCitations });
  } catch (e: any) {
    console.error('Ask API Error:', e);
    return NextResponse.json(
      { error: e.message ?? 'ask failed' },
      { status: 500 },
    );
  }
}