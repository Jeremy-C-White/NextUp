const fs = require('fs');
const content = fs.readFileSync('src/firebase.ts', 'utf-8');
const lines = content.split('\n');
const replacement = `import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDocFromServer } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import config from "../firebase-applet-config.json";

const app = initializeApp(config);

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
}, 'ai-studio-d06e9a0d-62f9-459b-b040-b6e70e7a7bbc');

export { db };
export const auth = getAuth(app);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();`;

const newContent = replacement + "\n" + lines.slice(13).join('\n');
fs.writeFileSync('src/firebase.ts', newContent);
