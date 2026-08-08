const fs = require('fs');
let content = fs.readFileSync('src/constants.tsx', 'utf8');

const oldRegex = /\[NARRATIVE REFERENCES: THE PROVEN FORMULAS\][\s\S]*?- Reference 10.*?smile\./;

const newText = `[NARRATIVE REFERENCES: THE PROVEN 3-SCENE COMEDY FORMULA]
Base your narrative heavily on the "3-Scene Short-form Comedy" structure extracted from the Blog Content. The video must perfectly match the 3 scenes in the TTS script:
- [Scene 1: Hook] (0-5s): The relatable pain point. Show Deok-i struggling with the exact symptom (e.g., sweating profusely, extreme turtleneck posture).
- [Scene 2: Comedic Diagnosis] (5-10s): O-wonjang delivering the "Fact-bomb" diagnosis with a hilarious metaphor (e.g., "Your spine is reversing evolution", "Your brain thinks your boss is a predator").
- [Scene 3: Solution] (10-15s): The satisfying or humorous clinic treatment concluding the video.`;

content = content.replace(oldRegex, newText);
fs.writeFileSync('src/constants.tsx', content);
console.log('Done 3');
