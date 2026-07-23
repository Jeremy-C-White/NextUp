import { PlaybackCandidate } from "../types";

export interface StreamOption {
  name?: string;
  title?: string;
  description?: string;
  infoHash?: string;
  fileIdx?: number;
  url?: string;
  subtitles?: Array<{
    id?: string;
    url: string;
    lang?: string;
  }>;
  behaviorHints?: {
    videoSize?: number;
    filename?: string;
    notWebReady?: boolean;
    bingeGroup?: string;
  };
}

function getStreamSizeGB(stream: StreamOption): number | null {
  const byteSize = stream.behaviorHints?.videoSize;
  if (typeof byteSize === "number" && byteSize > 0) {
    return byteSize / 1024 / 1024 / 1024;
  }
  const text = [
    stream.behaviorHints?.filename,
    stream.description,
    stream.title,
    stream.name
  ].filter(Boolean).join(" ");
  const match = text.match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
  if (!match) return null;
  const amount = Number.parseFloat(match[1]);
  return match[2].toUpperCase() === "GB" ? amount : amount / 1024;
}

function getStreamSeeders(stream: StreamOption): number {
  const text = [
    stream.description,
    stream.title,
    stream.name
  ].filter(Boolean).join(" ");
  // Look for the user/seeders emoji 👤 followed by numbers
  const emojiMatch = text.match(/👤\s*(\d+)/);
  if (emojiMatch) {
    return parseInt(emojiMatch[1], 10);
  }
  // Look for seeders word or seeds word
  const wordMatch = text.match(/(?:seeders|seeds|seed):\s*(\d+)/i);
  if (wordMatch) {
    return parseInt(wordMatch[1], 10);
  }
  return 0;
}

function isBrowserPlaybackCandidate(stream: StreamOption): boolean {
  if (!stream.url?.startsWith("https://")) return false;
  if (stream.behaviorHints?.notWebReady === true) return false;

  const text = [
    stream.behaviorHints?.filename,
    stream.description,
    stream.title,
    stream.name,
    stream.url
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    text.includes(".mp4") ||
    text.includes(".m4v") ||
    text.includes(".webm") ||
    text.includes(".mp4?") ||
    text.includes(".m4v?") ||
    text.includes(".webm?")
  );
}

export async function getBestTorrentioStream(imdbId: string, season: number, episode: number, type: 'series' | 'movie' = 'series'): Promise<PlaybackCandidate[]> {
  if (type === 'series') {
    if (!Number.isInteger(season) || !Number.isInteger(episode) || season < 1 || episode < 1) {
      throw new Error("INVALID_EPISODE_MAPPING");
    }
  }

  const envToken = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env.VITE_REALDEBRID_API_TOKEN : undefined;
  const localToken = typeof window !== 'undefined' ? localStorage.getItem('REALDEBRID_API_TOKEN') : undefined;
  const cleanToken = (localToken || envToken)?.trim();
  
  if (!cleanToken) {
    throw new Error("Please add your Real-Debrid API Token in Settings to stream videos.");
  }

  if (!/^tt\d+$/.test(imdbId)) {
    throw new Error(type === "movie" ? "This movie does not have a valid IMDb identifier." : "This series does not have a valid IMDb identifier.");
  }

  const config = `sort=qualityseeders|realdebrid=${encodeURIComponent(cleanToken)}`;
  
  // Implement timeout and abort controller
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

  let response;
  try {
    response = await fetch(`https://torrentio.strem.fun/${config}/stream/${type}/${type === 'movie' ? imdbId : `${imdbId}:${season}:${episode}`}.json`, {
      signal: controller.signal
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error("Stream resolution timed out.");
    }
    throw new Error("Network error or CORS issue reaching Torrentio.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Invalid Real-Debrid API Token. Please update it in Settings.");
    }
    if (response.status === 403) {
      throw new Error("Torrentio/Real-Debrid blocked the request (403 Forbidden). Ensure your token is valid.");
    }
    throw new Error(`Torrentio returned an error (${response.status}).`);
  }

  const data: unknown = await response.json();

  if (
    !data ||
    typeof data !== "object" ||
    !Array.isArray((data as { streams?: unknown }).streams)
  ) {
    throw new Error("Torrentio returned an invalid stream response.");
  }

  const streams = (data as { streams: StreamOption[] }).streams;

  if (streams.length === 0) {
    throw new Error(`No results returned for this ${type}.`);
  }

  // Deduplicate candidates
  const uniqueCandidates = Array.from(
    new Map(
      streams.map((stream) => [
        stream.url || `${stream.infoHash}:${stream.fileIdx ?? ""}`,
        stream
      ])
    ).values()
  );

  const candidates = uniqueCandidates.filter(
    (stream) => typeof stream.url === "string" && stream.url.startsWith("https://")
  );

  if (candidates.length === 0) {
    throw new Error(`Sources were found, but none contained a direct Real-Debrid stream.`);
  }
  
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const playbackCandidates: PlaybackCandidate[] = candidates.map((stream, index) => {
    const text = [
      stream.behaviorHints?.filename,
      stream.description,
      stream.title,
      stream.name,
      stream.url
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const seedersCount = getStreamSeeders(stream);
    const browserEligible = isBrowserPlaybackCandidate(stream);
    
    // Start with a base score derived from Torrentio's initial rank
    let score = (candidates.length - index) * 100;
    
    if (browserEligible) score += 10_000;
    
    if (text.includes("2160p") || text.includes("4k")) {
       score += isMobile ? 50 : 400; // Prefer 4K less on mobile
    } else if (text.includes("1080p")) {
       score += 300;
    } else if (text.includes("720p")) {
       score += 200;
    } else if (text.includes("480p")) {
       score += 50;
    }

    if (text.includes("cam") || text.includes("telesync")) score -= 10_000;
    if (text.includes("scr") || text.includes("screener")) score -= 5_000;

    score += Math.min(seedersCount, 500);
    
    return {
      id: stream.infoHash || stream.url || `candidate-${index}`,
      url: stream.url as string,
      title: stream.title || stream.name,
      quality: stream.name,
      sizeBytes: stream.behaviorHints?.videoSize,
      container: browserEligible ? "web-compatible" : "external",
      score,
      seeders: seedersCount
    };
  });

  playbackCandidates.sort((a, b) => b.score - a.score);

  return playbackCandidates;
}

export function openExternalPlayer(directStreamUrl: string) {
  const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(navigator.userAgent);

  if (isIOS) {
    const vlcUrl = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(directStreamUrl)}`;
    window.location.href = vlcUrl;
  } else if (isAndroid) {
    const vlcUrl = `vlc://${directStreamUrl}`;
    window.location.href = vlcUrl;
  } else {
    // Desktop opens the stream URL in a new browser tab.
    window.open(directStreamUrl, '_blank');
  }
}
