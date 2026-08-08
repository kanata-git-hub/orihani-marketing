const fs = require('fs');
let content = fs.readFileSync('src/services/blog/geminiService.ts', 'utf8');

const oldRegex = /6\. 유튜브 TTS 대본 출력: 반드시 \[Part 4: YouTube TTS Script\] 섹션을 포함하여 유튜브 영상에 들어갈 대본을 작성하세요\.\n\s+- 분량: 반드시 공백 포함 300자 이내\.\n\s+- 지역색 배제: 대구, 신천동 등 지역명 절대 배제 \(전국구 타겟\)\.\n\s+- 4단계 구조화 필수: \[공감 \(Hook\)\] \(고통스러운 증상 묘사\), \[전문적 진단 \(Insight\)\] \(직관적 비유로 원인 설명\), \[치료 메커니즘 \(Solution\)\] \(치료 원리\), \[치료 효과 \(Effect\)\] \(긍정적인 변화 시각적 묘사\)\.\n\s+- 톤앤매너: 전문적이고 확신에 찬 어조, 환자를 다독이는 따뜻함\./g;

const newText = `6. 유튜브 TTS 대본 출력: 반드시 [Part 4: YouTube TTS Script] 섹션을 포함하여 유튜브 영상에 들어갈 숏폼 코미디 대본을 작성하세요.
   - 분량: 15초 분량, 공백 포함 300자 이내.
   - 지역색 배제: 대구, 신천동 등 지역명 절대 배제 (전국구 타겟).
   - 3-Scene 숏폼 코미디 구조화 필수 (핵심): 
     1) [0~5초] Hook (내레이션): 환자의 페인포인트를 찌르는 찰진 공감 비유 (예: "긴장만 하면 겨드랑이에서 워터파크가 개장하시나요?")
     2) [5~10초] Comedic Diagnosis (오원장): 환자의 상태를 팩트폭행 하듯 유쾌하게 진단 (예: "음... 우리 뇌가 직장 상사를 포식자로 착각하고 있네요.")
     3) [10~15초] Solution (내레이션): 오원장의 한의학적 치료로 유쾌한 해결책 제시.
   - 톤앤매너: 개그콘서트나 릴스처럼 톡톡 튀고 재미있는 'B급 코미디 + A급 전문성'의 결합. 단순 진지한 나열은 절대 금지.`;

content = content.replace(oldRegex, newText);

fs.writeFileSync('src/services/blog/geminiService.ts', content);
console.log('Done');
