const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');

code = code.replace(
  'class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {',
  'interface Props { children: ReactNode }\ninterface State { hasError: boolean }\nclass ErrorBoundary extends Component<Props, State> {'
);

fs.writeFileSync('src/main.tsx', code);
