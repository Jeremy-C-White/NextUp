const streams = [
  "Bones.S01E01.1080p.BluRay.x264-xyz",
  "Bones S01E01 DUAL AUDIO [HIN-ENG]",
  "Bones S01E01 FRENCH 1080p",
  "Bones S01E01 MULTI 1080p",
  "Bones S01E01 ENG",
];

function detectLanguage(text) {
  text = text.toLowerCase();
  const multiTags = /\b(dual[- ]?audio|multi|multi[- ]?audio)\b/;
  const engTags = /\b(eng|english|en)\b/;
  const foreignTags = /\b(fre|french|ita|italian|spa|spanish|ger|german|rus|russian|hin|hindi|tam|tamil|tel|telugu|jap|japanese|kor|korean|chi|chinese|por|portuguese|lat|latino|pol|polish|vostfr|vf|truefrench)\b/;
  
  if (multiTags.test(text)) return 'multi';
  if (engTags.test(text) && foreignTags.test(text)) return 'multi'; // often "HIN-ENG"
  if (engTags.test(text)) return 'english';
  if (foreignTags.test(text)) return 'non-english';
  return 'unknown';
}

streams.forEach(s => console.log(s, detectLanguage(s)));
