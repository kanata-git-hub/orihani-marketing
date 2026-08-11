const fs = require('fs');
let content = fs.readFileSync('src/services/blog/geminiService.ts', 'utf8');

const oldStr = 'YouTube Hashtags: (해시태그 5개. 단, #오리한의원, #대구는 반드시 포함하고, 1개는 질병명, 나머지 2개는 해당 영상과 관련된 인기 검색어 주제어로 구성할 것)';
const newStr = 'YouTube Hashtags: (해시태그 총 5개. 단, #대구, #오리한의원, #건강정보 는 반드시 포함하고, 1개는 질병명, 나머지 1개는 해당 영상과 관련된 인기 검색어 주제어로 구성할 것)';

content = content.replaceAll(oldStr, newStr);

fs.writeFileSync('src/services/blog/geminiService.ts', content);
