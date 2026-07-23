const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace(
  '{!isLogin && (',
  '{!needsMigration && !isLogin && ('
);

code = code.replace(
  '<div>\n            <label className="block text-sm font-medium text-slate-400 mb-1.5">Username</label>',
  '{!needsMigration && (\n          <div>\n            <label className="block text-sm font-medium text-slate-400 mb-1.5">Username</label>'
);

// close the div
code = code.replace(
  'placeholder="alex"\n              />\n            </div>\n          </div>\n\n          <div>\n            <label className="block text-sm font-medium text-slate-400 mb-1.5">6-digit PIN</label>',
  'placeholder="alex"\n              />\n            </div>\n          </div>\n          )}\n\n          {!needsMigration && (\n          <div>\n            <label className="block text-sm font-medium text-slate-400 mb-1.5">PIN</label>'
);

code = code.replace(
  'placeholder="••••••"\n              />\n            </div>\n          </div>',
  'placeholder="••••••"\n              />\n            </div>\n          </div>\n          )}'
);

code = code.replace(
  '{loading ? "Working..." : isLogin ? "Continue to NextUp" : "Create Account"}',
  '{loading ? "Working..." : needsMigration ? "Upgrade PIN" : isLogin ? "Continue to NextUp" : "Create Account"}'
);

fs.writeFileSync('src/components/AuthScreen.tsx', code);
