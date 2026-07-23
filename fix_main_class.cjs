const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');

const target = `class ErrorBoundary extends Component<Props, State> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }`;

const replace = `class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }`;

code = code.replace(target, replace);
fs.writeFileSync('src/main.tsx', code);
