const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const origTabs = `        {/* Tabs */}
        <div className="flex space-x-2 border-b border-slate-800 pb-px overflow-x-auto scrollbar-none">
          {[
            { id: "up-next", label: "Up Next", icon: PlayCircle },
            { id: "discover", label: "Discover", icon: Compass },
            { id: "coming", label: "Coming Soon", icon: Clock },
            { id: "library", label: "Library", icon: CheckCircle2 }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={\`flex shrink-0 items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors active:scale-95 \${
                activeTab === t.id ? "border-orange-500 text-orange-500" : "border-transparent text-slate-400 hover:text-slate-300"
              }\`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>`;

code = code.replace(origTabs, '');

// Update main pb-24
code = code.replace('className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-12"', 'className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-12 pb-28"');

const origFab = `      {/* Mobile Fab */}
      <button 
        onClick={() => setIsSearchOpen(true)}
        className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-slate-950 shadow-xl shadow-orange-500/20 z-40"
      >
        <Search className="w-6 h-6" />
      </button>`;

const newBottomNav = `      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 pb-[env(safe-area-inset-bottom)] z-40">
        <div className="flex justify-around items-center px-2 py-2 max-w-md mx-auto">
          {[
            { id: "up-next", label: "Up Next", icon: PlayCircle },
            { id: "discover", label: "Discover", icon: Compass },
            { id: "search", label: "Search", icon: Search, action: () => setIsSearchOpen(true) },
            { id: "coming", label: "Coming", icon: Clock },
            { id: "library", label: "Library", icon: CheckCircle2 }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => t.action ? t.action() : setActiveTab(t.id as any)}
              className={\`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors active:scale-95 \${
                (!t.action && activeTab === t.id) ? "text-orange-500" : "text-slate-400 hover:text-slate-300"
              }\`}
            >
              <t.icon className="w-6 h-6" />
              <span className="text-[10px] font-medium tracking-wide">{t.label}</span>
            </button>
          ))}
        </div>
      </div>`;

code = code.replace(origFab, newBottomNav);

fs.writeFileSync('src/App.tsx', code);
