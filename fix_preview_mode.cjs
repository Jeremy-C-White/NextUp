const fs = require('fs');

// 1. Update App.tsx
let codeApp = fs.readFileSync('src/App.tsx', 'utf8');

if (!codeApp.includes('const [previewSource, setPreviewSource] = useState<Show | null>(null);')) {
  codeApp = codeApp.replace(
    'const [addingShowId, setAddingShowId] = useState<number | null>(null);',
    'const [addingShowId, setAddingShowId] = useState<number | null>(null);\n  const [previewSource, setPreviewSource] = useState<Show | null>(null);'
  );
}

// In Discover card onClick
const oldOnClick = `onClick={() => {
                                const userShow = shows.find(s => s.tvmazeId === show.id || (s.imdbId && show.externals?.imdb && s.imdbId === show.externals.imdb));
                                setDetailsShow(userShow || {
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
const newOnClick = `onClick={() => {
                                const userShow = shows.find(s => s.tvmazeId === show.id || (s.imdbId && show.externals?.imdb && s.imdbId === show.externals.imdb));
                                if (!userShow) setPreviewSource(show);
                                setDetailsShow(userShow || {
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
codeApp = codeApp.replace(oldOnClick, newOnClick);
codeApp = codeApp.replace(oldOnClick, newOnClick); // Replace in all instances (For You, Trending, etc if they use a shared loop or duplicated?)
// Actually it's inside a loop section.shows.map so one replacement should be enough if there's only one.

// DetailsModal props
const oldModalProps = `<DetailsModal
          key={detailsShow.id}
          show={detailsShow}
          episodes={episodesMap[detailsShow.id] || []}
          isOpen={!!detailsShow}
          onClose={() => setDetailsShow(null)}
          onRemove={handleRemoveShow}
          onToggleWatched={(epId, watched) => handleToggleWatched(detailsShow.id, detailsShow.tvmazeId, epId, watched)}
          onMarkThrough={(epIds) => handleMarkThrough(detailsShow.id, detailsShow.tvmazeId, epIds)}
        />`;
const newModalProps = `<DetailsModal
          key={detailsShow.id}
          show={detailsShow}
          episodes={episodesMap[detailsShow.id] || []}
          isOpen={!!detailsShow}
          onClose={() => { setDetailsShow(null); setPreviewSource(null); }}
          onRemove={handleRemoveShow}
          onToggleWatched={(epId, watched) => handleToggleWatched(detailsShow.id, detailsShow.tvmazeId, epId, watched)}
          onMarkThrough={(epIds) => handleMarkThrough(detailsShow.id, detailsShow.tvmazeId, epIds)}
          inLibrary={shows.some(s => s.tvmazeId === detailsShow.tvmazeId || (!!s.imdbId && s.imdbId === detailsShow.imdbId))}
          onAdd={(caughtUp) => previewSource && handleAddShow(previewSource, caughtUp)}
          addingShowId={addingShowId}
        />`;
codeApp = codeApp.replace(oldModalProps, newModalProps);
fs.writeFileSync('src/App.tsx', codeApp);


// 2. Update DetailsModal.tsx
let codeDetails = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8');

// Add imports
codeDetails = codeDetails.replace(
  'import { getTMDBIdFromIMDB, getWatchProviders } from "../lib/tmdb";',
  'import { getTMDBIdFromIMDB, getWatchProviders } from "../lib/tmdb";\nimport { resolveTVMazeShow, getShowEpisodes } from "../lib/tvmaze";'
);

// Add props
codeDetails = codeDetails.replace(
  '  onMarkThrough: (episodeIds: string[]) => void;\n}',
  '  onMarkThrough: (episodeIds: string[]) => void;\n  inLibrary?: boolean;\n  onAdd?: (caughtUp: boolean) => void;\n  addingShowId?: number | null;\n}'
);

codeDetails = codeDetails.replace(
  'export function DetailsModal({ show, episodes, isOpen, onClose, onRemove, onToggleWatched, onMarkThrough }: Props) {',
  'export function DetailsModal({ show, episodes, isOpen, onClose, onRemove, onToggleWatched, onMarkThrough, inLibrary, onAdd, addingShowId }: Props) {'
);

// Add state & effect for preview
const previewCode = `
  const [previewEps, setPreviewEps] = useState<UserEpisode[] | null>(null);
  const [epsLoading, setEpsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && inLibrary === false && episodes.length === 0) {
      setEpsLoading(true);
      resolveTVMazeShow({ id: show.tvmazeId, name: show.name, externals: { imdb: show.imdbId } } as any)
        .then(resolved => getShowEpisodes(resolved.id))
        .then(eps => {
          setPreviewEps(eps.map(e => ({
            id: e.id,
            season: e.season,
            number: e.number,
            name: e.name,
            airstamp: e.airstamp,
            airdate: e.airdate,
            summary: e.summary,
            watched: false
          })));
        })
        .catch(() => setPreviewEps([]))
        .finally(() => setEpsLoading(false));
    }
  }, [isOpen, inLibrary, show.tvmazeId, show.name, show.imdbId, episodes.length]);

  const displayEpisodes = inLibrary !== false ? episodes : (previewEps ?? []);
  
  const seasons = Array.from(new Set(displayEpisodes.map(e => e.season))).sort((a, b) => b - a);
  const filteredEpisodes = displayEpisodes.filter(e => {
    if (seasonFilter === "all") return true;
    return e.season.toString() === seasonFilter;
  });
`;

codeDetails = codeDetails.replace(
  /  const seasons = Array\.from\(new Set\(episodes\.map\(e => e\.season\)\)\)\.sort\(\(a, b\) => b - a\);\n  const filteredEpisodes = episodes\.filter\(e => \{\n    if \(seasonFilter === "all"\) return true;\n    return e\.season\.toString\(\) === seasonFilter;\n  \}\);/,
  previewCode
);

// Replace "Remove Series" with dynamic buttons
const removeSeriesCode = `<button 
                onClick={handleRemove}
                className="w-full py-2 px-4 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/10 transition-colors text-base font-bold flex items-center justify-center gap-2 mt-8"
              >
                <Trash2 className="w-4 h-4" />
                Remove Series
              </button>`;
const dynamicButtons = `{inLibrary !== false ? (
                <button 
                  onClick={handleRemove}
                  className="w-full py-2 px-4 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/10 transition-colors text-base font-bold flex items-center justify-center gap-2 mt-8"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove Series
                </button>
              ) : (
                <div className="flex flex-col gap-2 mt-8">
                  <button 
                    onClick={() => onAdd?.(true)}
                    disabled={addingShowId === show.tvmazeId}
                    className="w-full py-2 px-4 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors text-base font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {addingShowId === show.tvmazeId ? "Adding..." : "Caught Up"}
                  </button>
                  <button 
                    onClick={() => onAdd?.(false)}
                    disabled={addingShowId === show.tvmazeId}
                    className="w-full py-2 px-4 bg-orange-500 text-orange-950 rounded-xl hover:bg-orange-400 transition-colors text-base font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {addingShowId === show.tvmazeId ? "Adding..." : "+ Add to Library"}
                  </button>
                </div>
              )}`;
codeDetails = codeDetails.replace(removeSeriesCode, dynamicButtons);

// Episodes list rendering (add skeleton loading, hide checkboxes when not in library)
// Mark Season Watched
codeDetails = codeDetails.replace(
  '{seasonFilter !== "all" && filteredEpisodes.some(e => !e.watched && e.airstamp && new Date(e.airstamp) <= new Date()) && (',
  '{inLibrary !== false && seasonFilter !== "all" && filteredEpisodes.some(e => !e.watched && e.airstamp && new Date(e.airstamp) <= new Date()) && ('
);

// Map eps
const mapEpsCode = `{filteredEpisodes.map((ep, index) => {`;
const newMapEpsCode = `{epsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-4 p-3 rounded-xl border bg-slate-800/30 border-slate-700/50 animate-pulse">
                    <div className="w-12 h-12 bg-slate-700/50 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-4 bg-slate-700/50 rounded w-1/3" />
                      <div className="h-3 bg-slate-700/50 rounded w-1/4" />
                    </div>
                  </div>
                ))
              ) : inLibrary === false && previewEps?.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p>Episode list unavailable.</p>
                  <a 
                    href={\`https://web.stremio.com/#/search?search=\${encodeURIComponent(show.name)}\`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 mt-2"
                  >
                    Search on Stremio <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ) : filteredEpisodes.map((ep, index) => {`;
codeDetails = codeDetails.replace(mapEpsCode, newMapEpsCode);

// Add mobile buttons at the bottom of the list for preview mode
const closeEpisodesList = `              })}`;
const newCloseEpisodesList = `              })}`;
// Wait, map is closed. Then I can just add it before the end of the container.
const endOfEpisodesList = `              })}
            </div>`;
const newEndOfEpisodesList = `              })}
            </div>
            {inLibrary === false && previewEps && previewEps.length > 0 && (
              <div className="p-4 border-t border-slate-800 bg-slate-900/90 backdrop-blur shrink-0 md:hidden flex gap-2">
                <button 
                  onClick={() => onAdd?.(true)}
                  disabled={addingShowId === show.tvmazeId}
                  className="flex-1 py-2 px-4 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {addingShowId === show.tvmazeId ? "Adding..." : "Caught Up"}
                </button>
                <button 
                  onClick={() => onAdd?.(false)}
                  disabled={addingShowId === show.tvmazeId}
                  className="flex-1 py-2 px-4 bg-orange-500 text-orange-950 rounded-xl hover:bg-orange-400 transition-colors text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {addingShowId === show.tvmazeId ? "Adding..." : "+ Add"}
                </button>
              </div>
            )}`;
codeDetails = codeDetails.replace(endOfEpisodesList, newEndOfEpisodesList);

// Checkbox and mark through
codeDetails = codeDetails.replace(
  '{!ep.watched && (\n                          <button \n                            onClick={() => handleMarkThrough(ep.id)}',
  '{inLibrary !== false && !ep.watched && (\n                          <button \n                            onClick={() => handleMarkThrough(ep.id)}'
);
codeDetails = codeDetails.replace(
  '<button \n                          onClick={() => handleToggleWatched(ep.id, ep.watched)}\n                          className={`p-3 rounded-xl transition-colors ${ep.watched ? \'text-green-500 bg-green-500/10\' : \'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 active:scale-95 touch-manipulation\'}`}\n                        >\n                          <CheckCircle2 className="w-5 h-5" />\n                        </button>',
  '{inLibrary !== false && (\n                          <button \n                            onClick={() => handleToggleWatched(ep.id, ep.watched)}\n                            className={`p-3 rounded-xl transition-colors ${ep.watched ? \'text-green-500 bg-green-500/10\' : \'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 active:scale-95 touch-manipulation\'}`}\n                          >\n                            <CheckCircle2 className="w-5 h-5" />\n                          </button>\n                        )}'
);

fs.writeFileSync('src/components/DetailsModal.tsx', codeDetails);

