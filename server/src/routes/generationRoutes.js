const express = require('express');
const router = express.Router();
const multer = require('multer');
const { generateMap, checkSimilarity, regenerateMap } = require('../controllers/generationController');
const auth = require('../middleware/authMiddleware');

const upload = multer({ storage: multer.memoryStorage() });

// POST /api/generate
router.post('/', auth, upload.single('file'), generateMap);

// POST /api/generate/check-similarity
router.post('/check-similarity', auth, upload.single('file'), checkSimilarity);

// POST /api/generate/regenerate/:mapId
router.post('/regenerate/:mapId', auth, upload.single('file'), regenerateMap);

module.exports = router;
