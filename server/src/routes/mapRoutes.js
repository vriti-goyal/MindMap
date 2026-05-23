const express = require('express');
const router = express.Router();
const {
  getMaps,
  getMapById,
  createMap,
  updateMap,
  deleteMap,
  generateAiTitle
} = require('../controllers/mapController');
const auth = require('../middleware/authMiddleware');

// Get all mind maps for user
router.get('/', auth, getMaps);

// Create empty manual mind map
router.post('/', auth, createMap);

// Get specific mind map
router.get('/:id', auth, getMapById);

// Update specific mind map
router.put('/:id', auth, updateMap);

// Delete specific mind map
router.delete('/:id', auth, deleteMap);

// Auto-generate AI title for specific mind map
router.post('/:id/ai-title', auth, generateAiTitle);

module.exports = router;
