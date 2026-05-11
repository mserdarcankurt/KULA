const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT_DIR, 'migration_prompt.txt'); // We'll update the existing one

// Configuration: What to include
const INCLUDE_EXTENSIONS = ['.ts', '.tsx', '.css', '.html', '.json', '.rules'];
const EXCLUDE_DIRS = ['node_modules', 'dist', '.git', '.firebase', 'android', 'ios', 'functions/node_modules', 'functions/lib'];
const EXCLUDE_FILES = ['package-lock.json', 'migration_prompt.txt', 'firebase-debug.log', 'firestore-debug.log'];

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    const relativePath = path.relative(ROOT_DIR, filePath);

    if (stat.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(relativePath) && !EXCLUDE_DIRS.some(d => relativePath.startsWith(d + path.sep))) {
        getFiles(filePath, fileList);
      }
    } else {
      const ext = path.extname(file);
      if (INCLUDE_EXTENSIONS.includes(ext) && !EXCLUDE_FILES.includes(file)) {
        fileList.push(filePath);
      }
    }
  });
  return fileList;
}

function generatePrompt() {
  console.log('Generating AI Studio Sync Prompt...');
  const files = getFiles(ROOT_DIR);
  let prompt = `# KULA Codebase Snapshot - ${new Date().toLocaleString()}\n\n`;
  prompt += `This document contains the current state of the KULA codebase. Use this to synchronize your understanding of the project.\n\n`;
  prompt += `--- \n\n`;

  files.forEach(file => {
    const relativePath = path.relative(ROOT_DIR, file);
    const content = fs.readFileSync(file, 'utf8');
    const ext = path.extname(file).slice(1) || 'text';
    
    prompt += `## File: ${relativePath}\n`;
    prompt += `\`\`\`${ext}\n${content}\n\`\`\`\n\n`;
  });

  fs.writeFileSync(OUTPUT_FILE, prompt);
  console.log(`Success! Updated ${OUTPUT_FILE}`);
  console.log(`You can now copy the contents of migration_prompt.txt and paste it into Google AI Studio.`);
}

generatePrompt();
