const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /\{upNext\.map\(\(\{ show, nextEp, progress \}\) => \(\n\s*<article key=\{show\.id\} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col hover:border-slate-700 transition-all group">/g;

code = code.replace(regex, `{upNext.map(({ show, nextEp, progress }) => (
                  <SwipeableCard key={show.id} onMark={() => handleToggleWatched(show.id, show.tvmazeId, nextEp.id, true)}>
                  <article className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col hover:border-slate-700 transition-all group">`);

const closeRegex = /<\/div>\n\s*<\/article>\n\s*\)\)}/g;
code = code.replace(closeRegex, `</div>
                  </article>
                  </SwipeableCard>
                ))}`);

fs.writeFileSync('src/App.tsx', code);
