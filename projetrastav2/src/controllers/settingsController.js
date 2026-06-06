/**
 * Public settings controller — read-only site settings for the
 * landing page and maintenance check.
 */
const { SiteSettings } = require('../models');
const { sendOk } = require('../utils/http');

module.exports = {
  /* GET /api/public/settings */
  async getPublicSettings(req, res) {
    const [maintenance, heroHeadline, heroSubtext, categories, plans] = await Promise.all([
      SiteSettings.get('maintenance_mode', false),
      SiteSettings.get('hero_headline', ''),
      SiteSettings.get('hero_subtext', ''),
      SiteSettings.get('market_categories', []),
      SiteSettings.get('pricing_plans', []),
    ]);
    return sendOk(res, {
      maintenance_mode: !!maintenance,
      hero_headline: heroHeadline,
      hero_subtext: heroSubtext,
      market_categories: categories,
      pricing_plans: plans,
    });
  },
};
