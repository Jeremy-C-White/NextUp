const fs = require('fs');

let codeApp = fs.readFileSync('src/App.tsx', 'utf8');

const targetAdded = `              asyncTasks.push((async () => {
                const id = show.tvmazeId || parseInt(show.id, 10);
                const eps = await getShowEpisodes(id, show.watchedEpisodes || {});
                setEpisodesMap(current => ({ ...current, [show.id]: eps }));
              })());`;

const replaceAdded = `              asyncTasks.push((async () => {
                const id = show.tvmazeId || parseInt(show.id, 10);
                const eps = await getShowEpisodes(id, show.watchedEpisodes || {});
                setEpisodesMap(current => ({ ...current, [show.id]: eps }));
                
                const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
                if (!show.lastRefreshed || Date.now() - show.lastRefreshed > SEVEN_DAYS) {
                  try {
                    const freshShow = await resolveTVMazeShow({ id } as any);
                    await setDoc(change.doc.ref, { 
                      status: freshShow.status || show.status,
                      imdbId: freshShow.externals?.imdb || show.imdbId || "",
                      genres: freshShow.genres || show.genres || [],
                      officialSite: freshShow.officialSite || show.officialSite || "",
                      lastRefreshed: Date.now()
                    }, { merge: true });
                  } catch (e) {
                    console.error("Failed to refresh show", e);
                  }
                }
              })());`;

codeApp = codeApp.replace(targetAdded, replaceAdded);

// It also has a 'modified' branch that does the same eps fetch but we only want to refresh on startup ('added' for the first sync) or maybe 'modified' too?
// Actually if they modify it, it could trigger another refresh if it hasn't been refreshed. Let's just do it on 'added' (initial load).
fs.writeFileSync('src/App.tsx', codeApp);

let codeApplet = fs.readFileSync('src/types.ts', 'utf8');
codeApplet = codeApplet.replace('  watchedEpisodes?: Record<string, number | null>;', '  watchedEpisodes?: Record<string, number | null>;\n  lastRefreshed?: number;');
fs.writeFileSync('src/types.ts', codeApplet);

let codeLib = fs.readFileSync('src/lib/library.ts', 'utf8');
codeLib = codeLib.replace('    watchedEpisodes\n  };\n', '    watchedEpisodes,\n    lastRefreshed: Date.now()\n  };\n');
fs.writeFileSync('src/lib/library.ts', codeLib);

