const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace(
  '            </button>\n          </div>\n        <form onSubmit={handleSubmit} className="space-y-4">',
  '            </button>\n          </div>\n        )}\n        <form onSubmit={handleSubmit} className="space-y-4">'
);
fs.writeFileSync('src/components/AuthScreen.tsx', code);
