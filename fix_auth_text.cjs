const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

const origText = `<div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-orange-500/20">
          <Tv className="w-8 h-8 text-slate-950" />
        </div>
        
        <h1 className="text-4xl font-display font-bold text-white mb-2">
          {isLogin ? "Welcome back." : "Create account."}
        </h1>
        <p className="text-slate-400 mb-8">
          Keep your library, episode progress, and recommendations synced across devices.
        </p>`;

const newText = `<div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-orange-500/20">
          <Tv className="w-8 h-8 text-slate-950" />
        </div>
        
        <h1 className="text-4xl font-display font-bold text-white mb-2 tracking-tight">
          NextUp
        </h1>
        <p className="text-slate-400 mb-8 text-lg">
          Track every show. Never lose your place.
        </p>`;

code = code.replace(origText, newText);

fs.writeFileSync('src/components/AuthScreen.tsx', code);
