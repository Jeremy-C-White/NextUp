const fs = require('fs');
let content = fs.readFileSync('src/components/SearchModal.tsx', 'utf8');

content = content.replace(
  'dangerouslySetInnerHTML={{ __html: show.summary }}',
  '>{show.summary.replace(/<[^>]+>/g, "")}'
);
content = content.replace(
  /const timer = setTimeout\(async \(\) => \{/,
  `const controller = new AbortController();
    const timer = setTimeout(async () => {`
);

content = content.replace(
  /const res = await searchShows\(query\);/,
  `const res = await searchShows(query, controller.signal);`
);

content = content.replace(
  /return \(\) => clearTimeout\(timer\);/,
  `return () => {
      clearTimeout(timer);
      controller.abort();
    };`
);

fs.writeFileSync('src/components/SearchModal.tsx', content);
