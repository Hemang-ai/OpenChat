import { promises as dns } from "dns";
import { isIP } from "net";

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) {
    return true;
  }

  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIp(address: string): boolean {
  const normalized = address.toLowerCase();
  if (isIP(normalized) === 4) return isPrivateIpv4(normalized);
  if (isIP(normalized) !== 6) return true;

  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mapped) return isPrivateIpv4(mapped);

  return (
    normalized === "::" ||
    normalized === "::1" ||
    /^f[cd]/.test(normalized) ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("2001:db8:")
  );
}

async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS website URLs are supported.");
  }
  if (url.username || url.password) {
    throw new Error("Website URLs cannot include credentials.");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.+$/, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Local or private network website URLs are not allowed.");
  }

  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await dns.lookup(hostname, { all: true, verbatim: true });

  if (addresses.length === 0 || addresses.some(record => isPrivateIp(record.address))) {
    throw new Error("The website URL resolves to a local or private network address.");
  }
}

export async function fetchPublicWebsite(
  input: string,
  init: Omit<RequestInit, "redirect"> = {}
): Promise<Response> {
  let current = new URL(input);

  for (let redirects = 0; redirects <= 5; redirects++) {
    await assertPublicUrl(current);
    const response = await fetch(current, { ...init, redirect: "manual" });

    if (![301, 302, 303, 307, 308].includes(response.status)) return response;

    const location = response.headers.get("location");
    if (!location) throw new Error("The website returned a redirect without a destination.");
    current = new URL(location, current);
  }

  throw new Error("The website redirected too many times.");
}
