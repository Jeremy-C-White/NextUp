const fs = require('fs');
let codeApp = fs.readFileSync('src/App.tsx', 'utf8');

// I need to add generateIcs function and state to App component. Or just generate it inline for the href.
// Generating it inline: `data:text/calendar;charset=utf8,BEGIN:VCALENDAR...`
// Let's add the button to the 'On the horizon' rows (comingSoon).

const comingSoonHtmlRegex = /<div className="inline-block px-4 py-2 bg-orange-500\/10 rounded-lg border border-orange-500\/20 text-orange-400 text-xs font-bold tracking-wide uppercase">\s*\{format\(new Date\(nextEp\.airstamp\), "MMM d, yyyy"\)\}\s*<\/div>\s*<\/div>\s*<\/button>/g;

const comingSoonHtmlReplacement = `<div className="flex items-center gap-3">
                        <div className="inline-block px-4 py-2 bg-orange-500/10 rounded-lg border border-orange-500/20 text-orange-400 text-xs font-bold tracking-wide uppercase">
                          {format(new Date(nextEp.airstamp), "MMM d, yyyy")}
                        </div>
                        <a 
                          href={"data:text/calendar;charset=utf8," + encodeURIComponent(\`BEGIN:VCALENDAR\\nVERSION:2.0\\nBEGIN:VEVENT\\nDTSTART:\${new Date(nextEp.airstamp).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'}\\nDTEND:\${new Date(new Date(nextEp.airstamp).getTime() + (show.runtime || 60)*60000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'}\\nSUMMARY:\${show.name} - S\${nextEp.season} E\${nextEp.number}\\nEND:VEVENT\\nEND:VCALENDAR\`)}
                          download={\`\${show.name.replace(/\\s+/g, '_')}_S\${nextEp.season}E\${nextEp.number}.ics\`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors"
                        >
                          Add to Calendar
                        </a>
                      </div>
                    </div>
                  </button>`;

codeApp = codeApp.replace(comingSoonHtmlRegex, comingSoonHtmlReplacement);
fs.writeFileSync('src/App.tsx', codeApp);
