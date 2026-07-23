const fs = require('fs');
let code = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8');

const origMetadata = `              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400 mb-3">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">{show.provider}</span>
              </div>`;

const newMetadata = `              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400 mb-3">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">{show.provider}</span>
                {show.runtime ? <span>{show.runtime} min</span> : null}
                {show.genres && show.genres.length > 0 ? (
                  <>
                    <span className="w-1 h-1 rounded-full bg-slate-700" />
                    <span className="truncate">{show.genres.join(', ')}</span>
                  </>
                ) : null}
              </div>
              {show.officialSite && (
                <a href={show.officialSite} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-orange-500 hover:text-orange-400 mb-2">
                  <ExternalLink className="w-3 h-3" />
                  Official Site
                </a>
              )}`;

code = code.replace(origMetadata, newMetadata);

if (!code.includes('ExternalLink')) {
  code = code.replace('Trash2 } from "lucide-react";', 'Trash2, ExternalLink } from "lucide-react";');
}

// Add decoding="async" and active classes
code = code.replace(/<img /g, '<img decoding="async" ');
code = code.replace(/hover:bg-orange-400/g, 'hover:bg-orange-400 active:scale-95 touch-manipulation');
code = code.replace(/hover:bg-slate-700/g, 'hover:bg-slate-700 active:scale-95 touch-manipulation');
code = code.replace(/hover:bg-slate-800 text-slate-300/g, 'hover:bg-slate-800 text-slate-300 active:scale-95 touch-manipulation');

fs.writeFileSync('src/components/DetailsModal.tsx', code);
