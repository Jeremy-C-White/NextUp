const fs = require('fs');
let code = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8');

code = code.replace(
  'import { resolveTVMazeShow, getShowEpisodes } from "../lib/tvmaze";',
  'import { resolveTVMazeShow, getEpisodes } from "../lib/tvmaze";'
);

code = code.replace(
  '.then(resolved => getShowEpisodes(resolved.id))',
  '.then(resolved => getEpisodes(resolved.id))'
);

const oldMap = `setPreviewEps(eps.map(e => ({
            id: e.id,
            season: e.season,
            number: e.number,
            name: e.name,
            airstamp: e.airstamp,
            airdate: e.airdate,
            summary: e.summary,
            watched: false
          })));`;
const newMap = `setPreviewEps(eps.map(e => ({
            id: String(e.id),
            showId: show.tvmazeId,
            season: e.season,
            number: e.number,
            name: e.name,
            airdate: e.airdate || "",
            airstamp: e.airstamp || "",
            imageUrl: e.image?.medium || "",
            summary: e.summary || "",
            watched: false
          })));`;
code = code.replace(oldMap, newMap);

code = code.replace(
  'const seasons = Array.from(new Set(displayEpisodes.map(e => e.season))).sort((a, b) => b - a);',
  'const seasons = Array.from(new Set(displayEpisodes.map(e => Number(e.season)))).sort((a, b) => b - a);'
);

fs.writeFileSync('src/components/DetailsModal.tsx', code);
