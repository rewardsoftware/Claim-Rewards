// /api/withdraw.js — Vercel Serverless Function
// FaucetPay INSTANT PAYMENT — USDT
// Internal = FaucetPay to FaucetPay, no blockchain fees, instant payout
// App: https://claim-rewards-one.vercel.app/

const FAUCETPAY_API_KEY = process.env.FAUCETPAY_API_KEY;
const FAUCETPAY_API_URL = 'https://faucetpay.io/api/v1/send';

const USDT_PER_COIN = 0.0001; // 1 Coin = $0.0001 USDT  (10,000 Coins = $1 USDT)
const MIN_COINS     = 10;     // min 10 Coins = $0.001 USDT
const CURRENCY      = 'USDT';

// Allowed origin for CORS
const ALLOWED_ORIGIN = 'https://claim-rewards-one.vercel.app';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── Health check ──
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      app: 'Claim Reward — EarnZone',
      status: 'Withdraw API running — FaucetPay USDT instant payment',
      rate: '10,000 Coins = $1 USDT (1 Coin = $0.0001 USDT)',
      min: `${MIN_COINS} Coins`,
      currency: CURRENCY,
      faucetpay_key_set: !!FAUCETPAY_API_KEY
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!FAUCETPAY_API_KEY) {
    return res.status(500).json({
      ok: false,
      error: 'FAUCETPAY_API_KEY not set in Vercel Environment Variables'
    });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { body = {}; }
    }

    // Frontend sends: { to: email, coins: number }
    const { to, coins } = body || {};

    // ── Validation ──
    if (!to || !coins) {
      return res.status(400).json({
        ok: false,
        status: 400,
        error: 'FaucetPay email (to) and coins are required'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({
        ok: false,
        status: 400,
        error: 'Invalid email address'
      });
    }

    const amount = parseFloat(coins);
    if (isNaN(amount) || amount < MIN_COINS) {
      return res.status(400).json({
        ok: false,
        status: 400,
        error: `Minimum ${MIN_COINS} Coins required for withdrawal`
      });
    }

    // ── Convert Coins → USDT → FaucetPay units (×10^8) ──
    const usdtAmount = amount * USDT_PER_COIN;
    const sendAmount = Math.round(usdtAmount * 1e8); // e.g. 0.001 USDT → 100000

    console.log(`[Claim Reward] Withdraw — to: ${to}, coins: ${amount}, USDT: ${usdtAmount}`);

    const params = new URLSearchParams({
      api_key:  FAUCETPAY_API_KEY,
      to:       to,
      amount:   sendAmount.toString(),
      currency: CURRENCY,
      referral: 'true'
    });

    const fpRes = await fetch(FAUCETPAY_API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    params.toString()
    });

    const fpData = await fpRes.json();
    console.log('[Claim Reward] FaucetPay response:', JSON.stringify(fpData));

    // ── FaucetPay success ──
    if (fpData.status === 200) {
      return res.status(200).json({
        status:    200,
        success:   true,
        message:   'Withdrawal successful! USDT sent via FaucetPay.',
        usdtSent:  usdtAmount,
        coinsSent: amount,
        payoutId:  fpData.payout_id || null
      });
    }

    // ── FaucetPay error ──
    return res.status(200).json({
      status:    fpData.status || 400,
      success:   false,
      message:   fpData.message || 'FaucetPay payment failed. Please try again.',
      fp_status: fpData.status
    });

  } catch (err) {
    console.error('[Claim Reward] withdraw error:', err.message);
    return res.status(500).json({
      status:  500,
      success: false,
      message: 'Internal server error: ' + err.message
    });
  }
}
