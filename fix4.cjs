const fs = require('fs');
let lines = fs.readFileSync('src/components/VideoPlayerModal.tsx', 'utf8').split('\n');

const resolveIndex = lines.findIndex(l => l.includes('const handleExternalPlay = (url: string) => {'));

const resolveCode = `
  useEffect(() => {
    async function resolvePlayback() {
      if (!request.imdbId || request.imdbId === "none") {
        setHasError(true);
        setStatusText("No stream source available.");
        return;
      }
      
      try {
        setIsLoading(true);
        setHasError(false);
        setStatusText("Locating title...");
        
        const results = await getBestTorrentioStream(
          request.imdbId,
          request.season,
          request.number,
          request.isMovie ? "movie" : "series",
          undefined,
          resolutionAttempt > 0
        );
        
        if (results.length === 0) {
          setHasError(true);
          setStatusText("No streams found.");
          return;
        }
        
        setCandidates(results);
        setCandidateIndex(0);
        
        const mp4s = results.filter(c => c.container === 'web-compatible');
        if (mp4s.length > 0) {
          setMode('mp4_play');
        } else {
          setMode('mkv_transition');
        }
      } catch (err: any) {
        setHasError(true);
        setStatusText(err.message || "Failed to find streams");
      }
    }
    resolvePlayback();
  }, [request, resolutionAttempt]);
`;

lines.splice(resolveIndex, 0, resolveCode.trim());
fs.writeFileSync('src/components/VideoPlayerModal.tsx', lines.join('\n'));
