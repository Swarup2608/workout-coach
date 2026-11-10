import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000",
  dataFile: process.env.DATA_FILE ?? "./data/db.json",
  // ── Claude API slot ──
  anthropicApiKey: (process.env.ANTHROPIC_API_KEY ?? "").trim(),
  model: process.env.CLAUDE_MODEL ?? "claude-sonnet-5-5",
};

export const claudeEnabled = () => config.anthropicApiKey.length > 0;
