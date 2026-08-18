const fs = require('fs');
let content = fs.readFileSync('src/services/blog/geminiService.ts', 'utf8');

const oldTitleStr = 'YouTube Title: ([공감가는 증상/수식어] [질병명]의 [진짜 원인/핵심 치료법/해결책] ([영어 훅 문구]) 형식으로 자연스럽고 간결하게 작성하세요. 단, 제목과 해시태그를 합쳐서 전체 길이가 100자를 초과하지 않도록 길이를 조절하세요. 예: 재발하는 성인 턱 여드름의 진짜 원인과 치료법 (Stop Jawline Acne) 또는 팔이 안 올라가는 오십견 유착 치료법 (How to Fix Frozen Shoulder))';

const newTitleStr = 'YouTube Title: ([구체적이고 공감가는 증상 묘사] 진짜 이유/치료법/해결책 ([질병명]) [영어 훅 문구] 형식으로 호기심을 유발하도록 작성하세요. 괄호와 영문을 포함한 예시 형태를 정확히 지켜주세요. 단, 제목과 해시태그를 합쳐서 전체 길이가 100자를 초과하지 않도록 길이를 조절하세요. 예: 10시간을 자도 몸이 천근만근인 진짜 이유 (자율신경실조증) Fix Sleep Debt)';

content = content.replaceAll(oldTitleStr, newTitleStr);
fs.writeFileSync('src/services/blog/geminiService.ts', content);
