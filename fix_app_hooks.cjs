const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

const earlyReturns = `  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-orange-500">Loading NextUp...</div>;
  if (!user) return <AuthScreen />;`;

const useMemoBlock = `  const { upNext, comingSoon } = useMemo(() => {
    const upNextRaw = shows.map(show => {
      const eps = episodesMap[show.id] || [];
      const unwatched = eps.filter(e => !e.watched && (e.airstamp ? isPast(new Date(e.airstamp)) : true));
      return { show, nextEp: unwatched[0], progress: Math.round(((eps.length - unwatched.length) / Math.max(eps.length, 1)) * 100) };
    }).filter(s => s.nextEp);

    const comingSoonRaw = shows.map(show => {
      const eps = episodesMap[show.id] || [];
      const future = eps.filter(e => e.airstamp && isFuture(new Date(e.airstamp)));
      return { show, nextEp: future[0] };
    }).filter(s => s.nextEp).sort((a, b) => new Date(a.nextEp.airstamp).getTime() - new Date(b.nextEp.airstamp).getTime());
    
    return { upNext: upNextRaw, comingSoon: comingSoonRaw };
  }, [shows, episodesMap]);`;

if (app.includes(earlyReturns) && app.includes(useMemoBlock)) {
    // Remove both
    app = app.replace(earlyReturns + '\n\n' + useMemoBlock, useMemoBlock + '\n\n' + earlyReturns);
    fs.writeFileSync('src/App.tsx', app);
    console.log("Hooks fixed.");
} else {
    console.log("Could not find exact blocks.");
}
