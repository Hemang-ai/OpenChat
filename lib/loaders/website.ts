import * as cheerio from "cheerio";

export async function extractWebsiteText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; OpenBusinessChat/1.0; +https://github.com/openbusinesschat)",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

    const html = await res.text();
    const $ = cheerio.load(html);

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

    return title ? `${title}\n\n${content}` : content;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}
