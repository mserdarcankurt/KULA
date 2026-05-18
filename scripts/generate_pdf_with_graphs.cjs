const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const inputFile = '/Users/serdar/ANTIGRAVITY/KULA/kula_b2b_strategic_analysis.md';
const tempMdFile = '/Users/serdar/ANTIGRAVITY/KULA/kula_b2b_temp.md';
const outputPdf = '/Users/serdar/ANTIGRAVITY/KULA/kula_b2b_strategic_analysis.pdf';

let mdContent = fs.readFileSync(inputFile, 'utf-8');
const mermaidRegex = /```mermaid([\s\S]*?)```/g;
let match;
let counter = 0;

const replacements = [];

while ((match = mermaidRegex.exec(mdContent)) !== null) {
  const mermaidCode = match[1].trim();
  const mmdFile = `/Users/serdar/ANTIGRAVITY/KULA/graph_${counter}.mmd`;
  const pngFile = `/Users/serdar/ANTIGRAVITY/KULA/graph_${counter}.png`;
  
  fs.writeFileSync(mmdFile, mermaidCode);
  
  console.log(`Converting graph ${counter}...`);
  try {
    // Run mermaid-cli
    execSync(`npx -y @mermaid-js/mermaid-cli -i ${mmdFile} -o ${pngFile} -b transparent`);
    replacements.push({
      original: match[0],
      replacement: `![Graph ${counter}](./graph_${counter}.png)`
    });
  } catch (err) {
    console.error(`Error converting graph ${counter}:`, err.message);
  }
  
  counter++;
}

// Perform replacements
let newMdContent = mdContent;
for (const r of replacements) {
  newMdContent = newMdContent.replace(r.original, r.replacement);
}

fs.writeFileSync(tempMdFile, newMdContent);

console.log('Generating PDF...');
try {
  execSync(`npx -y md-to-pdf ${tempMdFile}`);
  // md-to-pdf generates .pdf at the same path as .md but with .pdf extension
  const generatedPdf = tempMdFile.replace('.md', '.pdf');
  if (fs.existsSync(generatedPdf)) {
    fs.renameSync(generatedPdf, outputPdf);
    console.log(`Success! PDF updated at ${outputPdf}`);
  }
} catch (err) {
  console.error('Error generating PDF:', err.message);
}

// Cleanup
// fs.unlinkSync(tempMdFile);
// for(let i=0; i<counter; i++) {
//   if(fs.existsSync(`/Users/serdar/ANTIGRAVITY/KULA/graph_${i}.mmd`)) fs.unlinkSync(`/Users/serdar/ANTIGRAVITY/KULA/graph_${i}.mmd`);
// }
