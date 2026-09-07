const fs = require('fs');
const content = fs.readFileSync('src/components/VideoPlayerModal.tsx', 'utf8');

if (content.includes('<video') && content.includes('ref={videoRef}') && !content.includes('autoPlay')) {
  const newContent = content.replace(
    '              ref={videoRef}\n              src={currentMp4Stream}\n              controls\n              playsInline\n              preload={isIOS ? "metadata" : "auto"}',
    '              ref={videoRef}\n              src={currentMp4Stream}\n              controls\n              playsInline\n              autoPlay\n              preload={isIOS ? "metadata" : "auto"}'
  );
  fs.writeFileSync('src/components/VideoPlayerModal.tsx', newContent);
  console.log("Added autoPlay to VideoPlayerModal");
} else {
  console.log("autoPlay already present or video tag not found");
}
