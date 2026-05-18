const fs = require('fs');
const { Marked } = require('marked');
const { execSync } = require('child_process');
const path = require('path');

const inputFile = process.argv[2];
const outputFile = process.argv[3] || inputFile.replace('.md', '.docx');

if (!inputFile || !fs.existsSync(inputFile)) {
  console.error('Input file not found');
  process.exit(1);
}

const markdown = fs.readFileSync(inputFile, 'utf-8');
const marked = new Marked({ gfm: true });
const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: sans-serif; line-height: 1.6; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
  th { background-color: #f2f2f2; }
  h1, h2, h3 { color: #333; }
  blockquote { border-left: 5px solid #ddd; padding-left: 10px; color: #666; }
</style>
</head>
<body>
${marked.parse(markdown)}
</body>
</html>
`;

const tempHtmlFile = inputFile.replace('.md', '.temp.html');
fs.writeFileSync(tempHtmlFile, html);

try {
  execSync(`textutil -convert docx -output "${outputFile}" "${tempHtmlFile}"`);
  console.log(`Successfully converted to ${outputFile}`);
} catch (error) {
  console.error('Error during conversion:', error.message);
} finally {
  if (fs.existsSync(tempHtmlFile)) {
    fs.unlinkSync(tempHtmlFile);
  }
}
