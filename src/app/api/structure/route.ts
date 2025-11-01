// src/app/api/structure/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai'; // lib/openai.ts

// --- 1단계: 분류기 (Classifier) ---
async function classifyText(raw_text: string): Promise<'PROCEDURE' | 'COMMUNICATION'> {
  const prompt = `당신은 베테랑 업무 인수인계 전문가입니다. 다음 텍스트를 분석하여, 인수인계에 '필수적인' 업무 절차나 노하우를 담고 있는지 판단하세요.
[업무 매뉴얼]: 특정 작업을 수행하는 단계별 지침, 방법론, 노하우, 코드 스니펫, 시스템 사용법 등이 포함됨.
[단순 커뮤니케이션]: 간단한 일정 조율, 안부 인사, 단순 사실 전달, 개인적인 감상이나 일기.
[분석할 텍스트]
${raw_text}
[출력]
텍스트가 [업무 매뉴얼]에 해당하면 'PROCEDURE'를, [단순 커뮤니케이션]에 해당하면 'COMMUNICATION'을 반환하세요.`;

  try {
    const comp = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // 분류 작업은 빠르고 저렴한 모델 사용
      temperature: 0.0,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 10,
    });
    const result = comp.choices[0].message.content?.trim() || 'COMMUNICATION';
    if (result === 'PROCEDURE') return 'PROCEDURE';
    return 'COMMUNICATION';
  } catch (e) {
    console.error("Classifier error:", e);
    return 'COMMUNICATION'; // 오류 발생 시 안전하게 '버림' 처리
  }
}

// --- 2단계: 추출기 (Extractor) ---
// (요청하신 멀티-태스크 분석을 위해 프롬프트를 수정했습니다)
type ComplexTask = {
  title: string;
  summary: string;
  steps: { step: number; description: string }[];
  key_points: string[];
};

async function extractProcedures(raw_text: string): Promise<{ tasks: ComplexTask[] }> {
  const prompt = `당신은 신입사원도 이해할 수 있도록 명확한 업무 매뉴얼을 작성하는 전문가입니다.
다음은 한 직원이 작성한 비공식적인 업무 메모입니다. 이 텍스트에서 감정적이거나 불필요한 사족은 모두 제거하고, 오직 '업무 절차'에 대한 내용만 "여러 개" 추출하여 아래 JSON 형식으로 구조화해주세요.
메모에 여러 개의 독립된 업무가 포함되어 있다면, 각각을 별도의 객체로 분리하여 "tasks" 배열에 담아주세요.

[원본 텍스트]
${raw_text}

[출력 형식 (JSON)]
{
  "tasks": [
    {
      "title": "(예: '월간 마감 보고서 작성 절차')",
      "summary": "(예: '이 문서는 A 시스템에서 데이터를 추출하여 B 템플릿에 맞춰 보고서를 작성하는 방법을 설명합니다.')",
      "steps": [
        { "step": 1, "description": "(예: '매월 마지막 주 금요일, A 시스템 접속')" },
        { "step": 2, "description": "(예: '...')" }
      ],
      "key_points": [
        "(예: '주의: B 템플릿의 '매크로 포함'으로 저장해야 함')"
      ]
    }
    // ... 다른 업무가 있다면 여기에 추가 ...
  ]
}
만약 명확한 업무 절차를 식별할 수 없다면, "tasks": [] 빈 배열을 반환하세요.`;

  try {
    const comp = await openai.chat.completions.create({
      model: 'gpt-4o', // 추출 작업은 강력한 모델 사용
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: "You are an expert in structuring messy text into clear JSON arrays." },
        { role: 'user', content: prompt }
      ],
    });
    
    const content = comp.choices[0].message.content;
    return JSON.parse(content || '{"tasks": []}');
  } catch (e) {
    console.error("Extractor error:", e);
    return { tasks: [] }; // 오류 발생 시 빈 배열 반환
  }
}

// --- 3단계: 포맷터 (Formatter) ---
// 복잡한 JSON -> 프론트엔드가 기대하는 { title, manual } 형태로 변환
function formatTaskToSimple(task: ComplexTask): { title: string, manual: string } {
  let manual = "";
  
  if (task.summary) {
    manual += `[요약]\n${task.summary}\n\n`;
  }
  
  if (task.steps && task.steps.length > 0) {
    manual += "[단계별 절차]\n";
    manual += task.steps
      .map(s => `${s.step}. ${s.description}`)
      .join('\n');
    manual += "\n\n";
  }
  
  if (task.key_points && task.key_points.length > 0) {
    manual += "[핵심 사항]\n";
    manual += task.key_points
      .map(p => `- ${p}`)
      .join('\n');
  }
  
  return {
    title: task.title,
    manual: manual.trim() || "내용 없음" // 내용이 아예 없는 경우 방지
  };
}


// --- 메인 API 라우트 ---
export async function POST(req: NextRequest) {
  try {
    const { raw_text } = await req.json();
    if (!raw_text) {
      return NextResponse.json({ error: 'raw_text required' }, { status: 400 });
    }

    // 1단계: 분류
    const classification = await classifyText(raw_text);
    
    // '업무 매뉴얼'이 아니면 빈 배열 반환 -> 프론트에서 "0개 감지"
    if (classification === 'COMMUNICATION') {
      return NextResponse.json({ tasks: [] });
    }

    // 2단계: 추출 (PROCEDURE일 경우)
    const complexData = await extractProcedures(raw_text);
    
    // 3단계: 프론트엔드 호환을 위한 포맷팅
    const simpleTasks = complexData.tasks.map(formatTaskToSimple);
    
    // 프론트엔드에 { tasks: [{ title, manual }, ...] } 반환
    return NextResponse.json({ tasks: simpleTasks });

  } catch (e: any) {
    console.error("Structure API Error:", e);
    return NextResponse.json(
      { error: e.message ?? 'Failed to structure data' },
      { status: 500 },
    );
  }
}