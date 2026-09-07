const fs = require('fs');
let lines = fs.readFileSync('src/components/VideoPlayerModal.tsx', 'utf8').split('\n');

const depIndex = lines.findIndex(l => l.includes('  }, [activeSkipSegment, playbackClock.current, playbackClock.duration, creditsAutoplayCountdown, episodeEnded, nextRequest]);'));

if (depIndex !== -1) {
  lines[depIndex] = '  }, [activeSkipSegment, playbackClock.current, playbackClock.duration, creditsAutoplayCountdown, episodeEnded, nextRequest, introDBSegments]);';
  fs.writeFileSync('src/components/VideoPlayerModal.tsx', lines.join('\n'));
  console.log('VideoPlayerModal deps patched');
} else {
  console.log('Could not find DetailsModal line');
}
