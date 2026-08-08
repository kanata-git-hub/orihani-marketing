const fs = require('fs');
let content = fs.readFileSync('src/services/blog/geminiService.ts', 'utf8');
content = content.replace(/300자 이내/g, '150자 이내');
fs.writeFileSync('src/services/blog/geminiService.ts', content);
console.log('Length updated to 150');
