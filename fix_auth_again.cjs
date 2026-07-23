const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

const target = `                  {ALLOW_REGISTRATION && (
          <div className="flex p-1 bg-slate-800/50 rounded-xl mb-6">
            <button
              onClick={() => { setIsLogin(true); setError(""); }}
              className={\`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors \${
                isLogin ? "bg-orange-500 text-slate-950 shadow-md shadow-orange-500/20" : "text-slate-400 hover:text-white"
              }\`}
            >
              Sign in
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(""); }}
              className={\`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors \${
                !isLogin ? "bg-orange-500 text-slate-950 shadow-md shadow-orange-500/20" : "text-slate-400 hover:text-white"
              }\`}
            >
              Register
            </button>
          </div>
        <form`;

const replacement = `                  {ALLOW_REGISTRATION && (
          <div className="flex p-1 bg-slate-800/50 rounded-xl mb-6">
            <button
              onClick={() => { setIsLogin(true); setError(""); }}
              className={\`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors \${
                isLogin ? "bg-orange-500 text-slate-950 shadow-md shadow-orange-500/20" : "text-slate-400 hover:text-white"
              }\`}
            >
              Sign in
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(""); }}
              className={\`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors \${
                !isLogin ? "bg-orange-500 text-slate-950 shadow-md shadow-orange-500/20" : "text-slate-400 hover:text-white"
              }\`}
            >
              Register
            </button>
          </div>
        )}
        <form`;

code = code.replace(target, replacement);

const target2 = `              </div>
            </div>
                    <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Username</label>`;

const replacement2 = `              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Username</label>`;

code = code.replace(target2, replacement2);

fs.writeFileSync('src/components/AuthScreen.tsx', code);
