export interface IntroDBSegment {
  segment_type: "intro" | "outro" | "recap";
  start_sec: number;
  end_sec: number;
}

export async function getIntroDBSegments(imdbId: string, season: number, episode: number): Promise<IntroDBSegment[]> {
  try {
    const res = await fetch(`/api/introdb?imdb_id=${imdbId}&season=${season}&episode=${episode}`);
    if (!res.ok) return [];
    const data = await res.json();
    
    if (Array.isArray(data)) return data; // just in case
    
    const segments: IntroDBSegment[] = [];
    if (data.intro) segments.push({ segment_type: "intro", start_sec: data.intro.start_sec, end_sec: data.intro.end_sec });
    if (data.outro) segments.push({ segment_type: "outro", start_sec: data.outro.start_sec, end_sec: data.outro.end_sec });
    if (data.recap) segments.push({ segment_type: "recap", start_sec: data.recap.start_sec, end_sec: data.recap.end_sec });
    
    return segments;
  } catch (err) {
    console.error("Failed to fetch IntroDB segments:", err);
    return [];
  }
}
