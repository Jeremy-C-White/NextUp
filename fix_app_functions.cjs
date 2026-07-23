const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /const handleToggleWatched = \(epId: string, watched: boolean\) => \{[\s\S]*?markEpisodeWatched\(detailsShow\.tvmazeId, epId, watched\)\.catch\(console\.error\);\n  \};/,
  `const handleToggleWatched = (showId: string, tvmazeId: number, epId: string, watched: boolean) => {
    setEpisodesMap(prev => {
      const eps = prev[showId] || [];
      return {
        ...prev,
        [showId]: eps.map(e => e.id === epId ? { ...e, watched } : e)
      };
    });
    markEpisodeWatched(tvmazeId, epId, watched).catch(console.error);
  };`
);

content = content.replace(
  /const handleMarkThrough = \(epIds: string\[\]\) => \{[\s\S]*?markEpisodesWatchedBatch\(detailsShow\.tvmazeId, epIds, true\)\.catch\(console\.error\);\n  \};/,
  `const handleMarkThrough = (showId: string, tvmazeId: number, epIds: string[]) => {
    setEpisodesMap(prev => {
      const eps = prev[showId] || [];
      return {
        ...prev,
        [showId]: eps.map(e => epIds.includes(e.id) ? { ...e, watched: true } : e)
      };
    });
    markEpisodesWatchedBatch(tvmazeId, epIds, true).catch(console.error);
  };`
);

content = content.replace(
  'onToggleWatched={handleToggleWatched}',
  'onToggleWatched={(epId, watched) => handleToggleWatched(detailsShow.id, detailsShow.tvmazeId, epId, watched)}'
);

content = content.replace(
  'onMarkThrough={handleMarkThrough}',
  'onMarkThrough={(epIds) => handleMarkThrough(detailsShow.id, detailsShow.tvmazeId, epIds)}'
);

content = content.replace(
  'onClick={() => handleMarkWatched(show.tvmazeId, nextEp.id, true)}',
  'onClick={(e) => { e.stopPropagation(); handleToggleWatched(show.id, show.tvmazeId, nextEp.id, true); }}'
);

fs.writeFileSync('src/App.tsx', content);
