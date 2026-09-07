const fs = require('fs');
let code = fs.readFileSync('src/lib/debrid.ts', 'utf8');

const langDetectionCode = `
export function detectAudioLanguage(stream: StreamOption): 'english' | 'multi' | 'non-english' | 'unknown' {
  const text = getCombinedStreamText(stream).toLowerCase();
  
  const multiTags = /\\b(dual[- ]?audio|multi|multi[- ]?audio)\\b/;
  const engTags = /\\b(eng|english|en)\\b/;
  // Include common foreign tags, avoiding short ambiguous ones unless necessary
  const foreignTags = /\\b(fre|french|ita|italian|spa|spanish|ger|german|rus|russian|hin|hindi|tam|tamil|tel|telugu|jap|japanese|kor|korean|chi|chinese|por|portuguese|lat|latino|pol|polish|vostfr|vf|truefrench|dubbed|dub)\\b/;
  
  if (multiTags.test(text)) return 'multi';
  if (engTags.test(text) && foreignTags.test(text)) return 'multi'; // e.g. HIN-ENG
  if (engTags.test(text)) return 'english';
  if (foreignTags.test(text)) return 'non-english';
  
  return 'unknown';
}
`;

// Insert after parseStreamInfo or similar
if (!code.includes('detectAudioLanguage')) {
  code = code.replace('export function calculateStreamScore(', langDetectionCode + '\nexport function calculateStreamScore(');
}

// Update calculateStreamScore
if (!code.includes('const lang = detectAudioLanguage(stream);')) {
  const scoreInject = `
  const lang = detectAudioLanguage(stream);
  if (lang === 'english') {
    score += 250_000;
  } else if (lang === 'multi') {
    score += 100_000;
  } else if (lang === 'non-english') {
    score -= 750_000;
  }
`;
  code = code.replace('score -= getTrailerPenalty(stream, type);', 'score -= getTrailerPenalty(stream, type);' + scoreInject);
}

// Update getBestTorrentioStream to filter out non-english completely
// Look for const playbackCandidates: PlaybackCandidateInternal[] = streamsToProcess.map(...)
const filterInject = `
  const filteredStreams = streamsToProcess.filter(s => detectAudioLanguage(s) !== 'non-english');
  const finalStreamsToProcess = filteredStreams.length > 0 ? filteredStreams : streamsToProcess; // Fallback just in case? Prompt says completely filter. Let's just strictly filter.
  // Actually, prompt says completely filters out.
  const streamsToProcessForCandidates = streamsToProcess.filter(s => detectAudioLanguage(s) !== 'non-english');
`;

if (!code.includes('streamsToProcessForCandidates')) {
  code = code.replace(
    'const playbackCandidates: PlaybackCandidateInternal[] =\n    streamsToProcess.map',
    filterInject + '\n  const playbackCandidates: PlaybackCandidateInternal[] =\n    streamsToProcessForCandidates.map'
  );
  code = code.replace(
    'streamsToProcess.length,',
    'streamsToProcessForCandidates.length,'
  );
}

fs.writeFileSync('src/lib/debrid.ts', code);
