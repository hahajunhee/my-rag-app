import { openai } from './openai';
import { supabaseServer } from './supabaseServer';

export async function embedQuery(q: string) {
  const { data } = await openai.embeddings.create({
    model: 'text-embedding-3-small', // ✅ 1536차원
    input: q
  });
  return data[0].embedding;
}

export async function hybridSearch(userId: string, query: string, topK = 8) {
  const qEmb = await embedQuery(query);

  // 1) 벡터 검색 (RPC)
  const { data: vecRows, error: vecErr } = await supabaseServer.rpc('match_chunks', {
    query_embedding: qEmb,
    match_count: topK,
    uid: userId
  });
  if (vecErr) console.error('vector search error:', vecErr);

  // 2) 키워드 검색 (FTS가 환경에 따라 제한될 수 있어 ilike fallback 사용)
  const terms = query
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5) // 과한 OR 방지
    .map(t => `%${t}%`);

  let kwRows: any[] = [];
  for (const pat of terms.length ? terms : ['%']) {
    const { data, error } = await supabaseServer
      .from('chunks')
      .select('id, document_id, content, section')
      .eq('user_id', userId)
      .ilike('content', pat)
      .limit(Math.ceil(topK / (terms.length || 1)));
    if (!error && data) kwRows = kwRows.concat(data);
  }

  // 3) Merge + dedupe
  const merged: any[] = [];
  const seen = new Set<string>();
  for (const r of [...(vecRows ?? []), ...kwRows]) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      merged.push(r);
    }
  }
  return merged.slice(0, topK);
}
