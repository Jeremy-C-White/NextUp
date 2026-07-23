const fs = require('fs');
let codeApp = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /onClick=\{\(\) => \{\s+const userShow = shows\.find\(s => s\.tvmazeId === show\.id\) \|\| \{\s+id: show\.id\.toString\(\),\s+tvmazeId: show\.id,\s+name: show\.name,\s+imageUrl: show\.image\?\.medium \|\| show\.image\?\.original \|\| "",\s+status: show\.status \|\| "Unknown",\s+provider: show\.webChannel\?\.name \|\| show\.network\?\.name \|\| "Unknown Provider",\s+addedAt: Date\.now\(\),\s+summary: show\.summary \? show\.summary\.replace\(\/<\[\^>\]\+>\/g, ""\) : "",\s+imdbId: show\.externals\?\.imdb \|\| ""\s+\};\s+setDetailsShow\(userShow\);\s+\}\}/g;

const replacement = `onClick={() => {
                                const owned = shows.find(s => s.tvmazeId === show.id || (s.imdbId && show.externals?.imdb && s.imdbId === show.externals.imdb));
                                setPreviewSource(owned ? null : show);
                                setDetailsShow(owned || {
                                  id: show.id.toString(),
                                  tvmazeId: show.id,
                                  name: show.name,
                                  imageUrl: show.image?.medium || show.image?.original || "",
                                  status: show.status || "Unknown",
                                  provider: show.webChannel?.name || show.network?.name || "Unknown Provider",
                                  addedAt: Date.now(),
                                  summary: show.summary ? show.summary.replace(/<[^>]+>/g, "") : "",
                                  imdbId: show.externals?.imdb || ""
                                });
                              }}`;

codeApp = codeApp.replace(regex, replacement);

const modalPropsRegex = /onAdd=\{\(caughtUp\) => previewSource && handleAddShow\(previewSource, caughtUp\)\}/g;
const modalPropsReplacement = `onAdd={(caughtUp) => {
            if (previewSource) {
              handleAddShow(previewSource, caughtUp);
              setDetailsShow(null);
              setPreviewSource(null);
            }
          }}`;

codeApp = codeApp.replace(modalPropsRegex, modalPropsReplacement);

fs.writeFileSync('src/App.tsx', codeApp);
