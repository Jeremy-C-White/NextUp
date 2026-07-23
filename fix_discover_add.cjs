const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetBtn1 = `                                    >
                                      + Add
                                    </button>`;

const replaceBtn1 = `                                      disabled={addingShowId === show.id}
                                    >
                                      {addingShowId === show.id ? "Adding..." : "+ Add"}
                                    </button>`;

code = code.replace(targetBtn1, replaceBtn1);

// Add opacity-50 if addingShowId === show.id
// className="bg-orange-500 hover:bg-orange-400 active:scale-95 touch-manipulation text-orange-950 text-[10px] font-bold uppercase tracking-widest mb-2 py-1 px-2 rounded flex-1 text-center flex items-center justify-center gap-1"
const targetClass = 'className="bg-orange-500 hover:bg-orange-400 active:scale-95 touch-manipulation text-orange-950 text-[10px] font-bold uppercase tracking-widest mb-2 py-1 px-2 rounded flex-1 text-center flex items-center justify-center gap-1"';
const replaceClass = 'className={`bg-orange-500 hover:bg-orange-400 active:scale-95 touch-manipulation text-orange-950 text-[10px] font-bold uppercase tracking-widest mb-2 py-1 px-2 rounded flex-1 text-center flex items-center justify-center gap-1 ${addingShowId === show.id ? "opacity-50" : ""}`}';

code = code.replace(targetClass, replaceClass);

fs.writeFileSync('src/App.tsx', code);
