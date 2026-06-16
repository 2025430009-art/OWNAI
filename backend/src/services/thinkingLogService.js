import { getPool, isDatabaseAvailable } from '../db/index.js';

export function resolveDbUserId(req) {
  const id = req.user?.id;
  if (typeof id === 'number' && Number.isFinite(id)) return id;
  if (typeof id === 'string' && /^\d+$/.test(id)) return Number(id);
  return null;
}

export async function saveThinkingLog({
  userId,
  message,
  mode,
  detectedMode,
  promptSent,
  rawResponse,
  parsedResult,
  confidence,
  tokensUsed,
  durationMs,
}) {
  if (!isDatabaseAvailable() || userId == null) return null;

  const { rows } = await getPool().query(
    `INSERT INTO thinking_logs (
       user_id, message, mode, detected_mode, prompt_sent, raw_response,
       parsed_result, confidence, tokens_used, duration_ms
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, created_at`,
    [
      userId,
      message,
      mode,
      detectedMode,
      promptSent,
      rawResponse,
      parsedResult || null,
      confidence,
      tokensUsed,
      durationMs,
    ],
  );

  return rows[0];
}

export async function listThinkingLogs(userId, limit = 20) {
  if (!isDatabaseAvailable() || userId == null) return [];

  const { rows } = await getPool().query(
    `SELECT id, message, mode, confidence, tokens_used, created_at
     FROM thinking_logs
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit],
  );

  return rows;
}

export async function getThinkingLogById(userId, logId) {
  if (!isDatabaseAvailable() || userId == null) return null;

  const { rows } = await getPool().query(
    `SELECT *
     FROM thinking_logs
     WHERE id = $1 AND user_id = $2`,
    [logId, userId],
  );

  return rows[0] || null;
}
