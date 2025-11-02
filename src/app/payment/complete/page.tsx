'use client';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function CompletePage() {
  useEffect(() => {
    async function updateTier() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({
            api_tier: 'pro',
            api_model: 'gpt-4o',
            subscription_status: 'active'
          })
          .eq('user_id', user.id);
      }
    }
    updateTier();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>🎉 결제가 완료되었습니다!</h1>
      <p>PRO 플랜으로 업그레이드 되었습니다.</p>
    </div>
  );
}
