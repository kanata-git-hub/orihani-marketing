const fs = require('fs');
let content = fs.readFileSync('src/services/blog/geminiService.ts', 'utf8');

const oldStr = '- 분량: 공백 포함 500자 이내 (절대 500자를 넘기지 마세요). 가급적 450~490자 사이로 분량을 꽉 채워 상세하게 작성하세요.';
const newStr = '- 분량: 공백 포함 450자 이상 ~ 500자 이내로 작성하세요 (절대 500자를 넘기지 마시고, 450자 미만으로 짧게 요약하지 마세요). 분량을 꽉 채워 약재의 기전과 비유를 매우 상세하게 서술하세요.';

content = content.replaceAll(oldStr, newStr);

fs.writeFileSync('src/services/blog/geminiService.ts', content);
