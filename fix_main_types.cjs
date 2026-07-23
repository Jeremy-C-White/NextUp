const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');

code = code.replace(
  "import React, { StrictMode, Component, ReactNode } from 'react';",
  "import { StrictMode, Component, ReactNode } from 'react';"
);
code = code.replace(
  'class ErrorBoundary extends React.Component<Props, State> {',
  'class ErrorBoundary extends Component<Props, State> {'
);

fs.writeFileSync('src/main.tsx', code);
