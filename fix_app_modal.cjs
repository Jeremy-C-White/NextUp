const fs = require('fs');
const code = fs.readFileSync('src/App.tsx', 'utf8');

const updated = code.replace(
  /<VideoPlayerModal \n          streamUrl={playbackRequest} \n          onClose={\(\) => setPlaybackRequest\(null\)}\n          onResolveAnotherSource={\(\) => setPlaybackRequest\(null\)}\n        \/>/g,
  `<VideoPlayerModal 
          request={playbackRequest}
          onClose={() => setPlaybackRequest(null)}
        />`
);

fs.writeFileSync('src/App.tsx', updated);
