import { load } from "cheerio";
import type {
  Torrent,
  SearchResult,
  TorrentDetail,
  User,
  Comment,
  FileNode,
} from "./types.js";

const NYAA_BASE = "https://nyaa.si";
const SUKEBEI_BASE = "https://sukebei.nyaa.si";
const FETCH_TIMEOUT = 15000;

export function getSiteBase(site: "nyaa" | "sukebei"): string {
  return site === "nyaa" ? NYAA_BASE : SUKEBEI_BASE;
}

function cleanText(text: string | undefined): string {
  return (text || "").trim().replace(/\s+/g, " ");
}

function cleanMultilineText(text: string | undefined): string {
  return (text || "").trim().replace(/\r\n/g, "\n");
}

function extractBTIH(magnetLink: string): string | null {
  const match = magnetLink.match(/btih:([a-fA-F0-9]+)/i);
  return match ? match[1].toLowerCase() : null;
}

function convertToMibiBinary(sizeStr: string): string {
  const sizeStr_lower = sizeStr.toLowerCase().trim();

  // Parse number and unit
  const match = sizeStr_lower.match(/^([\d.]+)\s*([kmgt]i?b?)$/);
  if (!match) return sizeStr;

  const value = parseFloat(match[1]);
  const unit = match[2];

  let bytes = 0;
  if (unit === "b" || unit === "") bytes = value;
  else if (unit === "kb" || unit === "kib") bytes = value * 1024;
  else if (unit === "mb" || unit === "mib") bytes = value * 1024 * 1024;
  else if (unit === "gb" || unit === "gib") bytes = value * 1024 * 1024 * 1024;
  else if (unit === "tb" || unit === "tib")
    bytes = value * 1024 * 1024 * 1024 * 1024;
  else if (unit === "k") bytes = value * 1000;
  else if (unit === "m") bytes = value * 1000 * 1000;
  else if (unit === "g") bytes = value * 1000 * 1000 * 1000;
  else if (unit === "t") bytes = value * 1000 * 1000 * 1000 * 1000;
  else return sizeStr;

  // Convert to binary units
  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  let index = 0;
  let result = bytes;

  while (result >= 1024 && index < units.length - 1) {
    result /= 1024;
    index++;
  }

  return `${result.toFixed(2)} ${units[index]}`;
}

function parseTorrentRow(row: any, $: any): Torrent | null {
  try {
    const cells = $(row).find("td");
    if (cells.length < 8) return null;

    const categoryLink = $(cells[0]).find("a");
    const nameCell = $(cells[1]);
    const hasColspan = nameCell.attr("colspan") === "2";

    const nameLink = nameCell.find("a:not(.comments)");
    const commentsLink = nameCell.find("a.comments");

    const idMatch = nameLink.attr("href")?.match(/\/view\/(\d+)/);
    if (!idMatch) return null;

    const id = parseInt(idMatch[1]);
    const name = cleanText(nameLink.text());
    const category = cleanText(categoryLink.attr("title"));
    const [cat, subcat] = category.split(" - ");

    // Offset depends on whether name and comments are merged
    const offset = hasColspan ? 0 : 1;
    const linksCell = $(cells[2 + offset]);
    const downloadLink = linksCell.find('a[href^="/download/"]').attr("href");
    const download = downloadLink ? `${NYAA_BASE}${downloadLink}` : "";
    const magnetLink = linksCell.find('a[href^="magnet:"]').attr("href") || "";

    const size = cleanText($(cells[3 + offset]).text());

    const dateCell = $(cells[4 + offset]);
    const timestamp = dateCell.attr("data-timestamp");
    const uploadDate = timestamp
      ? new Date(parseInt(timestamp) * 1000).toISOString()
      : cleanText(dateCell.text());

    const seeders = parseInt(cleanText($(cells[5 + offset]).text())) || 0;
    const leechers = parseInt(cleanText($(cells[6 + offset]).text())) || 0;
    const downloads = parseInt(cleanText($(cells[7 + offset]).text())) || 0;

    const infoHash = extractBTIH(magnetLink);

    return {
      id,
      name,
      category: cat || "Anime",
      subcategory: subcat || "Unknown",
      comments: parseInt(cleanText(commentsLink.text())) || 0,
      downloads,
      seeders,
      leechers,
      size,
      uploadDate,
      magnet: magnetLink,
      download,
      infoHash,
      trusted: $(row).hasClass("success"),
      remake: $(row).hasClass("danger"),
    };
  } catch (error) {
    console.error("Error parsing torrent row:", error);
    return null;
  }
}

async function fetchWithTimeout(
  url: string,
  timeout = FETCH_TIMEOUT,
  session?: string,
): Promise<Response> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    };

    if (session) {
      headers["Cookie"] = session;
    }

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers,
      });
      clearTimeout(timeoutId);
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error(`Fetch error for ${url}:`, error);
    throw error;
  }
}

export async function searchTorrents(
  site: "nyaa" | "sukebei",
  query: string,
  options: {
    p?: number;
    c?: string;
    f?: string;
    s?: string;
    o?: string;
    session?: string;
  } = {},
): Promise<SearchResult> {
  try {
    const siteBase = getSiteBase(site);
    const url = new URL(`${siteBase}/`);

    if (query) url.searchParams.set("q", query);
    if (options.p) url.searchParams.set("p", String(options.p));
    if (options.c) url.searchParams.set("c", options.c);
    if (options.f) url.searchParams.set("f", options.f);
    if (options.s) url.searchParams.set("s", options.s);
    if (options.o) url.searchParams.set("o", options.o);

    console.log(`[Search] Fetching: ${url.toString()}`);
    const response = await fetchWithTimeout(
      url.toString(),
      FETCH_TIMEOUT,
      options.session,
    );

    if (!response.ok) {
      console.error(`[Search] HTTP ${response.status} from ${url.toString()}`);
      return {
        torrents: [],
        pagination: { currentPage: 1, totalPages: 1, totalResults: 0 },
      };
    }

    // Check if we were redirected to a view page (happens with direct infoHash search)
    if (response.url.includes("/view/")) {
      const match = response.url.match(/\/view\/(\d+)/);
      if (match) {
        console.log(`[Search] Redirected to view page: ${response.url}`);
        const id = parseInt(match[1]);
        const html = await response.text();
        const detail = parseTorrentDetail(html, id);
        if (detail) {
          // Convert TorrentDetail to Torrent for consistency in search results
          return {
            torrents: [
              {
                id: detail.id,
                name: detail.name,
                category: detail.category,
                subcategory: detail.subcategory,
                comments: detail.comments?.length || 0,
                downloads: detail.downloads,
                seeders: detail.seeders,
                leechers: detail.leechers,
                size: detail.size,
                uploadDate: detail.uploadDate,
                magnet: detail.magnet,
                download: detail.download,
                infoHash: detail.infoHash,
                trusted: detail.trusted,
                remake: detail.remake,
                anonymous: detail.anonymous,
              },
            ],
            pagination: {
              currentPage: 1,
              totalPages: 1,
              totalResults: 1,
            },
          };
        }
      }
    }

    const html = await response.text();
    console.log(`[Search] Received ${html.length} bytes`);

    const $ = load(html);

    const torrents: Torrent[] = [];
    $(".torrent-list tbody tr").each((_, row) => {
      const torrent = parseTorrentRow(row, $);
      if (torrent) torrents.push(torrent);
    });

    const pagination = parsePagination($) || {
      currentPage: 1,
      totalPages: 1,
      totalResults: torrents.length,
    };

    console.log(`[Search] Parsed ${torrents.length} torrents`);
    return { torrents, pagination };
  } catch (error) {
    console.error("[Search] Error:", error);
    return {
      torrents: [],
      pagination: { currentPage: 1, totalPages: 1, totalResults: 0 },
    };
  }
}

export async function getTorrentDetail(
  site: "nyaa" | "sukebei",
  torrentId: number,
  session?: string,
): Promise<TorrentDetail | null> {
  try {
    const siteBase = getSiteBase(site);
    const url = `${siteBase}/view/${torrentId}`;

    console.log(`[Detail] Fetching: ${url}`);
    const response = await fetchWithTimeout(url, FETCH_TIMEOUT, session);
    if (!response.ok) {
      console.error(`[Detail] HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();
    return parseTorrentDetail(html, torrentId);
  } catch (error) {
    console.error("[Detail] Error:", error);
    return null;
  }
}

function parseTorrentDetail(
  html: string,
  torrentId: number,
): TorrentDetail | null {
  try {
    const $ = load(html);

    const titleElement = $("h3.panel-title").first();
    const name = cleanText(titleElement.text());

    const downloadLink = $('a[href^="/download/"]').first().attr("href");
    const download = downloadLink ? `${NYAA_BASE}${downloadLink}` : "";
    const magnetLink = $('a[href^="magnet:"]').first().attr("href") || "";
    const infoHash = extractBTIH(magnetLink);

    // Parse trackers from magnet
    const trackers: string[] = [];
    const magnetUrlParts = magnetLink.split("?");
    if (magnetUrlParts.length > 1) {
      const magnetParams = new URLSearchParams(magnetUrlParts[1]);
      magnetParams.getAll("tr").forEach((tr) => {
        if (tr) trackers.push(decodeURIComponent(tr));
      });
    }

    // Metadata parsing
    const metadata: Record<string, string> = {};
    let uploadDate = "";
    $(".panel-body .row").each((_, row) => {
      $(row)
        .find(".col-md-1")
        .each((_, labelCol) => {
          const label = cleanText($(labelCol).text()).replace(":", "");
          const valueCol = $(labelCol).next(".col-md-5");
          const value = cleanText(valueCol.text());

          if (label === "Date") {
            const timestamp = valueCol.attr("data-timestamp");
            uploadDate = timestamp
              ? new Date(parseInt(timestamp) * 1000).toISOString()
              : value;
          }

          if (label && value) {
            metadata[label] = value;
          }
        });
    });

    const categoryText = metadata["Category"] || "Anime - Unknown";
    const [cat, ...subcatParts] = categoryText.split(" - ");
    const subcat = subcatParts.join(" - ") || "Unknown";
    const size = metadata["File size"] || "Unknown";

    const uploader = metadata["Submitter"] || "Anonymous";
    const information = metadata["Information"] || null;

    // Seeders/Leechers/Downloads
    const seeders = parseInt(metadata["Seeders"] || "0") || 0;
    const leechers = parseInt(metadata["Leechers"] || "0") || 0;
    const downloads = parseInt(metadata["Completed"] || "0") || 0;

    const description = cleanMultilineText($("#torrent-description").text());

    const comments: Comment[] = [];
    $(".comment-panel").each((idx, panel) => {
      const usernameElem = $(panel).find('a[href*="/user/"]').first();
      const username = cleanText(usernameElem.text());

      const contentElem = $(panel).find(".comment-content");
      const text = cleanMultilineText(contentElem.text());

      const timestampElem = $(panel).find("[data-timestamp]");
      const timestampRaw = timestampElem.attr("data-timestamp");
      const timestamp = timestampRaw
        ? new Date(parseInt(timestampRaw) * 1000).toISOString()
        : "";

      const role =
        $(panel).find('p:contains("(uploader)")').length > 0
          ? "uploader"
          : null;
      const avatar = $(panel).find("img.avatar").attr("src") || null;

      // Extract numeric ID from com-X (sequential) or torrent-commentX (global)
      const contentId = contentElem.attr("id");
      const globalIdMatch = contentId?.match(/torrent-comment(\d+)/);
      const panelId = $(panel).attr("id");
      const sequentialId = parseInt(panelId?.replace("com-", "") || "0") || 0;
      const numericId = globalIdMatch
        ? parseInt(globalIdMatch[1])
        : sequentialId;

      if (username && text) {
        comments.push({
          id: numericId,
          pos: idx + 1,
          username,
          text,
          timestamp,
          role,
          avatar,
        });
      }
    });

    // File list parsing
    const fileList: FileNode[] = [];
    $(".torrent-file-list > ul > li").each((_, li) => {
      fileList.push(parseFileNode(li, $));
    });

    return {
      id: torrentId,
      name,
      category: cat,
      subcategory: subcat,
      comments,
      downloads,
      seeders,
      leechers,
      size,
      uploadDate,
      uploader,
      magnet: magnetLink,
      download,
      infoHash,
      trackers,
      trusted: $(".text-success").length > 0,
      remake: $(".text-danger").length > 0,
      anonymous: uploader === "Anonymous",
      description,
      information,
      fileList,
    };
  } catch (error) {
    console.error("[Detail] Parse error:", error);
    return null;
  }
}

function parseFileNode(li: any, $: any): FileNode {
  const link = $(li).find("> a.folder");
  const text = cleanText(link.length > 0 ? link.text() : $(li).text());

  // Extract size from text like "filename (1.4 GiB)"
  const sizeMatch = text.match(/\(([^)]+)\)$/);
  const name = sizeMatch ? text.slice(0, text.lastIndexOf("(")).trim() : text;
  const size = sizeMatch ? sizeMatch[1] : null;

  const childrenUl = $(li).find("> ul");
  const isDir = childrenUl.length > 0 || link.hasClass("folder");

  const node: FileNode = {
    name,
    size,
    type: isDir ? "dir" : "file",
  };

  if (childrenUl.length > 0) {
    node.children = [];
    childrenUl.find("> li").each((_i: number, childLi: any) => {
      node.children?.push(parseFileNode(childLi, $));
    });
  }

  return node;
}

export async function getUserInfo(
  site: "nyaa" | "sukebei",
  userId: number,
  session?: string,
): Promise<User | null> {
  try {
    const siteBase = getSiteBase(site);
    const url = `${siteBase}/user/${userId}`;

    console.log(`[UserInfo] Fetching: ${url}`);
    const response = await fetchWithTimeout(url, FETCH_TIMEOUT, session);
    if (!response.ok) {
      console.error(`[UserInfo] HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = load(html);

    const titleSpan = $("h3 span").first();
    const username = titleSpan.text() || `user_${userId}`;
    const title =
      titleSpan.attr("title") || titleSpan.attr("data-original-title") || null;

    const titleText = cleanText($("h3").first().text());
    const uploadsMatch = titleText.match(/\((\d+)\)/);
    const uploads = uploadsMatch ? parseInt(uploadsMatch[1]) : 0;

    return {
      username,
      title,
      uploads: uploads || null,
    };
  } catch (error) {
    console.error("[UserInfo] Error:", error);
    return null;
  }
}

export async function getUserByUsername(
  site: "nyaa" | "sukebei",
  username: string,
  session?: string,
): Promise<User | null> {
  try {
    const siteBase = getSiteBase(site);
    const url = `${siteBase}/user/${encodeURIComponent(username)}`;

    console.log(`[UserUsername] Fetching: ${url}`);
    const response = await fetchWithTimeout(url, FETCH_TIMEOUT, session);
    if (!response.ok) {
      console.error(`[UserUsername] HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = load(html);

    const titleSpan = $("h3 span").first();
    const pageUsername = titleSpan.text() || username;
    const title =
      titleSpan.attr("title") || titleSpan.attr("data-original-title") || null;

    const titleText = cleanText($("h3").first().text());
    const uploadsMatch = titleText.match(/\((\d+)\)/);
    const uploads = uploadsMatch ? parseInt(uploadsMatch[1]) : 0;

    return {
      username: pageUsername,
      title,
      uploads: uploads || null,
    };
  } catch (error) {
    console.error("[UserUsername] Error:", error);
    return null;
  }
}

export async function getUserUploads(
  site: "nyaa" | "sukebei",
  userSelector: number | string,
  options: { p?: number; s?: string; o?: string; session?: string } = {},
): Promise<SearchResult> {
  try {
    const siteBase = getSiteBase(site);
    const url = new URL(`${siteBase}/user/${userSelector}`);

    if (options.p) url.searchParams.set("p", String(options.p));
    if (options.s) url.searchParams.set("s", options.s);
    if (options.o) url.searchParams.set("o", options.o);

    console.log(`[UserUploads] Fetching: ${url.toString()}`);
    const response = await fetchWithTimeout(
      url.toString(),
      FETCH_TIMEOUT,
      options.session,
    );
    if (!response.ok) {
      console.error(`[UserUploads] HTTP ${response.status}`);
      return {
        torrents: [],
        pagination: { currentPage: 1, totalPages: 1, totalResults: 0 },
      };
    }

    const html = await response.text();
    const $ = load(html);

    const torrents: Torrent[] = [];
    $(".torrent-list tbody tr").each((_, row) => {
      const torrent = parseTorrentRow(row, $);
      if (torrent) torrents.push(torrent);
    });

    const pagination = parsePagination($) || {
      currentPage: 1,
      totalPages: 1,
      totalResults: torrents.length,
    };

    console.log(`[UserUploads] Parsed ${torrents.length} torrents`);
    return { torrents, pagination };
  } catch (error) {
    console.error("[UserUploads] Error:", error);
    return {
      torrents: [],
      pagination: { currentPage: 1, totalPages: 1, totalResults: 0 },
    };
  }
}

function parsePagination(
  $: any,
): { currentPage: number; totalPages: number; totalResults: number } | null {
  const paginationElem = $(".pagination");
  const pageInfoElem = $(".pagination-page-info");

  let totalResults = 0;
  if (pageInfoElem.length > 0) {
    const infoText = cleanText(pageInfoElem.text());
    const match = infoText.match(/out of (\d+) results/);
    if (match) totalResults = parseInt(match[1]);
  }

  if (paginationElem.length === 0) {
    const rowCount = $(".torrent-list tbody tr").length;
    if (totalResults > 0 || rowCount > 0) {
      return {
        currentPage: 1,
        totalPages: 1,
        totalResults: totalResults || rowCount,
      };
    }
    return null;
  }

  const activePage = parseInt(paginationElem.find(".active").text()) || 1;
  const pageNumbers: number[] = [];
  paginationElem.find("li a").each((_: number, el: any) => {
    const txt = $(el).text().trim();
    const num = parseInt(txt);
    if (!isNaN(num)) {
      pageNumbers.push(num);
    }
  });
  const totalPages =
    pageNumbers.length > 0 ? Math.max(...pageNumbers) : activePage;

  if (totalResults === 0) {
    const titleText = cleanText($("h3").first().text());
    const uploadsMatch = titleText.match(/\((\d+)\)/);
    totalResults = uploadsMatch
      ? parseInt(uploadsMatch[1])
      : torrentsCount($) || 0;
  }

  return {
    currentPage: activePage,
    totalPages,
    totalResults,
  };
}

function parseWhoami($: any): string | null {
  // Select the username from the navbar dropdown
  // The structure is: <ul class="nav navbar-nav navbar-right"> ... <a class="dropdown-toggle" ...> <i ...></i> USERNAME <span class="caret"></span> </a>
  const dropdownLink = $(".navbar-right .dropdown-toggle");
  if (dropdownLink.length === 0) return null;

  // We want to find the link that contains the user icon
  const userLink = dropdownLink.filter((_: any, el: any) => {
    return $(el).find("i.fa-user").length > 0;
  });

  if (userLink.length === 0) return null;

  // Clone to avoid modifying original, then remove icons/carets to get clean text
  const cloned = userLink.clone();
  cloned.find("i, span").remove();
  const username = cloned.text().trim();

  return username || null;
}

export async function getWhoami(
  site: "nyaa" | "sukebei",
  session?: string,
): Promise<string | null> {
  if (!session) return null;

  try {
    const siteBase = getSiteBase(site);
    console.log(`[Whoami] Fetching: ${siteBase}`);
    const response = await fetchWithTimeout(siteBase, FETCH_TIMEOUT, session);
    if (!response.ok) {
      console.error(`[Whoami] HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = load(html);
    return parseWhoami($);
  } catch (error) {
    console.error("[Whoami] Error:", error);
    return null;
  }
}

function torrentsCount($: any): number {
  // Fallback count based on visible rows
  return $(".torrent-list tbody tr").length;
}

export async function getMainPageTorrents(
  site: "nyaa" | "sukebei",
  session?: string,
): Promise<Torrent[]> {
  try {
    const siteBase = getSiteBase(site);

    console.log(`[MainPage] Fetching: ${siteBase}`);
    const response = await fetchWithTimeout(siteBase, FETCH_TIMEOUT, session);
    if (!response.ok) {
      console.error(`[MainPage] HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();
    console.log(`[MainPage] Received ${html.length} bytes`);

    const $ = load(html);

    // Debug: Check if we can find torrent rows
    const torrentRows = $(".torrent-list tbody tr");
    console.log(`[MainPage] Found ${torrentRows.length} torrent rows`);

    const torrents: Torrent[] = [];
    torrentRows.each((idx, row) => {
      const torrent = parseTorrentRow(row, $);
      if (torrent) {
        torrents.push(torrent);
      } else {
        console.log(`[MainPage] Failed to parse row ${idx}`);
      }
    });

    console.log(`[MainPage] Parsed ${torrents.length} torrents`);
    return torrents.slice(0, 75);
  } catch (error) {
    console.error("[MainPage] Error:", error);
    return [];
  }
}
