import * as cheerio from "cheerio";
import { fetchPublicWebsite } from "@/lib/security/safe-fetch";

function collectStructuredText($: cheerio.CheerioAPI): string {
  const values = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && value.trim().length > 2) values.add(value.trim());
  };

  add($("meta[name=description]").attr("content"));
  add($("meta[property='og:description']").attr("content"));

  $("script[type='application/ld+json']").each((_, element) => {
    try {
      const data = JSON.parse($(element).text()) as unknown;
      const visit = (value: unknown) => {
        if (typeof value === "string") add(value);
        else if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === "object") Object.values(value).forEach(visit);
      };
      visit(data);
    } catch {
      // Invalid structured data should not prevent extraction of visible content.
    }
  });

  return Array.from(values).join("\n");
}

export async function extractWebsiteText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutMs = 30_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchPublicWebsite(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; OpenBusinessChat/1.0; +https://github.com/Hemang-ai/OpenChat)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
        "Accept-Language": "en-US,en;q=0.8",
      },
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      throw new Error(`The URL returned unsupported content (${contentType || "unknown type"}).`);
    }

    const contentLength = Number(res.headers.get("content-length") || 0);
    if (contentLength > 5 * 1024 * 1024) {
      throw new Error("The webpage is larger than the 5 MB extraction limit.");
    }

    const html = await res.text();
    if (html.length > 5 * 1024 * 1024) {
      throw new Error("The webpage is larger than the 5 MB extraction limit.");
    }
    const $ = cheerio.load(html);
    const structuredText = collectStructuredText($);

    // Remove noise elements
    $(
      "script, style, nav, footer, header, aside, .nav, .footer, .header, .sidebar, .advertisement, .ads, [role=navigation], [role=banner]"
    ).remove();

    // Extract title
    const title = $("title").text().trim() || $("h1").first().text().trim();

    // Extract main content
    let content = "";
    const mainSelectors = ["main", "article", '[role="main"]', ".content", ".post", "#content", "body"];
    for (const sel of mainSelectors) {
      const el = $(sel);
      if (el.length && el.text().trim().length > 200) {
        content = el.text().trim();
        break;
      }
    }

    if (!content) content = $("body").text().trim();

    // Clean whitespace
    content = content.replace(/\s+/g, " ").trim();

    if (content.length < 10) content = structuredText;

    if (content.length < 10) {
      throw new Error("The page did not contain readable text. It may require JavaScript rendering or block automated access.");
    }

    return title ? `${title}\n\n${content}` : content;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`The website did not respond within ${timeoutMs / 1000} seconds. Try the page again or add its content as manual text.`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
