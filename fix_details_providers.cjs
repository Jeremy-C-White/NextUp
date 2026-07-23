const fs = require('fs');
let code = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8');

if (!code.includes('import { getTMDBIdFromIMDB, getWatchProviders } from "../lib/tmdb";')) {
  code = code.replace(
    'import { UserShow, UserEpisode } from "../types";',
    'import { UserShow, UserEpisode } from "../types";\nimport { getTMDBIdFromIMDB, getWatchProviders } from "../lib/tmdb";'
  );
}

const origState = `  const [activeTab, setActiveTab] = useState<"unwatched" | "all">("unwatched");`;
const newState = `  const [activeTab, setActiveTab] = useState<"unwatched" | "all">("unwatched");
  const [providers, setProviders] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && show.imdbId) {
      getTMDBIdFromIMDB(show.imdbId).then(tmdbId => {
        if (tmdbId) {
          getWatchProviders(tmdbId).then(setProviders).catch(console.error);
        }
      });
    } else {
      setProviders([]);
    }
  }, [isOpen, show.imdbId]);`;

code = code.replace(origState, newState);

const origProviderMetadata = `<span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">{show.provider}</span>`;
const newProviderMetadata = `{providers.length > 0 ? (
                  providers.slice(0, 3).map(p => (
                    <div key={p.provider_id} className="flex items-center gap-1.5 bg-slate-800 px-2 py-0.5 rounded">
                      <img src={\`https://image.tmdb.org/t/p/original\${p.logo_path}\`} alt={p.provider_name} className="w-4 h-4 rounded-sm" />
                      <span className="text-slate-300 font-medium">{p.provider_name}</span>
                    </div>
                  ))
                ) : (
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">{show.provider}</span>
                )}`;

code = code.replace(origProviderMetadata, newProviderMetadata);

fs.writeFileSync('src/components/DetailsModal.tsx', code);
