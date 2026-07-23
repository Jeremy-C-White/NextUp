const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const originalSnapshot = `    return onSnapshot(q, async (snapshot) => {
      try {
        const userShows = snapshot.docs.map(d => d.data() as UserShow);
        setShows(userShows);
        const eps: Record<string, UserEpisode[]> = {};
        const results = await Promise.allSettled(userShows.map(async (show) => {
          const id = show.tvmazeId || parseInt(show.id, 10);
          eps[show.id] = await getShowEpisodes(id, show.watchedEpisodes || {});
        }));
        results.forEach(r => {
          if (r.status === 'rejected') console.error("Failed fetching episodes", r.reason);
        });
        setEpisodesMap(eps);
      } catch (e: any) {
        console.error(e);
        setAppError("Fetch Error: " + e.message);
      }
    });`;

const originalSnapshot2 = `    const generationRef = { current: 0 };
    return onSnapshot(q, async (snapshot) => {
      const currentGen = ++generationRef.current;
      try {
        const userShows = snapshot.docs.map(d => d.data() as UserShow);
        setShows(userShows);
        
        const eps: Record<string, UserEpisode[]> = {};
        const results = await Promise.allSettled(userShows.map(async (show) => {
          const id = show.tvmazeId || parseInt(show.id, 10);
          eps[show.id] = await getShowEpisodes(id, show.watchedEpisodes || {});
        }));
        
        if (currentGen !== generationRef.current) return;
        
        results.forEach(r => {
          if (r.status === 'rejected') console.error("Failed fetching episodes", r.reason);
        });
        setEpisodesMap(eps);
      } catch (e: any) {
        if (currentGen !== generationRef.current) return;
        console.error(e);
        setAppError("Fetch Error: " + e.message);
      }
    });`;

const newSnapshot = `    return onSnapshot(q, async (snapshot) => {
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
            Promise.allSettled(asyncTasks).then(results => {
              if (currentGen !== generationRef.current) return;
              results.forEach(r => {
                if (r.status === 'rejected') console.error("Failed fetching episodes", r.reason);
              });
            });
          }

          return newEpsMap;
        });

      } catch (e: any) {
        if (currentGen !== generationRef.current) return;
        console.error(e);
        setAppError("Fetch Error: " + e.message);
      }
    });`;

let matched = false;
if (code.includes(originalSnapshot)) {
  code = code.replace(originalSnapshot, newSnapshot);
  matched = true;
} else if (code.includes(originalSnapshot2)) {
  code = code.replace(originalSnapshot2, newSnapshot);
  matched = true;
} else {
  console.log("Could not find snapshot block");
}

if (matched) {
  fs.writeFileSync('src/App.tsx', code);
  console.log("Updated snapshot block");
}

