const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `              </div>
            </div>
            </div>
          </section>
        )}

        {/* Up Next View */}`;

const replacement = `              </div>
            </div>
          </section>
        )}

        {/* Up Next View */}`;

code = code.replace(target, replacement);
fs.writeFileSync('src/App.tsx', code);
