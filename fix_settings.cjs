const fs = require('fs');

// SettingsModal.tsx
let codeSettings = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

codeSettings = codeSettings.replace(
  'import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from \'firebase/auth\';',
  'import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from \'firebase/auth\';\nimport { UserShow } from \'../types\';\nimport { Download } from \'lucide-react\';'
);

codeSettings = codeSettings.replace(
  'export function SettingsModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {',
  'export function SettingsModal({ isOpen, onClose, shows }: { isOpen: boolean, onClose: () => void, shows: UserShow[] }) {'
);

const exportButton = `
  const handleExport = () => {
    const dataStr = JSON.stringify(shows, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = \`nextup_export_\${new Date().toISOString().split('T')[0]}.json\`;
    a.click();
    URL.revokeObjectURL(url);
  };
`;
codeSettings = codeSettings.replace(
  'const handleSubmit = async (e: React.FormEvent) => {',
  exportButton + '\n  const handleSubmit = async (e: React.FormEvent) => {'
);

const exportUi = `
        <div className="border-t border-slate-800 pt-8 mt-4">
          <h3 className="text-xl font-bold text-white mb-2">Data Export</h3>
          <p className="text-slate-400 text-sm mb-4">Download a JSON copy of your entire library and watch history. Keep it as a backup.</p>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 px-4 rounded-xl transition-colors"
          >
            <Download className="w-5 h-5" /> Download my data
          </button>
        </div>
      </div>
`;
codeSettings = codeSettings.replace(
  '      </div>\n    </div>\n  );\n}',
  exportUi + '\n    </div>\n  );\n}'
);

fs.writeFileSync('src/components/SettingsModal.tsx', codeSettings);

// App.tsx
let codeApp = fs.readFileSync('src/App.tsx', 'utf8');
codeApp = codeApp.replace(
  '<SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />',
  '<SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} shows={shows} />'
);
fs.writeFileSync('src/App.tsx', codeApp);

