import crypto from 'crypto';

const DEFAULT_TOKEN_SECRET = 'tech_arena_2026_hmac_secret_key_v1_kle_bca';

function getTokenSecret(): string {
  return process.env.SESSION_SECRET || process.env.ADMIN_MASTER_PASSKEY || DEFAULT_TOKEN_SECRET;
}

const SALT = 'tech_arena_2026_passkey_salt_v1';

// Precomputed scrypt hashes for the authorized passkeys ('tech@kle', 'vybe2k26', 'Matrix2026')
const AUTHORIZED_PASSKEY_HASHES: Buffer[] = [
  'tech@kle',
  'vybe2k26',
  'Matrix2026',
].map((key) => crypto.scryptSync(key, SALT, 64));

/**
 * Verifies an admin passkey using scrypt + timingSafeEqual to prevent timing attacks.
 */
export function verifyAdminPasskey(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim();
  if (!trimmed) return false;

  const inputHash = crypto.scryptSync(trimmed, SALT, 64);
  let matched = false;

  for (const validHash of AUTHORIZED_PASSKEY_HASHES) {
    if (crypto.timingSafeEqual(inputHash, validHash)) {
      matched = true;
    }
  }

  const envMaster = process.env.ADMIN_MASTER_PASSKEY?.trim();
  if (envMaster) {
    const envHash = crypto.scryptSync(envMaster, SALT, 64);
    if (crypto.timingSafeEqual(inputHash, envHash)) {
      matched = true;
    }
  }

  return matched;
}

/**
 * Generates an HMAC-SHA256 signature for a payload string.
 */
function signPayload(payload: string): string {
  return crypto
    .createHmac('sha256', getTokenSecret())
    .update(payload)
    .digest('hex');
}

/**
 * Constant-time verification of an HMAC-SHA256 hex signature.
 */
function verifySignature(payload: string, signatureHex: string): boolean {
  if (!signatureHex || !/^[0-9a-f]{64}$/i.test(signatureHex)) return false;
  const expectedHex = signPayload(payload);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const actualBuf = Buffer.from(signatureHex, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Signs an admin session token: `ta_admin_<randomHex>.<hmac>`
 */
export function signAdminToken(): string {
  const randomId = crypto.randomBytes(24).toString('hex');
  const baseToken = `ta_admin_${randomId}`;
  const sig = signPayload(baseToken);
  return `${baseToken}.${sig}`;
}

/**
 * Verifies the HMAC signature on an admin token (`ta_admin_<randomHex>.<hmac>`).
 */
export function verifyAdminTokenSignature(token: string): boolean {
  if (!token || !token.startsWith('ta_admin_')) return false;
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) return false;
  const baseToken = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);
  if (baseToken.length <= 'ta_admin_'.length) return false;
  return verifySignature(baseToken, sig);
}

/**
 * Signs a participant token: `ta_team_<code_without_dots>.<userId>.<hmac>`
 */
export function signParticipantToken(userId: number, code: string): string {
  const normalizedCode = code.trim().toUpperCase();
  const basePayload = `ta_team_${normalizedCode}.${userId}`;
  const sig = signPayload(basePayload);
  return `${basePayload}.${sig}`;
}

/**
 * Verifies a signed participant token and returns `{ userId, code }` if valid.
 */
export function verifyParticipantToken(
  token: string
): { userId: number; code: string } | null {
  if (!token || !token.startsWith('ta_team_')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [prefixAndCode, userIdStr, sig] = parts;
  const code = prefixAndCode.replace(/^ta_team_/, '').trim().toUpperCase();
  const userId = Number(userIdStr);
  if (!code || !Number.isInteger(userId) || userId <= 0) return null;

  const basePayload = `ta_team_${code}.${userId}`;
  if (!verifySignature(basePayload, sig)) return null;

  return { userId, code };
}
