// themes/merge.js
export function mergeThemes(base, override) {
  return { ...base, ...override };
}
