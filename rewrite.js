const fs = require('fs');
let code = fs.readFileSync('src/lib/debrid.ts', 'utf8');

const target = `  if (candidates.length === 0) {
    throw new Error("Results were found, but none contained a direct Real-Debrid stream.");
  }`;

const replacement = `  if (candidates.length === 0) {
    throw new Error("Results were found, but none contained a direct Real-Debrid stream.");
  }

  // Parse sizes (in GB) from the stream title to avoid excessively large files
  candidates.forEach((stream: StreamOption) => {
    let sizeGB = 0;
    if (stream.title) {
      const match = stream.title.match(/(\\d+(?:\\.\\d+)?)\\s*(GB|MB)/i);
      if (match) {
        const val = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        sizeGB = unit === 'GB' ? val : val / 1024;
      }
    }
    (stream as any)._parsedSizeGB = sizeGB;
  });

  // Filter out massive files (e.g., > 3GB for episodes, > 10GB for movies)
  // We can dial this in to get the best quality without being huge.
  const maxSizeGB = type === 'movie' ? 10 : 3;
  let reasonableCandidates = candidates.filter((c: any) => c._parsedSizeGB === 0 || c._parsedSizeGB <= maxSizeGB);

  // If all are filtered out (unlikely but possible), fallback to original candidates
  if (reasonableCandidates.length === 0) {
    reasonableCandidates = candidates;
  }

  // Use the reasonableCandidates instead of raw candidates below`;

code = code.replace(target, replacement);

const target2 = `  candidates.sort((a: StreamOption, b: StreamOption) => {`;
const replacement2 = `  reasonableCandidates.sort((a: StreamOption, b: StreamOption) => {`;
code = code.replace(target2, replacement2);

const target3 = `  return candidates[0].url as string;`;
const replacement3 = `  return reasonableCandidates[0].url as string;`;
code = code.replace(target3, replacement3);

fs.writeFileSync('src/lib/debrid.ts', code);
