const fs = require('fs');
let content = fs.readFileSync('src/services/blog/geminiService.ts', 'utf8');

content = content.replace(/2\) \[5~10초\] Comedic Diagnosis \(오원장\): 환자의 상태를 팩트폭행 하듯 유쾌하게 진단 \(예: "음\.\.\. 우리 뇌가 직장 상사를 포식자로 착각하고 있네요\."\)/g,
    '2) [5~10초] Comedic Diagnosis (내레이션): 환자의 상태를 팩트폭행 하듯 유쾌하게 진단 (예: "우리 뇌가 직장 상사를 포식자로 착각하고 땀을 뿜는 겁니다.")');

content = content.replace(/- \[5~10초 \/ 시각: 오원장의 진료 씬\] 오원장: \(환자의 상태를 팩트폭행 하듯 웃기고 찰지게 비유하며 진단\)/g,
    '- [5~10초 / 시각: 오원장의 진료 씬] 내레이션: (환자의 상태를 팩트폭행 하듯 웃기고 찰지게 비유하며 진단)');

fs.writeFileSync('src/services/blog/geminiService.ts', content);
console.log('Done Speaker Update');
