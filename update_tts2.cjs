const fs = require('fs');
let content = fs.readFileSync('src/services/blog/geminiService.ts', 'utf8');

const oldRegex = /\(TTS 대본 300자 이내\)/g;

const newText = `(반드시 아래의 '15초 3-Scene 숏폼 코미디' 구조를 따라 시나리오와 대사를 작성하세요.
- [0~5초 / 시각: 환자의 고통/증상 묘사] 내레이션: (환자의 페인포인트를 찌르는 공감 후킹)
- [5~10초 / 시각: 오원장의 진료 씬] 오원장: (환자의 상태를 팩트폭행 하듯 웃기고 찰지게 비유하며 진단)
- [10~15초 / 시각: 한의원 치료 씬] 내레이션: (치료 해결책 제시 및 유쾌한 마무리)
분량: 공백 포함 300자 이내)`;

content = content.replace(oldRegex, newText);

fs.writeFileSync('src/services/blog/geminiService.ts', content);
console.log('Done 2');
