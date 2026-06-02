const fs = require('fs');

const appJs = fs.readFileSync('app.js', 'utf8');

// We will construct files based on what's requested
console.log("Modules will be generated file by file.");

