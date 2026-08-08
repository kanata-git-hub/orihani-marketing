const fs = require('fs');

let cg = fs.readFileSync('src/components/video/CinemagraphGenerator.tsx', 'utf8');
cg = cg.replace(/Fat, completely naked yellow duck/g, 'Fat, completely yellow duck');
fs.writeFileSync('src/components/video/CinemagraphGenerator.tsx', cg);

let c = fs.readFileSync('src/constants.tsx', 'utf8');
c = c.replace(/completely naked yellow duck character/g, 'completely yellow duck character');
c = c.replace(/If Deok-i is receiving body treatment, he MUST be strictly naked\./g, '');
fs.writeFileSync('src/constants.tsx', c);

console.log('Done Naked Update');
