const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// The discover section has `section.shows.map((show) => {`. We need to replace the `onClick={() => setDetailsShow(show)}` inside there.
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

// We need to update handleAddShow
content = content.replace(
  /const handleAddShow = async \(show: Show\) => \{[\s\S]*?setIsSearchOpen\(false\);\n    \} catch \(err: any\) \{/,
  `const handleAddShow = async (show: Show) => {
    try {
      setAppError(null);
      const { userShow, userEpisodes } = await addShowToLibrary(show);
      setShows(prev => [...prev, userShow]);
      setEpisodesMap(prev => ({ ...prev, [userShow.id]: userEpisodes }));
      setIsSearchOpen(false);
    } catch (err: any) {`
);

// We need to remove fetchLibrary from onUpdate and use optimistic updates.
// Inside App.tsx we need to define the handlers.
content = content.replace(
  /const handleMarkWatched = async \(showId: number, epId: string, watched: boolean\) => \{[\s\S]*?\};\n/,
  `const handleToggleWatched = (epId: string, watched: boolean) => {
    if (!detailsShow) return;
    setEpisodesMap(prev => {
      const eps = prev[detailsShow.id] || [];
      return {
        ...prev,
        [detailsShow.id]: eps.map(e => e.id === epId ? { ...e, watched } : e)
      };
    });
    markEpisodeWatched(detailsShow.tvmazeId, epId, watched).catch(console.error);
  };

  const handleMarkThrough = (epIds: string[]) => {
    if (!detailsShow) return;
    setEpisodesMap(prev => {
      const eps = prev[detailsShow.id] || [];
      return {
        ...prev,
        [detailsShow.id]: eps.map(e => epIds.includes(e.id) ? { ...e, watched: true } : e)
      };
    });
    import('./lib/library').then(m => m.markEpisodesWatchedBatch(detailsShow.tvmazeId, epIds, true)).catch(console.error);
  };

  const handleRemoveShow = () => {
    if (!detailsShow) return;
    setShows(prev => prev.filter(s => s.id !== detailsShow.id));
    setDetailsShow(null);
    import('./lib/library').then(m => m.removeShowFromLibrary(detailsShow.tvmazeId)).catch(console.error);
  };\n`
);

// Update DetailsModal props
content = content.replace(
  /<DetailsModal\s+show=\{detailsShow\}[\s\S]*?onUpdate=\{fetchLibrary\}\s+\/>/,
  `<DetailsModal
          show={detailsShow}
          episodes={episodesMap[detailsShow.id] || []}
          isOpen={!!detailsShow}
          onClose={() => setDetailsShow(null)}
          onRemove={handleRemoveShow}
          onToggleWatched={handleToggleWatched}
          onMarkThrough={handleMarkThrough}
        />`
);

fs.writeFileSync('src/App.tsx', content);
