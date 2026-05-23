const prisma = require('../config/prisma');

// Create a new folder
const createFolder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, parentFolderId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const folder = await prisma.folder.create({
      data: {
        name,
        parentFolderId: parentFolderId || null,
        userId
      }
    });

    res.status(201).json(folder);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A folder with this name already exists in the selected location.' });
    }
    console.error('Error creating folder:', error);
    res.status(500).json({ error: 'Failed to create folder.' });
  }
};

// Get all folders as a tree (1 level deep)
const getFolders = async (req, res) => {
  try {
    const userId = req.user.userId;

    const folders = await prisma.folder.findMany({
      where: { userId, parentFolderId: null },
      include: {
        subFolders: {
          include: {
            _count: {
              select: { maps: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        _count: {
          select: { maps: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Format output to include map count
    const formattedFolders = folders.map(f => ({
      id: f.id,
      name: f.name,
      createdAt: f.createdAt,
      mapCount: f._count.maps,
      subFolders: f.subFolders.map(sub => ({
        id: sub.id,
        name: sub.name,
        createdAt: sub.createdAt,
        parentFolderId: sub.parentFolderId,
        mapCount: sub._count.maps
      }))
    }));

    res.json(formattedFolders);
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({ error: 'Failed to retrieve folders.' });
  }
};

// Rename a folder
const renameFolder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder || folder.userId !== userId) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const updated = await prisma.folder.update({
      where: { id },
      data: { name }
    });

    res.json(updated);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A folder with this name already exists in the selected location.' });
    }
    console.error('Error renaming folder:', error);
    res.status(500).json({ error: 'Failed to rename folder.' });
  }
};

// Delete a folder
const deleteFolder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder || folder.userId !== userId) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Delete folder (Cascade removes MapFolder entries, and SetNull handles subfolders)
    await prisma.folder.delete({
      where: { id }
    });

    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ error: 'Failed to delete folder.' });
  }
};

// Add a map to a folder
const addMapToFolder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { mapId } = req.body;

    const folder = await prisma.folder.findUnique({ where: { id } });
    const map = await prisma.map.findUnique({ where: { id: mapId } });

    if (!folder || folder.userId !== userId) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    if (!map || map.userId !== userId) {
      return res.status(404).json({ error: 'Map not found' });
    }

    await prisma.mapFolder.upsert({
      where: {
        mapId_folderId: {
          mapId,
          folderId: id
        }
      },
      update: {},
      create: {
        mapId,
        folderId: id
      }
    });

    res.json({ message: 'Map added to folder successfully' });
  } catch (error) {
    console.error('Error adding map to folder:', error);
    res.status(500).json({ error: 'Failed to add map to folder.' });
  }
};

// Remove a map from a folder
const removeMapFromFolder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id, mapId } = req.params;

    const folder = await prisma.folder.findUnique({ where: { id } });
    const map = await prisma.map.findUnique({ where: { id: mapId } });

    if (!folder || folder.userId !== userId) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    if (!map || map.userId !== userId) {
      return res.status(404).json({ error: 'Map not found' });
    }

    await prisma.mapFolder.delete({
      where: {
        mapId_folderId: {
          mapId,
          folderId: id
        }
      }
    });

    res.json({ message: 'Map removed from folder successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(400).json({ error: 'Map is not in this folder.' });
    }
    console.error('Error removing map from folder:', error);
    res.status(500).json({ error: 'Failed to remove map from folder.' });
  }
};

module.exports = {
  createFolder,
  getFolders,
  renameFolder,
  deleteFolder,
  addMapToFolder,
  removeMapFromFolder
};
