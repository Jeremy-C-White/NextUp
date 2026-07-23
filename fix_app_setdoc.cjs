const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'import { collection, onSnapshot, query, getDocs, writeBatch } from "firebase/firestore";',
  'import { collection, onSnapshot, query, getDocs, writeBatch, setDoc } from "firebase/firestore";'
);

fs.writeFileSync('src/App.tsx', code);
