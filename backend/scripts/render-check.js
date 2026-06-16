const INSECURE_JWT_SECRETS = new Set([
  'dev-secret-change-in-production',
  'change-me-in-production',
  'change-me-to-a-long-random-secret',
]);

function fail(message) {
  console.error(`[OWN AI] ${message}`);
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  if (process.env.REQUIRE_API_AUTH !== 'true') {
    fail('Set REQUIRE_API_AUTH=true in Render environment variables.');
  }

  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || INSECURE_JWT_SECRETS.has(secret)) {
    fail('Set JWT_SECRET to a strong random value in Render environment variables.');
  }

  if (!process.env.PORT) {
    fail('Render must provide PORT (usually 10000). Do not override PORT manually unless required.');
  }
}
