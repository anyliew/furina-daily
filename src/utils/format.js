// src/utils/format.js

/**
 * 格式化热度值，如 12800 → "1.3w"
 */
export function formatHotValue(value) {
  if (!value) return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return value.toString();
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w';
  }
  return num.toString();
}