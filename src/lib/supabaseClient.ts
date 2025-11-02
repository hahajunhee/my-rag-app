import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,       // ✅ 세션을 localStorage에 저장
      autoRefreshToken: true,     // ✅ 만료되면 자동 갱신
      detectSessionInUrl: true,   // ✅ 리디렉트 후 세션 감지 (← 이게 핵심)
      storageKey: 'rag-auth'      // ✅ 커스텀 키 (괜찮음)
    }
  }
);
