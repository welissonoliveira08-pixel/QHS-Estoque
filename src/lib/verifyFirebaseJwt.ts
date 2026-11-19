import crypto from 'node:crypto';

export interface VerifiedFirebaseToken {
  uid: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'sylvan-throne-pbcxw';

let cachedCerts: Record<string, string> | null = null;
let cachedCertsExpiresAt = 0;

function parseMaxAgeSeconds(cacheControl: string | null): number {
  if (!cacheControl) return 3600;
  const match = cacheControl.match(/max-age=(\d+)/i);
  if (!match) return 3600;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 60 ? seconds : 3600;
}

async function getGooglePublicCerts(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && cachedCerts && now < cachedCertsExpiresAt) {
    return cachedCerts;
  }

  const response = await fetch(GOOGLE_CERTS_URL, {
    method: 'GET',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`Falha ao obter certificados públicos do Firebase (${response.status}).`);
  }

  const certs = (await response.json()) as Record<string, string>;
  const maxAge = parseMaxAgeSeconds(response.headers.get('cache-control'));
  cachedCerts = certs;
  cachedCertsExpiresAt = now + maxAge * 1000;
  return certs;
}

function decodeBase64UrlJson<T>(segment: string): T {
  const json = Buffer.from(segment, 'base64url').toString('utf8');
  return JSON.parse(json) as T;
}

export async function verifyFirebaseIdToken(token: string): Promise<VerifiedFirebaseToken> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Token JWT inválido.');
  }

  const [headerSeg, payloadSeg, sigSeg] = parts;
  const header = decodeBase64UrlJson<{ alg?: string; kid?: string }>(headerSeg);
  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Cabeçalho do token Firebase inválido.');
  }

  let certs = await getGooglePublicCerts(false);
  let certPem = certs[header.kid];
  if (!certPem) {
    certs = await getGooglePublicCerts(true);
    certPem = certs[header.kid];
  }
  if (!certPem) {
    throw new Error('Certificado de assinatura do token não encontrado.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerSeg}.${payloadSeg}`);
  verifier.end();

  const signatureValid = verifier.verify(certPem, Buffer.from(sigSeg, 'base64url'));
  if (!signatureValid) {
    throw new Error('Assinatura do token Firebase inválida.');
  }

  const payload = decodeBase64UrlJson<{
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    email?: string;
    email_verified?: boolean;
    name?: string;
  }>(payloadSeg);

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.aud !== FIREBASE_PROJECT_ID) {
    throw new Error('Token Firebase emitido para outro projeto.');
  }
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) {
    throw new Error('Emissor do token Firebase inválido.');
  }
  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length > 128) {
    throw new Error('Identificador de usuário inválido no token.');
  }
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec - 30) {
    throw new Error('Token Firebase expirado.');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    throw new Error('Data de emissão do token Firebase inválida.');
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    email_verified: Boolean(payload.email_verified),
    name: typeof payload.name === 'string' ? payload.name : undefined,
  };
}
