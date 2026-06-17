const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'Screenshots');
const destDir = path.join(__dirname, 'public', 'Screenshots');
const iconSrc = path.join(__dirname, '..', 'appicon.png');
const iconDest = path.join(__dirname, 'public', 'appicon.png');

if (!fs.existsSync(path.join(__dirname, 'public'))) {
  fs.mkdirSync(path.join(__dirname, 'public'));
}
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

if (fs.existsSync(iconSrc)) {
  fs.copyFileSync(iconSrc, iconDest);
  console.log('Copied appicon.png to public/');
} else {
  console.log('appicon.png not found at ' + iconSrc);
}

if (fs.existsSync(srcDir)) {
  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    if (file.endsWith('.png') || file.endsWith('.jpg')) {
      fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
    }
  }
  console.log('Copied screenshots to public/Screenshots/');
} else {
  console.log('Screenshots directory not found at ' + srcDir);
}
