const fs = require('fs');
const code = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8');

const updated = code.replace(
  /const handlePlayEpisode = async \(episode: UserEpisode\) => \{[\s\S]*?setSelectedEpForStreams\(null\);\n    \}\n  \};/,
  `const handlePlayEpisode = async (episode: UserEpisode) => {
    if (onPlayEpisode) {
      onPlayEpisode(show.id, show.imdbId, episode);
    }
  };`
);

fs.writeFileSync('src/components/DetailsModal.tsx', updated);
