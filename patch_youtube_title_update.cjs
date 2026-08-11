const fs = require('fs');
let content = fs.readFileSync('src/services/blog/geminiService.ts', 'utf8');

const oldTitleStr = 'YouTube Title: ([질병명] 한의학적 치료 원리: [핵심 내용 요약] ([질병영문명] & Acupuncture) 형식으로 작성하세요. 예: 오십견 한의학적 치료 원리: 굳은 어깨 유착 풀기 (Frozen Shoulder & Acupuncture))';
const newTitleStr = 'YouTube Title: ([핵심 증상 질문형식] [질병명]? 한의학적 [핵심 치료법 요약] (How to Fix [질병영문명]) 형식으로 작성하세요. 예: 팔이 안 올라가는 오십견? 한의학적 유착 치료법 (How to Fix Frozen Shoulder))';

content = content.replaceAll(oldTitleStr, newTitleStr);

fs.writeFileSync('src/services/blog/geminiService.ts', content);
