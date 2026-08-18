const fs = require('fs');
let content = fs.readFileSync('src/services/blog/geminiService.ts', 'utf8');

const oldHashtags = 'YouTube Hashtags: (해시태그 총 5개. 반드시 다음 순서대로 작성하세요: #질병명 #[질병영문명(띄어쓰기없이)] #Acupuncture #오리한의원 #대구)';

const newHashtags = 'YouTube Hashtags: (해시태그 총 5개. 반드시 다음 순서대로 작성하세요: #[핵심질환명] #[한국인검색증상키워드1] #[한국인검색증상키워드2] #[질병영문명(띄어쓰기없이)] #오리한의원. 예: #자율신경실조증 #만성피로 #불면증 #AutonomicDysfunction #오리한의원)';

content = content.replaceAll(oldHashtags, newHashtags);
fs.writeFileSync('src/services/blog/geminiService.ts', content);
