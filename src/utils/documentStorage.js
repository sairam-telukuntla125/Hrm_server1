const path = require('path');

// Local development uses <project>/uploads. In Railway, set PDF_STORAGE_PATH
// to a directory inside a mounted Volume so generated documents survive restarts.
const storageRoot = path.resolve(
    process.env.PDF_STORAGE_PATH || path.join(__dirname, '..', '..', 'uploads')
);

const getDocumentDirectory = (type) => path.join(storageRoot, type);
const getDocumentPath = (type, filename) => path.join(getDocumentDirectory(type), filename);

module.exports = { storageRoot, getDocumentDirectory, getDocumentPath };
