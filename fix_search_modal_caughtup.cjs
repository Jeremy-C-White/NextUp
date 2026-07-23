const fs = require('fs');
let code = fs.readFileSync('src/components/SearchModal.tsx', 'utf8');

// Update interface
code = code.replace(
  'onAddShow: (show: Show) => void;',
  'onAddShow: (show: Show, caughtUp?: boolean) => void;'
);

const originalButton = `<button 
                        onClick={async (e) => { 
                          e.stopPropagation(); 
                          setAddingId(show.id);
                          await onAddShow(show);
                          setAddingId(null);
                        }}
                        className={\`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-all \${
                          inLibrary 
                            ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                            : addingId === show.id
                            ? "bg-orange-500/50 text-orange-950 cursor-wait"
                            : "bg-orange-500 text-orange-950 hover:bg-orange-400"
                        }\`}
                      >
                        {inLibrary ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {inLibrary ? "In Library" : addingId === show.id ? "Adding..." : "Add Show"}
                      </button>`;

const newButtons = `<div className="flex gap-2">
                        <button 
                          onClick={async (e) => { 
                            e.stopPropagation(); 
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
                          onClick={async (e) => { 
                            e.stopPropagation(); 
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

code = code.replace(originalButton, newButtons);

if (code.includes('<CheckCircle') && !code.includes('CheckCircle,')) {
    code = code.replace('Check, Plus', 'Check, Plus, CheckCircle');
}

fs.writeFileSync('src/components/SearchModal.tsx', code);
