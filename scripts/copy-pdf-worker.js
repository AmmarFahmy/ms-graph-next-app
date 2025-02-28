const fs = require('fs');
const path = require('path');

// Get the path to the pdf.worker.min.js file in node_modules
const workerPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.mjs');

// Create the public directory if it doesn't exist
const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
}

// Copy the worker file to the public directory
fs.copyFileSync(workerPath, path.join(publicDir, 'pdf.worker.min.js'));

console.log('PDF.js worker file copied to public directory successfully!'); 