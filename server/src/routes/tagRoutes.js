const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const tagController = require('../controllers/tagController');

// All tag routes require authentication
router.use(authMiddleware);

// Get all tags
router.get('/', tagController.getTags);

// Create a new tag
router.post('/', tagController.createTag);

// Update a tag
router.patch('/:id', tagController.updateTag);

// Delete a tag
router.delete('/:id', tagController.deleteTag);

module.exports = router;
