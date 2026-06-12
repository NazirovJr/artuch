/**
 * Centralized secret access — fail-fast instead of silent weak fallbacks.
 *
 * Previously auth fell back to the literal 'dev_jwt_secret' when JWT_SECRET
 * was unset. Anyone knowing that string could forge valid tokens on a
 * misconfigured production box. Now: production REFUSES to boot without a
 * real secret; development gets an explicit, logged dev-only fallback.
 */

const DEV_FALLBACK = 'dev_jwt_secret';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET is missing or shorter than 16 chars. Refusing to start in ' +
        'production — set a strong random secret (e.g. `openssl rand -hex 32`).',
    );
  }

  // Development convenience only — loud, so it never goes unnoticed.
  // eslint-disable-next-line no-console
  console.warn(
    '[secrets] JWT_SECRET not set — using the DEV-ONLY fallback. ' +
      'Never run production like this.',
  );
  return secret || DEV_FALLBACK;
}
