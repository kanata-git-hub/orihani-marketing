const fs = require('fs');
let content = fs.readFileSync('src/services/blog/geminiService.ts', 'utf8');

const oldPrompt = `[Part 4: YouTube TTS Script]
(제공된 배경지식을 바탕으로 질환의 치료, 처방, 약재 등에 관한 전문적인 내용을 포함하여 유튜브 숏폼 대본을 작성하세요.`;

const newPrompt = `[Part 4: YouTube TTS Script]
(위에서 작성한 블로그 본문의 핵심 내용(특히 도침, 약침, 추나 등 특수 치료법)과 제공된 배경지식(약재, 처방)을 모두 아울러서, 블로그와 논리적으로 일치하는 유튜브 숏폼 대본을 작성하세요.`;

const oldGuide = `  2. 약재의 타겟 작용 명시 (핵심): 특정 처방 하나에 얽매이지 말고, 앞서 도출한 '핵심 약재'들을 대본 내에 직접 언급하세요. 각 약재가 전문적으로 어떤 약리적 역할을 하는지 비유와 매칭해서 설명하세요.`;

const newGuide = `  2. 다각적 치료 기전 명시 (핵심): 블로그 본문에서 강조한 물리적/외부적 치료(예: 도침의 유착 박리, 약침의 염증 완화 등)와 내부적 한약재(앞서 도출한 핵심 약재)의 약리적 역할을 함께 융합하여 설명하세요. (예: "물리적으로 굳은 관절낭은 도침으로 열어주고, 내부의 수독은 창출과 백출로 말리며...")`;

content = content.replaceAll(oldPrompt, newPrompt);
content = content.replaceAll(oldGuide, newGuide);

fs.writeFileSync('src/services/blog/geminiService.ts', content);
