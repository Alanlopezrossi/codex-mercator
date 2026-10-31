// Security headers for every response (static assets via _headers, dynamic pages via the Worker).
import { cspExtras } from './monetize.js';
// The CSP only allows this origin, the official API (live prices) and the official image and tile servers.
// Ads and analytics (only when enabled, see monetize.js) add their own sources.
export function buildCsp(mon = {}) {
  const x = cspExtras(mon);
  const j = (base, extra) => [base, ...extra].join(' ');
  return [
    "default-src 'self'",
    j("script-src 'self'", x.script),
    j("style-src 'self'", x.style),
    j("img-src 'self' data: https://render.guildwars2.com https://tiles.guildwars2.com https://tiles1.guildwars2.com https://tiles2.guildwars2.com https://tiles3.guildwars2.com https://tiles4.guildwars2.com", x.img),
    "font-src 'self'",
    j("connect-src 'self' https://api.guildwars2.com", x.connect),
    "manifest-src 'self'",
    "worker-src 'none'",
    "object-src 'none'",
    x.frame.length ? j('frame-src', x.frame) : "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}
export const CSP = buildCsp();

export function securityHeaders(mon = {}) {
  return {
    'Content-Security-Policy': buildCsp(mon),
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-site',
  };
}
