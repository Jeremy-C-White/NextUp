import { useEffect, useState } from "react";
import { ListVideo, LoaderCircle, PlayCircle, RefreshCcw, ShieldAlert, X } from "lucide-react";
import {
  AioCatalogItem,
  AioCatalogPlayback,
  getAdultAioCatalog,
  resolveAioCatalogPlayback
} from "../lib/aioCatalog";

interface XxxDiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlay: (playback: AioCatalogPlayback) => void;
}

export function XxxDiscoveryModal({ isOpen, onClose, onPlay }: XxxDiscoveryModalProps) {
  const [items, setItems] = useState<AioCatalogItem[]>([]);
  const [catalogCount, setCatalogCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setItems([]);
    setCatalogCount(0);

    void getAdultAioCatalog(controller.signal)
      .then(result => {
        setItems(result.items);
        setCatalogCount(result.catalogCount);
      })
      .catch(cause => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Unable to load the AIOStreams catalog.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [isOpen, reloadToken]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePlay = async (item: AioCatalogItem) => {
    const controller = new AbortController();
    setPlayingId(`${item.type}:${item.id}`);
    setError(null);
    try {
      onPlay(await resolveAioCatalogPlayback(item, controller.signal));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to resolve this AIOStreams item.");
    } finally {
      setPlayingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-0 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="xxx-discovery-title">
      <section className="w-full sm:max-w-3xl max-h-[92dvh] overflow-hidden rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2 id="xxx-discovery-title" className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white">XXX Discovery</h2>
                <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-950">18+ / NSFW</span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Top results from adult catalogs exposed by your configured AIOStreams installation.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close XXX Discovery" autoFocus className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="max-h-[calc(92dvh-7.5rem)] overflow-y-auto p-5 sm:p-6">
          {loading ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
              <LoaderCircle className="h-8 w-8 animate-spin text-orange-500" aria-hidden="true" />
              <p className="text-sm font-medium">Loading AIOStreams catalogs...</p>
            </div>
          ) : error ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
              <p className="max-w-md text-sm text-red-600 dark:text-red-400">{error}</p>
              <button type="button" onClick={() => setReloadToken(token => token + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 font-bold text-slate-950 hover:bg-orange-400">
                <RefreshCcw className="h-4 w-4" aria-hidden="true" /> Retry
              </button>
            </div>
          ) : catalogCount === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
              <ListVideo className="h-8 w-8 text-orange-500" aria-hidden="true" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">No adult catalog is enabled in AIOStreams</h3>
              <p className="max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">Torrentio supplies streams for known title IDs, but it does not supply a top-results catalog. Enable a catalog-capable adult addon in AIOStreams and ensure its catalog name, ID, or genre includes Adult, XXX, NSFW, Porn, or 18+.</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center text-center text-sm text-slate-500 dark:text-slate-400">The configured adult catalog returned no results.</div>
          ) : (
            <ol className="space-y-2">
              {items.map((item, index) => {
                const itemKey = `${item.type}:${item.id}`;
                const isPlaying = playingId === itemKey;
                return (
                  <li key={itemKey}>
                    <button
                      type="button"
                      onClick={() => void handlePlay(item)}
                      disabled={playingId !== null}
                      className="group flex min-h-16 w-full items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-orange-500/50 hover:bg-orange-500/5 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-orange-500/50 dark:hover:bg-orange-500/10"
                    >
                      <span className="w-7 shrink-0 text-center font-mono text-sm font-bold text-slate-400">{index + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-slate-900 dark:text-white">{item.name}</span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{[item.releaseInfo, item.catalogName].filter(Boolean).join(" · ")}</span>
                      </span>
                      {isPlaying
                        ? <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-orange-500" aria-hidden="true" />
                        : <PlayCircle className="h-5 w-5 shrink-0 text-slate-400 group-hover:text-orange-500" aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
