// src/app/api/structure/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

// ====================================================
// 1️⃣ 분류기 (Classifier)
// ====================================================
async function classifyText(
  raw_text: string
): Promise<'PROCEDURE' | 'RULE' | 'RESPONSIBILITY' | 'REFERENCE' | 'COMMUNICATION'> {
  const prompt = `
당신은 현대글로비스 북미포워딩 인수인계 데이터를 정리하는 전문가입니다.
주어진 문장을 읽고, 아래 다섯 가지 중 가장 적합한 하나를 선택하세요.

[카테고리 정의]
1. PROCEDURE: 단계, 순서, 수행 방법, 노하우, 시스템 조작법, 규칙 또는 업무 설명을 포함.
2. RULE: 기준, 조건, 마감일, 원칙 등 절차가 아닌 규정 중심 문장.
3. RESPONSIBILITY: 사람, 부서, 담당자, 역할 정보가 포함.
4. REFERENCE: 링크, 이메일, 코드, 숫자 등 단순 참고자료.
5. COMMUNICATION: 인사말, 개인소감, 일정안내, 감정적 표현.

⚠️ 주의:
- 짧은 문장이라도 업무 규칙, 시스템, 매뉴얼적 정보가 있다면 반드시 PROCEDURE 또는 RULE로 분류할 것.
- 단순히 짧거나 단계가 없어도 업무 지식이면 COMMUNICATION으로 분류하지 않는다.

[분류할 문장]
${raw_text}

[출력]
위 다섯 중 하나만 대문자로 반환 (예: PROCEDURE)
`;

  try {
    const comp = await openai.chat.completions.create({
      model: 'gpt-4o', // 정확도 향상
      temperature: 0.0,
      max_tokens: 10,
      messages: [{ role: 'user', content: prompt }],
    });

    const result = comp.choices[0].message.content?.trim().toUpperCase() || 'COMMUNICATION';
    const valid = ['PROCEDURE', 'RULE', 'RESPONSIBILITY', 'REFERENCE', 'COMMUNICATION'];
    return valid.includes(result) ? (result as any) : 'COMMUNICATION';
  } catch (e) {
    console.error('Classifier error:', e);
    return 'COMMUNICATION';
  }
}

// ====================================================
// 2️⃣ 유형별 추출기 (Extractor)
// ====================================================
async function extractByType(
  type: 'PROCEDURE' | 'RULE' | 'RESPONSIBILITY' | 'REFERENCE',
  raw_text: string
): Promise<any> {
  const promptMap: Record<string, string> = {
    PROCEDURE: `
당신은 물류/포워딩 실무 매뉴얼 작성 전문가입니다.
아래 텍스트에서 '업무 절차' 또는 '작업 방법'을 찾아내어 JSON으로 정리하세요.

[출력 형식]
{
  "tasks": [
    {
      "title": "업무명",
      "summary": "요약 설명",
      "steps": [
        { "step": 1, "description": "단계별 절차" }
      ],
      "key_points": ["주의사항", "팁 등"]
    }
  ]
}
`,
    RULE: `
아래 텍스트에서 정책, 기준, 조건, 마감일 등 '규칙성 문장'을 찾아 요약하세요.
[출력 형식]
{
  "rules": [
    { "title": "규칙 제목", "rule_text": "규칙 상세 내용" }
  ]
}
`,
    RESPONSIBILITY: `
아래 텍스트에서 인물, 직책, 담당업무, 이메일 등을 추출하여 조직도 형태로 정리하세요.
[출력 형식]
{
  "people": [
    { "name": "성명", "role": "직책", "responsibility": "업무", "email": "메일주소(있다면)" }
  ]
}
`,
    REFERENCE: `
아래 텍스트에서 URL, 이메일, 코드, 숫자 등 '참고정보'를 모두 추출하세요.
[출력 형식]
{ "references": ["항목1", "항목2", "항목3"] }
`,
  };

  const prompt = promptMap[type];
  if (!prompt) return {};

  try {
    const comp = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a JSON extractor.' },
        { role: 'user', content: `${prompt}\n\n[텍스트]\n${raw_text}` },
      ],
    });

    return JSON.parse(comp.choices[0].message.content || '{}');
  } catch (e) {
    console.error(`Extractor error (${type}):`, e);
    return {};
  }
}

// ====================================================
// 3️⃣ 포맷터 (Formatter)
// ====================================================
function formatExtractedData(type: string, data: any): { title: string; manual: string }[] {
  const results: { title: string; manual: string }[] = [];

  if (type === 'PROCEDURE' && data.tasks) {
    for (const t of data.tasks) {
      let text = '';
      if (t.summary) text += `[요약]\n${t.summary}\n\n`;
      if (t.steps?.length)
        text += `[단계별 절차]\n${t.steps.map((s: any) => `${s.step}. ${s.description}`).join('\n')}\n\n`;
      if (t.key_points?.length)
        text += `[핵심사항]\n${t.key_points.map((k: any) => `- ${k}`).join('\n')}`;
      results.push({ title: t.title || '무제', manual: text.trim() || '내용 없음' });
    }
  }

  if (type === 'RULE' && data.rules) {
    for (const r of data.rules) {
      results.push({ title: r.title || '규칙', manual: `[규칙]\n${r.rule_text}` });
    }
  }

  if (type === 'RESPONSIBILITY' && data.people) {
    for (const p of data.people) {
      results.push({
        title: `${p.name || '담당자'} (${p.role || ''})`,
        manual: `[담당업무]\n${p.responsibility || ''}${p.email ? `\n📧 ${p.email}` : ''}`,
      });
    }
  }

  if (type === 'REFERENCE' && data.references) {
    results.push({
      title: '참고 정보',
      manual: data.references.map((r: any) => `- ${r}`).join('\n'),
    });
  }

  return results;
}

// ====================================================
// 4️⃣ 메인 API (배치 처리)
// ====================================================
export async function POST(req: NextRequest) {
  try {
    const { raw_text } = (await req.json()) as { raw_text: string };
    if (!raw_text) {
      return NextResponse.json({ error: 'raw_text required' }, { status: 400 });
    }

    // 1) 줄 단위로 분리
    const lines: string[] = raw_text
      .split(/\r?\n/)
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    const allResults: { title: string; manual: string }[] = [];

    // 2) 각 줄별 분류 + 추출
    for (const line of lines) {
      const category = await classifyText(line);
      if (category === 'COMMUNICATION') continue; // 비업무 내용은 스킵

      const extracted = await extractByType(category, line);
      const formatted = formatExtractedData(category, extracted);

      allResults.push(...formatted);
    }

    // 3) 결과 반환
    return NextResponse.json({ total: allResults.length, tasks: allResults });
  } catch (e: any) {
    console.error('Structure API Error:', e);
    return NextResponse.json(
      { error: e.message ?? 'Failed to structure data' },
      { status: 500 },
    );
  }
}
