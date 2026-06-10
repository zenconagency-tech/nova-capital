const { getSupabaseAdmin, getSupabase } = require('../config/supabase');

const INTERVAL_MS = 60_000;
let timer = null;

function useAdmin() {
  return getSupabaseAdmin() || getSupabase();
}

async function processInvestments() {
  try {
    const { data: active, error } = await useAdmin()
      .from('user_investments')
      .select('*')
      .eq('status', 'active');
    if (error) { console.warn('[inv-processor] query error:', error.message); return; }
    if (!active || !active.length) return;

    const now = new Date();
    const credited = [];

    for (const inv of active) {
      const lastRoi = inv.last_roi_at ? new Date(inv.last_roi_at) : new Date(inv.created_at);
      const hoursSinceLastRoi = (now - lastRoi) / (1000 * 60 * 60);

      if (hoursSinceLastRoi >= 24) {
        credited.push(inv);
      }

      const createdAt = new Date(inv.created_at);
      const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation >= inv.duration_days) {
        await useAdmin()
          .from('user_investments')
          .update({ status: 'completed', last_roi_at: now.toISOString() })
          .eq('id', inv.id);
        console.log(`[inv-processor] completed investment ${inv.id} (${inv.asset_label})`);
        continue;
      }
    }

    for (const inv of credited) {
      const planId = inv.plan_id;
      let dailyRoi = 1.5;
      if (planId) {
        const { data: plan } = await useAdmin()
          .from('investment_plans')
          .select('daily_roi')
          .eq('id', planId)
          .maybeSingle();
        if (plan) dailyRoi = Number(plan.daily_roi);
      }
      const roiAmount = Math.round(Number(inv.amount) * (dailyRoi / 100) * 100) / 100;

      const { data: user } = await useAdmin()
        .from('users')
        .select('balance')
        .eq('id', inv.user_id)
        .maybeSingle();
      if (!user) continue;

      const newBalance = Math.round((Number(user.balance) + roiAmount) * 100) / 100;
      await useAdmin()
        .from('users')
        .update({ balance: newBalance })
        .eq('id', inv.user_id);

      const earnedSoFar = Math.round((Number(inv.roi_earned_so_far || 0) + roiAmount) * 100) / 100;
      await useAdmin()
        .from('user_investments')
        .update({ last_roi_at: now.toISOString(), roi_earned_so_far: earnedSoFar })
        .eq('id', inv.id);

      console.log(`[inv-processor] credited $${roiAmount} ROI to user ${inv.user_id} (${inv.asset_label})`);
    }
  } catch (e) {
    console.warn('[inv-processor] error:', e.message);
  }
}

module.exports = {
  start() {
    if (timer) return;
    console.log('[inv-processor] started (interval: 60s)');
    processInvestments();
    timer = setInterval(processInvestments, INTERVAL_MS);
  },
  stop() {
    if (timer) { clearInterval(timer); timer = null; }
    console.log('[inv-processor] stopped');
  },
};
