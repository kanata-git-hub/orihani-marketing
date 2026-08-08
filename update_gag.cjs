const fs = require('fs');
let content = fs.readFileSync('src/constants.tsx', 'utf8');

const oldRegex = /\[NARRATIVE REFERENCES: THE PROVEN 3-SCENE COMEDY FORMULA\][\s\S]*?- \[Scene 3: Solution\] \(10-15s\): The satisfying or humorous clinic treatment concluding the video\./;

const newText = `[NARRATIVE REFERENCES: THE PROVEN 3-SCENE COMEDY FORMULA]
Base your narrative heavily on the "3-Scene Short-form Comedy" structure extracted from the Blog Content. The video must perfectly match the 3 scenes in the TTS script. The speaker is ALWAYS the Narrator (내레이션) only.
- [Scene 1: Hook] (0-5s): The relatable pain point. Show Deok-i struggling with the exact symptom. Narrator delivers a striking metaphorical hook (e.g., "긴장만 하면 겨드랑이와 손발에서 워터파크가 개장하시나요?").
- [Scene 2: Comedic Diagnosis] (5-10s): O-wonjang delivering the "Fact-bomb" diagnosis. Narrator explains hilariously (e.g., "우리 뇌가 직장 상사를 '포식자'로 착각해서 도망치라고 땀을 뿜는 겁니다. 훌륭한 생존 본능이죠.").
- [Scene 3: Solution] (10-15s): The satisfying clinic treatment concluding the video. Narrator delivers the final pitch (e.g., "오작동하는 뇌의 사이렌, 이제 끄셔야죠. 오원장의 한약으로 뽀송뽀송한 사회생활을 되찾으세요.").`;

content = content.replace(oldRegex, newText);
fs.writeFileSync('src/constants.tsx', content);
console.log('Done Gag Update');
