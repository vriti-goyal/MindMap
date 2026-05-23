const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const folderController = require('../controllers/folderController');

// All folder routes require authentication
router.use(authMiddleware);

// Get all folders (tree structure)
router.get('/', folderController.getFolders);

// Create a new folder
router.post('/', folderController.createFolder);

// Rename a folder
router.patch('/:id', folderController.renameFolder);

// Delete a folder
router.delete('/:id', folderController.deleteFolder);

// Add a map to a folder
router.post('/:id/maps', folderController.addMapToFolder);

// Remove a map from a folder
router.delete('/:id/maps/:mapId', folderController.removeMapFromFolder);

module.exports = router;
