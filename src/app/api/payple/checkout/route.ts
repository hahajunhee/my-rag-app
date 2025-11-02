export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import fetch from 'node-fetch';

export async function POST() {
  try {
    const { PAYPLE_CST_ID, PAYPLE_CUST_KEY, PAYPLE_AUTH_KEY, NEXT_PUBLIC_SITE_URL } = process.env;

    // 1️⃣ Access Token 요청
    const tokenRes = await fetch('https://democpay.payple.kr/gpay/oauth/1.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cst_id: PAYPLE_CST_ID, custKey: PAYPLE_CUST_KEY })
    });
    const { access_token } = await tokenRes.json();

    // 2️⃣ 결제요청 생성
    const payRes = await fetch('https://democpay.payple.kr/gpay/payrequest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: access_token
      },
      body: JSON.stringify({
        cst_id: PAYPLE_CST_ID,
        custKey: PAYPLE_CUST_KEY,
        AuthKey: PAYPLE_AUTH_KEY,
        pay_type: 'card',
        currency: 'KRW',
        product: 'PRO 구독',
        price: 9900,
        order_num: 'order_' + new Date().getTime(),
        return_url: `${NEXT_PUBLIC_SITE_URL}/payment/complete`
      })
    });
    const payData = await payRes.json();

    return NextResponse.json({ url: payData.next_redirect_pc_url });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || '결제 생성 실패' }, { status: 500 });
  }
}
