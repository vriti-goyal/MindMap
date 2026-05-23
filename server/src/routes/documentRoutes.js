const express = require('express');
const { 
  uploadDocument, 
  getDocuments, 
  attachDocument, 
  deleteDocument,
  exploreSimilarity,
  saveAndCreateMap
} = require('../controllers/documentController');
const authenticateToken = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const multer = require('multer');

const router = express.Router();
const uploadMemory = multer({ storage: multer.memoryStorage() });

// Apply auth middleware to all document routes
router.use(authenticateToken);

// Document endpoints
router.post('/upload', upload.single('file'), uploadDocument);
router.post('/explore-similarity', uploadMemory.single('file'), exploreSimilarity);
router.post('/save-and-create-map', uploadMemory.single('file'), saveAndCreateMap);
router.get('/all', getDocuments);
router.post('/attach', attachDocument);
router.delete('/:id', deleteDocument);

// Maintain GET / for backwards-compatibility
router.get('/', getDocuments);

module.exports = router;
