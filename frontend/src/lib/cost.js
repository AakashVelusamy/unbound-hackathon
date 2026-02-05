/**
 * Cost per 1K tokens (input + output blended). Update with your provider's pricing.
 * Values are in USD.
 */
export const MODEL_PRICE_PER_1K = {
  'kimi-k2p5': 0.002,
  'kimi-k2-instruct-0905': 0.0015,
}

const DEFAULT_PRICE = 0.002

export function costForTokens(model, tokens) {
  if (tokens == null || tokens <= 0) return 0
  const per1k = MODEL_PRICE_PER_1K[model] ?? DEFAULT_PRICE
  return (tokens / 1000) * per1k
}

export function formatCost(usd) {
  if (usd === 0) return '$0.00'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}
