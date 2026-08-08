const fs = require('fs');
let c = fs.readFileSync('src/constants.tsx', 'utf8');
c = c.replace(/Naked, fat yellow duck/gi, 'Fat yellow duck');
fs.writeFileSync('src/constants.tsx', c);
