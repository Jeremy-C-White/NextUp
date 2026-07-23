const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');

const target = `class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  constructor(props: Props) {
    super(props);
  }`;

const replace = `class ErrorBoundary extends Component<Props, State> {
  declare props: Props;
  declare state: State;
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }`;

code = code.replace(target, replace);
fs.writeFileSync('src/main.tsx', code);
