const fs = require('fs');
let content = fs.readFileSync('src/services/blog/geminiService.ts', 'utf8');

const oldTitleStr = 'YouTube Title: ([핵심 증상 질문형식] [질병명]? 한의학적 [핵심 치료법 요약] (How to Fix [질병영문명]) 형식으로 작성하세요. 예: 팔이 안 올라가는 오십견? 한의학적 유착 치료법 (How to Fix Frozen Shoulder))';
const newTitleStr = 'YouTube Title: ([핵심 증상 질문형식] [질병명]? 한의학적 [핵심 치료법 요약] (How to Fix [질병영문명]) 형식으로 작성하세요. 단, 유튜브 제목과 해시태그를 모두 합쳤을 때 전체 길이가 100자를 초과하지 않도록 100자 이내로 유튜브 제목을 적절히 줄여주세요. 예: 팔이 안 올라가는 오십견? 한의학적 유착 치료법 (How to Fix Frozen Shoulder))';

content = content.replaceAll(oldTitleStr, newTitleStr);
fs.writeFileSync('src/services/blog/geminiService.ts', content);
