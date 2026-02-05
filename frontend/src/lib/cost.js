/**
 * Cost per 1K tokens (input + output blended). Update with your provider's pricing.
 * Values are in USD.
 */
export const MODEL_PRICE_PER_1K = {
  'kimi-k2p5': 0.002,
  'kimi-k2-instruct-0905': 0.0015,
}

const DEFAULT_PRICE = 0.002

/** Default tokens to estimate per step when no run exists (input + output guess) */
export const ESTIMATED_TOKENS_PER_STEP = 1500

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

/** Estimate credits (tokens and cost) for a workflow before run. Per-step and total. */
export function estimateWorkflowCredits(steps) {
  const byStep = (steps || []).map((s) => {
    const model = s.model === 'auto' ? 'kimi-k2-instruct-0905' : (s.model || 'kimi-k2p5')
    const tokens = ESTIMATED_TOKENS_PER_STEP
    const cost = costForTokens(model, tokens)
    return { stepId: s.id, model, tokens, cost }
  })
  const totalTokens = byStep.reduce((s, x) => s + x.tokens, 0)
  const totalCost = byStep.reduce((s, x) => s + x.cost, 0)
  return { byStep, totalTokens, totalCost }
}
