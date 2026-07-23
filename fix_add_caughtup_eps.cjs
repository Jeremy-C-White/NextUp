const fs = require('fs');
let code = fs.readFileSync('src/lib/library.ts', 'utf8');

const regex = /const userEpisodes: UserEpisode\[\] = episodes\.map\(ep => \(\{\n    id: ep\.id\.toString\(\),\n    showId,\n    season: ep\.season,\n    number: ep\.number,\n    name: ep\.name,\n    airdate: ep\.airdate,\n    airstamp: ep\.airstamp,\n    imageUrl: ep\.image\?\.medium \|\| ep\.image\?\.original \|\| "",\n    summary: ep\.summary \? ep\.summary\.replace\(\/<\[\^>\]\+>\/g, ''\) : "",\n    watched: false\n  \}\)\);/g;

code = code.replace(regex, `const userEpisodes: UserEpisode[] = episodes.map(ep => {
    const isWatched = caughtUp && ep.airstamp && new Date(ep.airstamp) < new Date();
    return {
      id: ep.id.toString(),
      showId,
      season: ep.season,
      number: ep.number,
      name: ep.name,
      airdate: ep.airdate,
      airstamp: ep.airstamp,
      imageUrl: ep.image?.medium || ep.image?.original || "",
      summary: ep.summary ? ep.summary.replace(/<[^>]+>/g, '') : "",
      watched: !!isWatched,
      watchedAt: isWatched ? Date.now() : undefined
    };
  });`);

fs.writeFileSync('src/lib/library.ts', code);
