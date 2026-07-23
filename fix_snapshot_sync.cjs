const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const originalSnapshot = `    const generationRef = { current: 0 };
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
        // Use functional state update to always have latest map
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
              results.forEach(r => {
                if (r.status === 'rejected') console.error("Failed fetching episodes", r.reason);
              });
            });
          }

          return newEpsMap;
        });

      } catch (e: any) {
        console.error(e);
        setAppError("Fetch Error: " + e.message);
      }
    });`;

code = code.replace(originalSnapshot, newSnapshot);

if (!code.includes('const generationRef = useRef(0);')) {
    code = code.replace(
      'const [appError, setAppError] = useState<string | null>(null);',
      'const [appError, setAppError] = useState<string | null>(null);\n  const generationRef = useRef(0);'
    );
}

fs.writeFileSync('src/App.tsx', code);
