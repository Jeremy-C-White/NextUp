const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const handleToggleWatched = \(showId: string, tvmazeId: number, epId: string, watched: boolean\) => \{([\s\S]*?)markEpisodeWatched\(tvmazeId, epId, watched\)\.catch\(console\.error\);\n\s*\};/;
const repl = `const handleToggleWatched = (showId: string, tvmazeId: number, epId: string, watched: boolean) => {$1markEpisodeWatched(tvmazeId, epId, watched).catch(console.error);
    if (watched) setToast({ message: 'Marked episode watched' });
  };`;

code = code.replace(regex, repl);

const regex2 = /const handleMarkThrough = async \(showId: string, tvmazeId: number, epIds: string\[\]\) => \{([\s\S]*?)await markEpisodesWatchedBatch\(tvmazeId, epIds\);([\s\S]*?)\};/;
const repl2 = `const handleMarkThrough = async (showId: string, tvmazeId: number, epIds: string[]) => {$1await markEpisodesWatchedBatch(tvmazeId, epIds);$2setToast({ message: \`Marked \${epIds.length} episodes watched\` });
  };`;
code = code.replace(regex2, repl2);

fs.writeFileSync('src/App.tsx', code);
