const prisma = require('../config/prisma');

// Create a new tag
const createTag = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, color } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    const tag = await prisma.tag.create({
      data: {
        name,
        color: color || '#6366f1',
        userId
      }
    });

    res.status(201).json(tag);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A tag with this name already exists.' });
    }
    console.error('Error creating tag:', error);
    res.status(500).json({ error: 'Failed to create tag.' });
  }
};

// Get all tags for the user
const getTags = async (req, res) => {
  try {
    const userId = req.user.userId;

    const tags = await prisma.tag.findMany({
      where: { userId },
      include: {
        _count: {
          select: { maps: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    const formattedTags = tags.map(t => ({
      id: t.id,
      name: t.name,
      color: t.color,
      mapCount: t._count.maps
    }));

    res.json(formattedTags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to retrieve tags.' });
  }
};

// Update a tag (name or color)
const updateTag = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { name, color } = req.body;

    const tag = await prisma.tag.findUnique({ where: { id } });
    if (!tag || tag.userId !== userId) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    const updated = await prisma.tag.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(color && { color })
      }
    });

    res.json(updated);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A tag with this name already exists.' });
    }
    console.error('Error updating tag:', error);
    res.status(500).json({ error: 'Failed to update tag.' });
  }
};

// Delete a tag
const deleteTag = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const tag = await prisma.tag.findUnique({ where: { id } });
    if (!tag || tag.userId !== userId) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    // Cascade delete will remove MapTag entries
    await prisma.tag.delete({
      where: { id }
    });

    res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ error: 'Failed to delete tag.' });
  }
};

// Add a tag to a map
const addTagToMap = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params; // mapId
    const { tagId } = req.body;

    const map = await prisma.map.findUnique({ where: { id } });
    const tag = await prisma.tag.findUnique({ where: { id: tagId } });

    if (!map || map.userId !== userId) {
      return res.status(404).json({ error: 'Map not found' });
    }
    if (!tag || tag.userId !== userId) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    await prisma.mapTag.upsert({
      where: {
        mapId_tagId: {
          mapId: id,
          tagId
        }
      },
      update: {},
      create: {
        mapId: id,
        tagId
      }
    });

    res.json({ message: 'Tag added to map successfully' });
  } catch (error) {
    console.error('Error adding tag to map:', error);
    res.status(500).json({ error: 'Failed to add tag to map.' });
  }
};

// Remove a tag from a map
const removeTagFromMap = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id, tagId } = req.params; // mapId, tagId

    const map = await prisma.map.findUnique({ where: { id } });
    const tag = await prisma.tag.findUnique({ where: { id: tagId } });

    if (!map || map.userId !== userId) {
      return res.status(404).json({ error: 'Map not found' });
    }
    if (!tag || tag.userId !== userId) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    await prisma.mapTag.delete({
      where: {
        mapId_tagId: {
          mapId: id,
          tagId
        }
      }
    });

    res.json({ message: 'Tag removed from map successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(400).json({ error: 'Tag is not associated with this map.' });
    }
    console.error('Error removing tag from map:', error);
    res.status(500).json({ error: 'Failed to remove tag from map.' });
  }
};

module.exports = {
  createTag,
  getTags,
  updateTag,
  deleteTag,
  addTagToMap,
  removeTagFromMap
};
