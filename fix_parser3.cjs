const fs = require('fs');
let code = fs.readFileSync('src/pages/ScenarioPlanner.tsx', 'utf8');

code = code.replace(/const imageSectionMatch = text\.match\(\/### 1\\\. Image Generation Prompts\.\*\?\(\[\\\\s\\\\S\]\*\?\)\(\?=\\### 2\\\. Video Generation Prompts\)\/i\);/g, `const imageSectionMatch = text.match(/(?:### )?1\\\. Image.*?([\\s\\S]*?)(?=(?:### )?2\\\. Video|$)/i);`);

code = code.replace(/const videoSectionMatch = text\.match\(\/### 2\\\. Video Generation Prompts\.\*\?\(\[\\\\s\\\\S\]\*\)\/i\);/g, `const videoSectionMatch = text.match(/(?:### )?2\\\. Video.*?([\\s\\S]*)/i);`);

fs.writeFileSync('src/pages/ScenarioPlanner.tsx', code);
