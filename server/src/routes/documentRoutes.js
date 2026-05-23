const express = require('express');
const { uploadDocument, getDocuments } = require('../controllers/documentController');
const authenticateToken = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

// Apply auth middleware to all document routes
router.use(authenticateToken);

// Document endpoints
router.post('/upload', upload.single('file'), uploadDocument);
router.get('/', getDocuments);

module.exports = router;
