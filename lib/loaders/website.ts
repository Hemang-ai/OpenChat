import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
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

type CrawlConfig = {
  enabled?: boolean;
  maxPages?: number;
  maxDepth?: number;
  includePaths?: string[];
  excludePaths?: string[];
};

/** Measured extraction-quality signal, surfaced in the knowledge tab. */
export interface ExtractionQuality {
  completeness: "complete" | "partial" | "low";
  /** Extracted text length / total visible DOM text length (0..1). */
  extractionRatio: number;
  hasStructuredData: boolean;
  /** True when the page looks like a JavaScript-rendered shell. */
  looksJsRendered: boolean;
}

const BLOCK_TAGS = new Set([
  "p", "div", "section", "article", "main", "li", "tr", "blockquote",
  "pre", "figure", "figcaption", "address", "dt", "dd", "table", "ul", "ol",
]);
const SKIP_TAGS = new Set([
  "script", "style", "noscript", "svg", "iframe", "template", "nav",
  "footer", "header", "aside", "form", "button",
]);
const HEADING_PREFIX: Record<string, string> = {
  h1: "# ", h2: "## ", h3: "### ", h4: "#### ", h5: "##### ", h6: "###### ",
};

function inlineText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Structure-preserving extraction: headings, lists, and table rows keep
 * their structure instead of being flattened into one whitespace-collapsed
 * blob, so retrieval doesn't lose pricing tables or step order.
 */
function extractStructuredText($: cheerio.CheerioAPI, root: AnyNode): string {
  const lines: string[] = [];

  const walk = (node: AnyNode) => {
    if (node.type === "text") {
      const text = inlineText($(node).text());
      if (text) {
        if (lines.length === 0 || lines[lines.length - 1] === "") lines.push(text);
        else lines[lines.length - 1] += ` ${text}`;
      }
      return;
    }
    if (node.type !== "tag") return;

    const tag = node.name.toLowerCase();
    if (SKIP_TAGS.has(tag)) return;

    if (HEADING_PREFIX[tag]) {
      const text = inlineText($(node).text());
      if (text) lines.push("", HEADING_PREFIX[tag] + text, "");
      return;
    }
    if (tag === "li") {
      const text = inlineText($(node).text());
      if (text) lines.push(`- ${text}`);
      return;
    }
    if (tag === "tr") {
      const cells = $(node)
        .find("th, td")
        .map((_, cell) => inlineText($(cell).text()))
        .get()
        .filter(Boolean);
      if (cells.length) lines.push(cells.join(" | "));
      return;
    }
    if (tag === "br") {
      lines.push("");
      return;
    }

    const isBlock = BLOCK_TAGS.has(tag);
    if (isBlock && lines.length > 0 && lines[lines.length - 1] !== "") lines.push("");

    for (const child of $(node).contents().toArray()) walk(child);

    if (isBlock && lines.length > 0 && lines[lines.length - 1] !== "") lines.push("");
  };

  walk(root);

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function scoreCompleteness(
  extractedLength: number,
  totalVisibleLength: number,
  looksJsRendered: boolean
): { completeness: ExtractionQuality["completeness"]; ratio: number } {
  const ratio = totalVisibleLength > 0 ? Math.min(1, extractedLength / totalVisibleLength) : 0;
  if (looksJsRendered || extractedLength < 200) return { completeness: "low", ratio };
  if (ratio >= 0.5 && extractedLength >= 500) return { completeness: "complete", ratio };
  return { completeness: "partial", ratio };
}

async function extractPage(url: string): Promise<{ text: string; links: string[]; quality: ExtractionQuality }> {
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
    const hasStructuredData = structuredText.length > 0;

    // Measure total visible text BEFORE removing noise, for the completeness ratio.
    const totalVisible = inlineText($("body").text()).length;
    const scriptCount = $("script").length;

    // Remove noise elements
    $(
      "script, style, nav, footer, header, aside, .nav, .footer, .header, .sidebar, .advertisement, .ads, [role=navigation], [role=banner]"
    ).remove();

    // Extract title
    const title = $("title").text().trim() || $("h1").first().text().trim();

    // Extract main content with headings/lists/tables preserved
    let content = "";
    const mainSelectors = ["main", "article", '[role="main"]', ".content", ".post", "#content", "body"];
    for (const sel of mainSelectors) {
      const el = $(sel);
      if (el.length && inlineText(el.text()).length > 200) {
        content = extractStructuredText($, el.get(0)!);
        break;
      }
    }

    if (!content) {
      const body = $("body").get(0);
      content = body ? extractStructuredText($, body) : "";
    }

    if (content.length < 10) content = structuredText;

    // SPA shell heuristic: heavy on scripts, nearly no visible text.
    const looksJsRendered = totalVisible < 200 && scriptCount >= 3;

    if (content.length < 10) {
      throw new Error(
        looksJsRendered
          ? "This page builds its content with JavaScript, so the text couldn't be read directly. Try a static page (like an FAQ or About page), or paste the content as manual text."
          : "The page did not contain readable text. It may require JavaScript rendering or block automated access."
      );
    }

    const { completeness, ratio } = scoreCompleteness(content.length, totalVisible, looksJsRendered);
    const links = $("a[href]").map((_, element) => $(element).attr("href") || "").get();
    return {
      text: title ? `${title}\n\n${content}` : content,
      links,
      quality: {
        completeness,
        extractionRatio: Number(ratio.toFixed(2)),
        hasStructuredData,
        looksJsRendered,
      },
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`The website did not respond within ${timeoutMs / 1000} seconds. Try the page again or add its content as manual text.`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractWebsiteText(url: string): Promise<string> {
  return (await extractPage(url)).text;
}

/** Worst completeness across pages wins — one weak page flags the source. */
function worstQuality(qualities: ExtractionQuality[]): ExtractionQuality {
  const rank = { low: 0, partial: 1, complete: 2 } as const;
  return qualities.reduce((worst, current) =>
    rank[current.completeness] < rank[worst.completeness] ? current : worst
  );
}

export async function crawlWebsite(url: string, config: CrawlConfig = {}): Promise<{ text: string; pages: string[]; quality: ExtractionQuality }> {
  if (!config.enabled) {
    const page = await extractPage(url);
    return { text: page.text, pages: [url], quality: page.quality };
  }

  const root = new URL(url);
  const maxPages = Math.min(Math.max(config.maxPages || 10, 1), 50);
  const maxDepth = Math.min(Math.max(config.maxDepth || 1, 0), 3);
  const queue: Array<{ url: string; depth: number }> = [{ url: root.toString(), depth: 0 }];
  const visited = new Set<string>();
  const pages: Array<{ url: string; text: string; quality: ExtractionQuality }> = [];

  const pathAllowed = (candidate: URL) => {
    if (candidate.origin !== root.origin) return false;
    if (config.includePaths?.length && !config.includePaths.some((path) => candidate.pathname.startsWith(path))) return false;
    if (config.excludePaths?.some((path) => candidate.pathname.startsWith(path))) return false;
    return true;
  };

  while (queue.length && pages.length < maxPages) {
    const current = queue.shift()!;
    const normalized = new URL(current.url);
    normalized.hash = "";
    const key = normalized.toString();
    if (visited.has(key) || !pathAllowed(normalized)) continue;
    visited.add(key);

    try {
      const page = await extractPage(key);
      pages.push({ url: key, text: page.text, quality: page.quality });
      if (current.depth >= maxDepth) continue;
      for (const href of page.links) {
        try {
          const candidate = new URL(href, normalized);
          candidate.hash = "";
          if (pathAllowed(candidate) && !visited.has(candidate.toString())) queue.push({ url: candidate.toString(), depth: current.depth + 1 });
        } catch {
          // Ignore malformed and non-URL links.
        }
      }
    } catch (error) {
      if (pages.length === 0) throw error;
    }
  }

  if (!pages.length) throw new Error("No readable pages were found within the crawler rules.");
  return {
    pages: pages.map((page) => page.url),
    text: pages.map((page) => `SOURCE PAGE: ${page.url}\n${page.text}`).join("\n\n---\n\n"),
    quality: worstQuality(pages.map((page) => page.quality)),
  };
}
