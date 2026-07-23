const fs = require('fs');
let codeApp = fs.readFileSync('src/App.tsx', 'utf8');

codeApp = codeApp.replace(
  'libraryIds={new Set(shows.map(s => parseInt(s.tvmazeId?.toString() || s.id, 10)))}',
  'libraryIds={new Set(shows.map(s => parseInt(s.tvmazeId?.toString() || s.id, 10)))}\n        libraryImdbs={new Set(shows.map(s => s.imdbId).filter(Boolean) as string[])}'
);
fs.writeFileSync('src/App.tsx', codeApp);

let codeOnb = fs.readFileSync('src/components/OnboardingScreen.tsx', 'utf8');
codeOnb = codeOnb.replace(
  '  libraryIds: Set<number>;\n  addingShowId: number | null;',
  '  libraryIds: Set<number>;\n  libraryImdbs: Set<string>;\n  addingShowId: number | null;'
);
codeOnb = codeOnb.replace(
  'export function OnboardingScreen({ onComplete, onAddShow, libraryIds, addingShowId }: Props) {',
  'export function OnboardingScreen({ onComplete, onAddShow, libraryIds, libraryImdbs, addingShowId }: Props) {'
);
codeOnb = codeOnb.replace(
  'const inLibrary = libraryIds.has(show.id);',
  'const inLibrary = libraryIds.has(show.id) || (show.externals?.imdb && libraryImdbs.has(show.externals.imdb));'
);
fs.writeFileSync('src/components/OnboardingScreen.tsx', codeOnb);
