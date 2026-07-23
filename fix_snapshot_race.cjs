const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('import { useEffect, useState, lazy, Suspense, useMemo, useRef }')) {
    code = code.replace('useMemo } from "react";', 'useMemo, useRef } from "react";');
}

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

const newSnapshot = `    const generationRef = { current: 0 };
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

code = code.replace(originalSnapshot, newSnapshot);
fs.writeFileSync('src/App.tsx', code);
