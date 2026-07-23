const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `              </div>
            )}
            </div>
          </section>
        )}

        {/* Coming Soon */}`;

const replacement = `              </div>
            )}
          </section>
        )}

        {/* Coming Soon */}`;

code = code.replace(target, replacement);
fs.writeFileSync('src/App.tsx', code);
