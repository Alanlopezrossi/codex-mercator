// Security headers for every response (static assets via _headers, dynamic pages via the Worker).
// The CSP only allows this origin, the official API (live prices) and the official image and tile servers.
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: https://render.guildwars2.com https://tiles.guildwars2.com https://tiles1.guildwars2.com https://tiles2.guildwars2.com https://tiles3.guildwars2.com https://tiles4.guildwars2.com",
  "font-src 'self'",
  "connect-src 'self' https://api.guildwars2.com",
  "manifest-src 'self'",
  "worker-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');

export function securityHeaders() {
  return {
    'Content-Security-Policy': CSP,
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-site',
  };
}
