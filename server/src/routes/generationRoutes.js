const express = require('express');
const router = express.Router();
const multer = require('multer');
const { generateMap, checkSimilarity } = require('../controllers/generationController');
const auth = require('../middleware/authMiddleware');

const upload = multer({ storage: multer.memoryStorage() });

// POST /api/generate
router.post('/', auth, upload.single('file'), generateMap);

// POST /api/generate/check-similarity
router.post('/check-similarity', auth, upload.single('file'), checkSimilarity);

module.exports = router;
