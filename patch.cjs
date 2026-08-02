const fs = require('fs');
let content = fs.readFileSync('src/services/blog/geminiService.ts', 'utf8');

// Update BlogGenerationResult
content = content.replace(
  '  videoScript: string[];\n  sources?: { uri: string; title: string }[];',
  '  videoScript: string[];\n  youtubeTtsScript: string;\n  youtubeTitle: string;\n  youtubeHashtags: string;\n  sources?: { uri: string; title: string }[];'
);

// Add the rules
const additionalRules = `
6. 유튜브 TTS 대본 출력: 반드시 [Part 4: YouTube TTS Script] 섹션을 포함하여 유튜브 영상에 들어갈 대본을 작성하세요.
   - 분량: 반드시 공백 포함 300자 이내.
   - 지역색 배제: 대구, 신천동 등 지역명 절대 배제 (전국구 타겟).
   - 4단계 구조화 필수: [공감 (Hook)] (고통스러운 증상 묘사), [전문적 진단 (Insight)] (직관적 비유로 원인 설명), [치료 메커니즘 (Solution)] (치료 원리), [치료 효과 (Effect)] (긍정적인 변화 시각적 묘사).
   - 톤앤매너: 전문적이고 확신에 찬 어조, 환자를 다독이는 따뜻함.
7. 유튜브 메타데이터 출력: 반드시 [Part 5: YouTube Metadata] 섹션을 포함하여 영상 제목과 해시태그를 작성하세요.
   - 영상 제목: 지역색 배제.
   - 해시태그: 5개 (#대구한의원, #오리한의원, #질병이름 반드시 포함).`;

// For TreatmentPrompt
content = content.replace(
  '5. 8초 영상 자막 출력: 반드시 [Part 3: 8-Second Video Script] 섹션을 포함하여 딱 2문장을 출력하세요.',
  '5. 8초 영상 자막 출력: 반드시 [Part 3: 8-Second Video Script] 섹션을 포함하여 딱 2문장을 출력하세요.' + additionalRules
);

// We need a more robust replace for the rules and output format.
// I will just use regex to add it to all 3 functions.
content = content.replace(/5\. 8초 영상 자막 출력.*?출력하세요\./g, '5. 8초 영상 자막 출력: 반드시 [Part 3: 8-Second Video Script] 섹션을 포함하여 딱 2문장을 출력하세요.' + additionalRules);

const additionalOutput = `[Part 4: YouTube TTS Script]
(TTS 대본 300자 이내)
[Part 5: YouTube Metadata]
YouTube Title: (제목)
YouTube Hashtags: (해시태그 5개)
`;

content = content.replace(/\[Part 3: 8-Second Video Script\]\nVideo Script:\n1\. \(15자 이내\)\n2\. \(15자 이내\)/g, '[Part 3: 8-Second Video Script]\nVideo Script:\n1. (15자 이내)\n2. (15자 이내)\n' + additionalOutput);

// Now update the parsing logic
content = content.replace(
  'const videoScriptMatch = text.match(/Video Script:\\n([\\s\\S]*?)$/);',
  `const videoScriptMatch = text.match(/Video Script:\\n([\\s\\S]*?)(?=\\n(?:---|###|\\s)*\\[Part 4:|$)/);
  const youtubeTtsScriptMatch = text.match(/\\[Part 4: YouTube TTS Script\\]\\n([\\s\\S]*?)(?=\\n(?:---|###|\\s)*\\[Part 5:|$)/);
  const youtubeTitleMatch = text.match(/YouTube Title:\\s*(.*)/);
  const youtubeHashtagsMatch = text.match(/YouTube Hashtags:\\s*(.*)/);`
);

content = content.replace(
  '  let videoScript: string[] = [];',
  `  const youtubeTtsScript = youtubeTtsScriptMatch ? youtubeTtsScriptMatch[1].trim() : '';
  const youtubeTitle = youtubeTitleMatch ? youtubeTitleMatch[1].trim() : '';
  const youtubeHashtags = youtubeHashtagsMatch ? youtubeHashtagsMatch[1].trim() : '';

  let videoScript: string[] = [];`
);

content = content.replace(
  'return { blog, instaTitle, instaContent, videoScript, sources, imageSuggestion };',
  'return { blog, instaTitle, instaContent, videoScript, youtubeTtsScript, youtubeTitle, youtubeHashtags, sources, imageSuggestion };'
);

fs.writeFileSync('src/services/blog/geminiService.ts', content);
