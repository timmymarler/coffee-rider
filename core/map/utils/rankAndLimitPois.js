export function rankAndLimitPois(pois, themeConfig) {
  return pois
    .map(p => {
      const title = (p.title || "").toLowerCase();

      // Matches any Rider category (cafe/fuel/meeting/scenic)
      const categoryMatches = Object.values(themeConfig.categories).some(cat => {
        const typeMatch = p.types?.some(t => cat.types.includes(t));
        const keywordMatch = cat.keywords.some(kw => title.includes(kw));
        return typeMatch || keywordMatch;
      });

      // Weighted scoring
      let score = 0;
      if (categoryMatches) score += 50;
      if (p.matchedKeywords.length > 0) score += 30;
      if (p.rating) score += p.rating * 5;
      if (p.userRatingsTotal) score += Math.log(p.userRatingsTotal + 1) * 5;

      return { ...p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}
