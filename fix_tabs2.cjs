const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace('{true && (', '');
code = code.replace(
  `            </button>
          </div>
        )}`,
  `            </button>
          </div>`
);

fs.writeFileSync('src/components/AuthScreen.tsx', code);
