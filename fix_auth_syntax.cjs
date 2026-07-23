const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace(
  '          </div>\n\n        <form onSubmit={handleSubmit} className="space-y-4">',
  '          </div>\n        )}\n        <form onSubmit={handleSubmit} className="space-y-4">'
);

fs.writeFileSync('src/components/AuthScreen.tsx', code);
