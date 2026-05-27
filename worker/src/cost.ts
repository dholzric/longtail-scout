/**
 * Per-run cost tally. Mutated by agent phases as they call BD and LLMs.
 *
 * Unit costs (rough, conservative — actual billing reconciles at month end):
 *   - Bright Data Scraping Browser render: ~$0.005 per navigation
 *   - DeepSeek chat: $0.27 / 1M input tokens, $1.10 / 1M output tokens
 *   - Nominatim (local, self-hosted): $0
 *   - Demand API (local): $0
 */

export const COST_PER_BD_RENDER = 0.005;
export const COST_PER_DEEPSEEK_INPUT = 0.27 / 1_000_000;
export const COST_PER_DEEPSEEK_OUTPUT = 1.10 / 1_000_000;

export interface CostTally {
  bd_renders: number;
  llm_calls: number;
  llm_input_tokens: number;
  llm_output_tokens: number;
}

export function newCostTally(): CostTally {
  return { bd_renders: 0, llm_calls: 0, llm_input_tokens: 0, llm_output_tokens: 0 };
}

export interface CostSnapshot {
  bd_renders: number;
  llm_calls: number;
  llm_input_tokens: number;
  llm_output_tokens: number;
  bd_usd: number;
  llm_usd: number;
  total_usd: number;
}

export function snapshot(t: CostTally): CostSnapshot {
  const bd_usd = t.bd_renders * COST_PER_BD_RENDER;
  const llm_usd = t.llm_input_tokens * COST_PER_DEEPSEEK_INPUT + t.llm_output_tokens * COST_PER_DEEPSEEK_OUTPUT;
  return {
    bd_renders: t.bd_renders,
    llm_calls: t.llm_calls,
    llm_input_tokens: t.llm_input_tokens,
    llm_output_tokens: t.llm_output_tokens,
    bd_usd: Math.round(bd_usd * 10000) / 10000,
    llm_usd: Math.round(llm_usd * 10000) / 10000,
    total_usd: Math.round((bd_usd + llm_usd) * 10000) / 10000
  };
}
