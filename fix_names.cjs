const fs = require('fs');
let code = fs.readFileSync('replace_seed.cjs', 'utf8');
code = code.replace(/personFor:/g, 'thePersonFor:');
code = code.replace(/u\.personFor/g, 'u.thePersonFor');
code = code.replace(/lookouts:/g, 'lookoutFor:');
code = code.replace(/u\.lookouts/g, 'u.lookoutFor');
fs.writeFileSync('replace_seed.cjs', code);
