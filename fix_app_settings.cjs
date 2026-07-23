const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

// I will insert it right before the LogOut button block
if (!app.includes('setIsSettingsOpen(true)')) {
  const settingsButton = `          <button onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-900 rounded-xl transition-colors">
            <span className="text-xl leading-none">⚙️</span>
          </button>\n`;
  app = app.replace(
    '<button onClick={() => signOut(auth)}',
    settingsButton + '          <button onClick={() => signOut(auth)}'
  );
  fs.writeFileSync('src/App.tsx', app);
}
