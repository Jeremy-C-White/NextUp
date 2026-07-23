const fs = require('fs');
let code = fs.readFileSync('src/components/SearchModal.tsx', 'utf8');

// The onAddShow prop needs to lose Promise<void> since it's synchronous now
code = code.replace(
  'onAddShow: (show: Show, caughtUp?: boolean) => Promise<void>;',
  'onAddShow: (show: Show, caughtUp?: boolean) => void;'
);

const origButtons = `<div className="flex gap-2">
                        <button 
                          disabled={inLibrary || addingId === show.id}
                          onClick={async () => { 
                            if (inLibrary || addingId) return;
                            setAddingId(show.id);
                            await onAddShow(show, true);
                            setAddingId(null);
                          }}
                          className={\`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-all \${
                            inLibrary 
                              ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                              : addingId === show.id
                              ? "bg-slate-700 text-slate-400 cursor-wait"
                              : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                          }\`}
                        >
                          <CheckCircle className="w-4 h-4" />
                          Caught Up
                        </button>
                        <button 
                          disabled={inLibrary || addingId === show.id}
                          onClick={async () => { 
                            if (inLibrary || addingId) return;
                            setAddingId(show.id);
                            await onAddShow(show, false);
                            setAddingId(null);
                          }}
                          className={\`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-all \${
                            inLibrary 
                              ? "bg-slate-800 text-slate-500 cursor-not-allowed hidden"
                              : addingId === show.id
                              ? "bg-orange-500/50 text-orange-950 cursor-wait"
                              : "bg-orange-500 text-orange-950 hover:bg-orange-400"
                          }\`}
                        >
                          {inLibrary ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                          {inLibrary ? "In Library" : addingId === show.id ? "Adding..." : "Add"}
                        </button>
                      </div>`;

const newButtons = `<div className="flex gap-2">
                        {inLibrary ? (
                          <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold bg-slate-800 text-slate-500 cursor-default">
                            <Check className="w-4 h-4" />
                            In Library
                          </div>
                        ) : (
                          <>
                            <button 
                              onClick={() => onAddShow(show, true)}
                              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-all bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white active:scale-95 touch-manipulation"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Caught Up
                            </button>
                            <button 
                              onClick={() => onAddShow(show, false)}
                              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-all bg-orange-500 text-orange-950 hover:bg-orange-400 active:scale-95 touch-manipulation"
                            >
                              <Plus className="w-4 h-4" />
                              Add
                            </button>
                          </>
                        )}
                      </div>`;

code = code.replace(origButtons, newButtons);
code = code.replace(/<img /g, '<img decoding="async" ');
code = code.replace('  const [addingId, setAddingId] = useState<number | null>(null);', '');
code = code.replace(/addingId === show.id/g, 'false');

fs.writeFileSync('src/components/SearchModal.tsx', code);
