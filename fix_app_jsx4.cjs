const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `              })}
            </div>
            </div>
          </section>
        )}
      </main>`;

const replacement = `              })}
            </div>
          </section>
        )}
      </main>`;

code = code.replace(target, replacement);
fs.writeFileSync('src/App.tsx', code);
