const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  '  useEffect(() => {\n    if (user) {\n      fetchLibrary();\n      fetchDiscover();\n    }\n  }, [user]);',
  `  useEffect(() => {
    if (user) {
      fetchLibrary();
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === "discover" && trendingShows.length === 0) {
      fetchDiscover();
    }
  }, [activeTab]);`
);

// We also need to add loading="lazy" for all images in App.tsx
content = content.replace(/<img referrerPolicy="no-referrer" src=/g, '<img referrerPolicy="no-referrer" loading="lazy" src=');

// Fix the "Adding..." DOM mutation by adding `addingId` state
content = content.replace(
  'const [appError, setAppError] = useState<string | null>(null);',
  'const [appError, setAppError] = useState<string | null>(null);\n  const [addingId, setAddingId] = useState<number | null>(null);'
);

content = content.replace(
  /onClick=\{async \(e\) => \{[\s\S]*?className="bg-orange-500 hover:bg-orange-400 text-orange-950 text-\[10px\] font-bold uppercase tracking-widest mb-2 py-1 px-2 rounded w-fit text-center cursor-pointer"/,
  `onClick={async (e) => { 
                                      e.stopPropagation(); 
                                      setAddingId(show.id);
                                      await handleAddShow(show); 
                                      setAddingId(null);
                                    }}
                                    className={(addingId === show.id ? "bg-orange-500/50 cursor-wait " : "bg-orange-500 hover:bg-orange-400 cursor-pointer ") + "text-orange-950 text-[10px] font-bold uppercase tracking-widest mb-2 py-1 px-2 rounded w-fit text-center"}`
);
content = content.replace(
  '+ Add\n                                  </div>',
  '{addingId === show.id ? "Adding..." : "+ Add"}\n                                  </div>'
);

fs.writeFileSync('src/App.tsx', content);
