const fs = require('fs');
let code = fs.readFileSync('src/components/OnboardingScreen.tsx', 'utf8');

const target = `          <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent pb-[env(safe-area-inset-bottom)]">
            <div className="max-w-xl mx-auto flex gap-4">
              <button 
                onClick={() => setStep(2)}
                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all flex items-center justify-center"
              >
                Skip for now
              </button>
              <button 
                onClick={() => setStep(2)}
                disabled={libraryIds.size === 0}
                className="flex-1 py-4 bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold rounded-2xl transition-all flex items-center justify-center disabled:opacity-50 disabled:bg-slate-800 disabled:text-slate-500"
              >
                Continue <ArrowRight className="w-5 h-5 ml-2" />
              </button>
            </div>
          </div>`;

const replace = `          <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent pb-[env(safe-area-inset-bottom)] pt-12">
            <div className="max-w-xl mx-auto flex flex-col gap-3">
              <div className="flex gap-4">
                <button 
                  onClick={() => setStep(2)}
                  className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all flex items-center justify-center active:scale-95 touch-manipulation"
                >
                  Skip for now
                </button>
                <button 
                  onClick={() => setStep(2)}
                  disabled={libraryIds.size === 0}
                  className="flex-1 py-4 bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold rounded-2xl transition-all flex items-center justify-center active:scale-95 touch-manipulation disabled:opacity-50 disabled:active:scale-100 disabled:bg-slate-800 disabled:text-slate-500"
                >
                  Continue <ArrowRight className="w-5 h-5 ml-2" />
                </button>
              </div>
              <p className="text-center text-xs text-slate-500 mb-2 font-medium">You can always add more shows later from the Discover tab.</p>
            </div>
          </div>`;

code = code.replace(target, replace);
fs.writeFileSync('src/components/OnboardingScreen.tsx', code);
