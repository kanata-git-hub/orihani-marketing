const fs = require('fs');
let content = fs.readFileSync('src/services/blog/geminiService.ts', 'utf8');

const oldTitleStr = 'YouTube Title: (영상 내용의 핵심 증상, 비유, 또는 약재의 효능을 강조하여 시청자의 흥미를 유발하는 매력적인 제목)';
const newTitleStr = 'YouTube Title: ([질병명] 한의학적 치료 원리: [핵심 내용 요약] ([질병영문명] & Acupuncture) 형식으로 작성하세요. 예: 오십견 한의학적 치료 원리: 굳은 어깨 유착 풀기 (Frozen Shoulder & Acupuncture))';

const oldHashtagStr = 'YouTube Hashtags: (해시태그 총 5개. 반드시 다음 순서대로 작성하세요: #질병명 #건강정보 #오리한의원 #대구 #[질병관련인기검색어])';
const newHashtagStr = 'YouTube Hashtags: (해시태그 총 5개. 반드시 다음 순서대로 작성하세요: #질병명 #[질병영문명(띄어쓰기없이)] #Acupuncture #오리한의원 #대구)';

content = content.replaceAll(oldTitleStr, newTitleStr);
content = content.replaceAll(oldHashtagStr, newHashtagStr);

fs.writeFileSync('src/services/blog/geminiService.ts', content);
