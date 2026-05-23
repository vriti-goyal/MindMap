const express = require('express');
const router = express.Router();
const {
  getMaps,
  getMapById,
  createMap,
  updateMap,
  deleteMap,
  generateAiTitle,
  importMap
} = require('../controllers/mapController');
const tagController = require('../controllers/tagController');
const auth = require('../middleware/authMiddleware');

// Get all mind maps for user
router.get('/', auth, getMaps);

// Create empty manual mind map
router.post('/', auth, createMap);

// Import a mind map from JSON
router.post('/import', auth, importMap);

// Get specific mind map
router.get('/:id', auth, getMapById);

// Update specific mind map
router.put('/:id', auth, updateMap);

// Delete specific mind map
router.delete('/:id', auth, deleteMap);

// Auto-generate AI title for specific mind map
router.post('/:id/ai-title', auth, generateAiTitle);

// Add tag to map
router.post('/:id/tags', auth, tagController.addTagToMap);

// Remove tag from map
router.delete('/:id/tags/:tagId', auth, tagController.removeTagFromMap);

module.exports = router;
