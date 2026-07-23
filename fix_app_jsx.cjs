const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `                  </button>
                ))
              )}
            </div>
            </div>
          </section>
        )}

        {/* Library */}`;

const replacement = `                  </button>
                ))
              )}
            </div>
          </div>
        </section>
        )}`;

code = code.replace(target, replacement);

fs.writeFileSync('src/App.tsx', code);
