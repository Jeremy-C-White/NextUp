const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `    return onSnapshot(q, async (snapshot) => {
      const currentGen = ++generationRef.current;
      try {
        const userShows = snapshot.docs.map(d => d.data() as UserShow);
        setShows(userShows);
        
        let hasAsyncWork = false;
        setEpisodesMap(prevEpsMap => {
          const newEpsMap = { ...prevEpsMap };
          const asyncTasks: Promise<void>[] = [];

          snapshot.docChanges().forEach(change => {
            const show = change.doc.data() as UserShow;
            if (change.type === 'added') {
              hasAsyncWork = true;
              asyncTasks.push((async () => {
                const id = show.tvmazeId || parseInt(show.id, 10);
                const eps = await getShowEpisodes(id, show.watchedEpisodes || {});
                setEpisodesMap(current => ({ ...current, [show.id]: eps }));
              })());
            } else if (change.type === 'modified') {
              const existingEps = newEpsMap[show.id];
              if (existingEps) {
                newEpsMap[show.id] = existingEps.map(ep => ({
                  ...ep,
                  watched: !!(show.watchedEpisodes && show.watchedEpisodes[ep.id]),
                  watchedAt: show.watchedEpisodes ? (show.watchedEpisodes[ep.id] || undefined) : undefined
                }));
              } else {
                hasAsyncWork = true;
                asyncTasks.push((async () => {
                  const id = show.tvmazeId || parseInt(show.id, 10);
                  const eps = await getShowEpisodes(id, show.watchedEpisodes || {});
                  setEpisodesMap(current => ({ ...current, [show.id]: eps }));
                })());
              }
            } else if (change.type === 'removed') {
              delete newEpsMap[show.id];
            }
          });
          
          if (hasAsyncWork) {
            Promise.all(asyncTasks).catch(err => {
              if (currentGen === generationRef.current) {
                console.error("Failed to load episodes in background", err);
              }
            });
          }
          return newEpsMap;
        });
      } catch (err) {
        console.error("Library error", err);
      }
    });`;

const replacement = `    return onSnapshot(q, async (snapshot) => {
      const currentGen = ++generationRef.current;
      try {
        const userShows = snapshot.docs.map(d => d.data() as UserShow);
        setShows(userShows);
        
        const asyncTasks: Array<{id: number, showId: string, watchedEpisodes: any}> = [];
        const modifications: Array<{show: UserShow}> = [];
        const removals: string[] = [];

        snapshot.docChanges().forEach(change => {
          const show = change.doc.data() as UserShow;
          if (change.type === 'added') {
            asyncTasks.push({ id: show.tvmazeId || parseInt(show.id, 10), showId: show.id, watchedEpisodes: show.watchedEpisodes || {} });
          } else if (change.type === 'modified') {
            modifications.push({ show });
          } else if (change.type === 'removed') {
            removals.push(show.id);
          }
        });
        
        setEpisodesMap(prevEpsMap => {
          const newEpsMap = { ...prevEpsMap };
          
          removals.forEach(id => { delete newEpsMap[id]; });
          
          modifications.forEach(({ show }) => {
            const existingEps = newEpsMap[show.id];
            if (existingEps) {
              newEpsMap[show.id] = existingEps.map(ep => ({
                ...ep,
                watched: !!(show.watchedEpisodes && show.watchedEpisodes[ep.id]),
                watchedAt: show.watchedEpisodes ? (show.watchedEpisodes[ep.id] || undefined) : undefined
              }));
            } else {
              asyncTasks.push({ id: show.tvmazeId || parseInt(show.id, 10), showId: show.id, watchedEpisodes: show.watchedEpisodes || {} });
            }
          });
          
          return newEpsMap;
        });
        
        if (asyncTasks.length > 0) {
          const promises = asyncTasks.map(async task => {
            const eps = await getShowEpisodes(task.id, task.watchedEpisodes);
            setEpisodesMap(current => ({ ...current, [task.showId]: eps }));
          });
          Promise.all(promises).catch(err => {
            if (currentGen === generationRef.current) {
              console.error("Failed to load episodes in background", err);
            }
          });
        }
      } catch (err) {
        console.error("Library error", err);
      }
    });`;

code = code.replace(target, replacement);
fs.writeFileSync('src/App.tsx', code);
