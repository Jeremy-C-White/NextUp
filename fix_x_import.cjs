const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'import { Tv, Search, LogOut, Settings, CheckCircle2, PlayCircle, Clock, ExternalLink, Compass } from "lucide-react";',
  'import { Tv, Search, LogOut, Settings, CheckCircle2, PlayCircle, Clock, ExternalLink, Compass, X } from "lucide-react";'
);

fs.writeFileSync('src/App.tsx', code);
