const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace(
  '<div className="flex p-1 bg-slate-800/50 rounded-xl mb-6">',
  '{ALLOW_REGISTRATION && (\n          <div className="flex p-1 bg-slate-800/50 rounded-xl mb-6">'
);

code = code.replace(
  '            </button>\n          </div>\n        <form',
  '            </button>\n          </div>\n        )}\n        <form'
);

fs.writeFileSync('src/components/AuthScreen.tsx', code);
