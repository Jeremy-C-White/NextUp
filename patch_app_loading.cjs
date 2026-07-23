const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const loadingHtml = `if (loading) {
    return (
      <div className="min-h-dvh bg-slate-950 pb-24 font-sans text-white p-4 max-w-7xl mx-auto md:p-8 pt-12 md:pt-16">
        <h1 className="text-4xl md:text-5xl font-display font-bold mb-8">NextUp</h1>
        <div className="flex gap-4 mb-8">
          <div className="w-24 h-10 bg-slate-900 rounded-full animate-pulse" />
          <div className="w-24 h-10 bg-slate-900 rounded-full animate-pulse" />
          <div className="w-24 h-10 bg-slate-900 rounded-full animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl bg-slate-900 h-48 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }`;

code = code.replace(
  'if (loading) return <div className="min-h-dvh bg-slate-950 flex items-center justify-center text-orange-500">Loading NextUp...</div>;',
  loadingHtml
);

fs.writeFileSync('src/App.tsx', code);
