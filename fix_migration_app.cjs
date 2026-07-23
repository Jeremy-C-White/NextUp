const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `    // One-time migration for old watch progress subcollections
    (async () => {
      try {
        const showsSnap = await getDocs(collection(db, \`users/\${user.uid}/shows\`));
        for (const showDoc of showsSnap.docs) {
          const data = showDoc.data();
          if (data.watchedEpisodes === undefined) {
            const epsSnap = await getDocs(collection(db, \`users/\${user.uid}/shows/\${showDoc.id}/episodes\`));
            
            const watchedEpisodes: Record<string, any> = {};
            epsSnap.docs.forEach(ep => {
              if (ep.data().watched) watchedEpisodes[ep.id] = ep.data().watchedAt || Date.now();
            });
            
            let batch = writeBatch(db);
            let opCount = 0;
            
            // Commit parent doc update first
            batch.update(showDoc.ref, { watchedEpisodes });
            opCount++;
            
            for (const ep of epsSnap.docs) {
              batch.delete(ep.ref);
              opCount++;
              if (opCount === 499) {
                await batch.commit();
                batch = writeBatch(db);
                opCount = 0;
              }
            }
            if (opCount > 0) {
              await batch.commit();
            }
          }
        }
      } catch (e) {
        console.error("Migration error:", e);
      }
    })();`;

code = code.replace(target, '');
fs.writeFileSync('src/App.tsx', code);
