const fs = require('fs');
let code = fs.readFileSync('src/lib/library.ts', 'utf8');

code = code.replace(
  'import { collection, doc, setDoc, deleteDoc, getDocs, getDoc, query, where, writeBatch, deleteField } from "firebase/firestore";',
  'import { collection, doc, setDoc, deleteDoc, getDocs, deleteField } from "firebase/firestore";'
);
// just in case deleteField wasn't grouped right
code = code.replace(
  'import { collection, doc, setDoc, deleteDoc, getDocs, getDoc, query, where, writeBatch } from "firebase/firestore";',
  'import { collection, doc, setDoc, deleteDoc, getDocs, deleteField } from "firebase/firestore";'
);
// remove getLibraryShows entirely
if (code.includes('export async function getLibraryShows(): Promise<UserShow[]> {')) {
    const lines = code.split('\n');
    const out = [];
    let skipping = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('export async function getLibraryShows()')) {
            skipping = true;
        }
        if (skipping && lines[i] === '}') {
            skipping = false;
            continue;
        }
        if (!skipping) out.push(lines[i]);
    }
    code = out.join('\n');
}

code = code.replace(
  'import { getShow, getEpisodes } from "./tvmaze";',
  'import { getEpisodes } from "./tvmaze";'
);

fs.writeFileSync('src/lib/library.ts', code);
