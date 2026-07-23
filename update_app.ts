const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Convert Show to UserShow for detailsShow
content = content.replace(
  'onClick={() => setDetailsShow(show)}',
  'onClick={() => {\n' +
  '                                const userShow = shows.find(s => s.tvmazeId === show.id) || {\n' +
  '                                  id: show.id.toString(),\n' +
  '                                  tvmazeId: show.id,\n' +
  '                                  name: show.name,\n' +
  '                                  imageUrl: show.image?.medium || show.image?.original || "",\n' +
  '                                  status: show.status || "Unknown",\n' +
  '                                  provider: show.webChannel?.name || show.network?.name || "Unknown Provider",\n' +
  '                                  addedAt: Date.now(),\n' +
  '                                  summary: show.summary ? show.summary.replace(/<[^>]+>/g, "") : "",\n' +
  '                                  imdbId: show.externals?.imdb || ""\n' +
  '                                };\n' +
  '                                setDetailsShow(userShow);\n' +
  '                              }}'
);

// We should also replace the others but they are already UserShows (in Up Next and Library). Wait, only the one in Discover section is a Show.
// Let's find exactly which one is in the Discover section. The one inside `section.shows.map((show) => { ... }` where `inLibrary` is checked.

fs.writeFileSync('src/App.tsx', content);
