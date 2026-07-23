const fs = require('fs');
let code = fs.readFileSync('src/lib/library.ts', 'utf8');

if (!code.includes('deleteField')) {
    code = code.replace('doc, setDoc } from "firebase/firestore";', 'doc, setDoc, deleteField } from "firebase/firestore";');
}

code = code.replace(
    '[episodeId]: watched ? Date.now() : null',
    '[episodeId]: watched ? Date.now() : deleteField()'
);

code = code.replace(
    'const updates: Record<string, number | null> = {};',
    'const updates: Record<string, any> = {};'
);

code = code.replace(
    'updates[epId] = watched ? Date.now() : null;',
    'updates[epId] = watched ? Date.now() : deleteField();'
);

fs.writeFileSync('src/lib/library.ts', code);
