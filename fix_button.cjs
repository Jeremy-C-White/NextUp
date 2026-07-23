const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace(
  '<div \n                                    onClick={async (e) => { \n                                      e.stopPropagation(); \n                                      setAddingId(show.id);\n                                      await handleAddShow(show); \n                                      setAddingId(null);\n                                    }}\n                                    className={(addingId === show.id ? "bg-orange-500/50 cursor-wait " : "bg-orange-500 hover:bg-orange-400 cursor-pointer ") + "text-orange-950 text-[10px] font-bold uppercase tracking-widest mb-2 py-1 px-2 rounded w-fit text-center"}\n                                  >',
  '<button type="button"\n                                    onClick={async (e) => { \n                                      e.stopPropagation(); \n                                      setAddingId(show.id);\n                                      await handleAddShow(show); \n                                      setAddingId(null);\n                                    }}\n                                    className={(addingId === show.id ? "bg-orange-500/50 cursor-wait " : "bg-orange-500 hover:bg-orange-400 cursor-pointer ") + "text-orange-950 text-[10px] font-bold uppercase tracking-widest mb-2 py-1 px-2 rounded w-fit text-center"}\n                                  >'
).replace(
  '{addingId === show.id ? "Adding..." : "+ Add"}\n                                  </div>',
  '{addingId === show.id ? "Adding..." : "+ Add"}\n                                  </button>'
);

fs.writeFileSync('src/App.tsx', app);
