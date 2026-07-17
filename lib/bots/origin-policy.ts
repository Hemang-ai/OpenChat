export function normalizeRequestOrigin(value?: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isOriginAllowed(allowedOrigins: string[], candidate?: string | null): boolean {
  if (allowedOrigins.length === 0) return true;
  const origin = normalizeRequestOrigin(candidate);
  return Boolean(origin && allowedOrigins.includes(origin));
}
