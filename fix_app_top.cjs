const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

const lines = app.split('\n');
const firstLine = lines[0];

// The first line has all imports jammed together.
// Let's replace the first line entirely with proper imports.
const newImports = `import { useEffect, useState, lazy, Suspense, useMemo } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, onSnapshot, query } from "firebase/firestore";
import { auth, db } from "./firebase";
import { AuthScreen } from "./components/AuthScreen";
const SearchModal = lazy(() => import("./components/SearchModal").then(module => ({ default: module.SearchModal })));
const DetailsModal = lazy(() => import("./components/DetailsModal").then(module => ({ default: module.DetailsModal })));
import { UserShow, Show, UserEpisode } from "./types";
import { addShowToLibrary, getShowEpisodes, markEpisodeWatched, markEpisodesWatchedBatch, removeShowFromLibrary } from "./lib/library";
import { getTrendingShows, getPremieringSoon, getHiddenGems, getForYou } from "./lib/tvmaze";
import { Tv, Search, LogOut, CheckCircle2, PlayCircle, Clock, ExternalLink, Compass } from "lucide-react";
import { format, isPast, isFuture } from "date-fns";
function getStremioLink(imdbId: string | undefined, showName: string, episode?: UserEpisode) {`;

// the previous first line ended with:
// function getStremioLink(imdbId: string | undefined, showName: string, episode?: UserEpisode) {

if (firstLine.includes("function getStremioLink")) {
  lines[0] = newImports;
}

fs.writeFileSync('src/App.tsx', lines.join('\n'));
