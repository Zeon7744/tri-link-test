const fs = require('fs');
const path = 'D:/项目/开发部/github/tri-link-test/bin/agent-cli.js';
let c = fs.readFileSync(path, 'utf8');

// Find the --auto block and the wrongly-placed monitor commands inside it
const autoStart = c.indexOf("if (args.includes('--auto')");
const afterAutoBlock = c.indexOf('\n}\n\nif (args.includes(\'--optimize\')', autoStart);

// Extract the --auto block
const autoBlock = c.substring(autoStart, afterAutoBlock + 1);

// Find the wrongly-placed monitor commands inside --auto
const misplacedStart = autoBlock.indexOf("if (args.includes('--monitor')");
const misplacedEnd = autoBlock.indexOf('const requirement = args.filter');

if (misplacedStart !== -1 && misplacedEnd !== -1) {
  // Remove the misplaced block and keep only the proper --auto content
  const beforeMisplaced = autoBlock.substring(0, misplacedStart);
  const afterMisplaced = autoBlock.substring(misplacedEnd);
  const fixedAutoBlock = beforeMisplaced + afterMisplaced;
  
  c = c.substring(0, autoStart) + fixedAutoBlock + c.substring(afterAutoBlock + 1);
  
  // Also remove the duplicate block at the end (lines 283-325)
  const dupStart = c.indexOf("if (args.includes('--monitor')", autoStart + fixedAutoBlock.length + 100);
  if (dupStart !== -1) {
    const dupEnd = c.indexOf('\nconst requirement = args.filter', dupStart);
    if (dupEnd !== -1) {
      const dupBlock = c.substring(dupStart, dupEnd + 'const requirement = args.filter'.length);
      // Check if this is a separate top-level block (not inside --auto)
      const linesBefore = c.substring(0, dupStart).split('\n');
      const lastNonEmpty = linesBefore.filter(l => l.trim()).pop();
      if (lastNonEmpty && !lastNonEmpty.includes('auto')) {
        // This is a top-level block, remove it
        c = c.substring(0, dupStart) + c.substring(dupEnd + 'const requirement = args.filter'.length);
      }
    }
  }
  
  fs.writeFileSync(path, c, 'utf8');
  console.log('Fixed CLI structure, size:', c.length);
} else {
  console.log('Could not find misplaced blocks');
  console.log('autoStart:', autoStart, 'afterAutoBlock:', afterAutoBlock);
}
