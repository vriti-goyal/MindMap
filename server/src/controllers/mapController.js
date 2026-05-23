const prisma = require('../config/prisma');
const aiService = require('../services/aiService');

/**
 * Get all mind maps for the authenticated user, supporting optional search queries.
 */
const getMaps = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { search } = req.query;

    const where = { userId };
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } },
        {
          nodes: {
            some: {
              label: { contains: search, mode: 'insensitive' }
            }
          }
        },
        {
          documents: {
            some: {
              title: { contains: search, mode: 'insensitive' }
            }
          }
        }
      ];
    }

    const maps = await prisma.map.findMany({
      where,
      select: {
        id: true,
        title: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
        documents: {
          select: {
            id: true,
            title: true,
            sourceType: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });
    res.json(maps);
  } catch (error) {
    console.error('Error fetching maps:', error);
    res.status(500).json({ error: 'Failed to retrieve mind maps.' });
  }
};

/**
 * Get a specific mind map, fully formatting nodes and edges for React Flow,
 * and including contributed documents.
 */
const getMapById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const map = await prisma.map.findUnique({
      where: { id },
      include: {
        nodes: true,
        edges: true,
        documents: true
      }
    });

    if (!map || map.userId !== userId) {
      return res.status(404).json({ error: 'Mind map not found.' });
    }

    // Map DB structures to React Flow compatible shapes
    const formattedNodes = map.nodes.map(node => ({
      id: node.id,
      type: node.type,
      position: { x: node.xPos, y: node.yPos },
      data: { label: node.label, content: node.content }
    }));

    const formattedEdges = map.edges.map(edge => ({
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId
    }));

    res.json({
      id: map.id,
      title: map.title,
      tags: map.tags || '',
      createdAt: map.createdAt,
      updatedAt: map.updatedAt,
      nodes: formattedNodes,
      edges: formattedEdges,
      documents: map.documents.map(doc => ({
        id: doc.id,
        title: doc.title,
        sourceType: doc.sourceType,
        storageUrl: doc.storageUrl,
        createdAt: doc.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching map details:', error);
    res.status(500).json({ error: 'Failed to retrieve mind map details.' });
  }
};

/**
 * Create a new blank mind map for manual creation.
 */
const createMap = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, tags } = req.body;

    const newMap = await prisma.map.create({
      data: {
        userId,
        title: title || 'Untitled Mind Map',
        tags: tags || ''
      }
    });

    res.status(201).json({
      message: 'Blank mind map created successfully',
      mapId: newMap.id
    });
  } catch (error) {
    console.error('Error creating manual map:', error);
    res.status(500).json({ error: 'Failed to create blank mind map.' });
  }
};

/**
 * Persist/Update the mind map state (nodes, edges, title, tags).
 * Re-saves the nodes and edges sequentially for stability and compatibility
 * with Neon connection pooling, and regenerates embeddings dynamically.
 */
const updateMap = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { title, tags, nodes, edges } = req.body;

    // Verify ownership
    const map = await prisma.map.findUnique({
      where: { id }
    });

    if (!map || map.userId !== userId) {
      return res.status(404).json({ error: 'Mind map not found.' });
    }

    // 1. Delete all existing edges of the map
    await prisma.edge.deleteMany({
      where: { mapId: id }
    });

    // 2. Delete all existing nodes of the map
    await prisma.node.deleteMany({
      where: { mapId: id }
    });

    // 3. Insert new nodes sequentially to prevent connection issues or deadlocks
    if (nodes && Array.isArray(nodes)) {
      for (const node of nodes) {
        await prisma.node.create({
          data: {
            id: node.id,
            mapId: id,
            type: node.type || 'concept',
            label: node.data?.label || '',
            xPos: parseFloat(node.position?.x) || 0,
            yPos: parseFloat(node.position?.y) || 0,
            content: node.data?.content || null
          }
        });
      }
    }

    // 4. Insert new edges sequentially
    if (edges && Array.isArray(edges)) {
      for (const edge of edges) {
        await prisma.edge.create({
          data: {
            id: edge.id,
            mapId: id,
            sourceNodeId: edge.source,
            targetNodeId: edge.target
          }
        });
      }
    }

    const updatedTitle = title || map.title;
    const updatedTags = tags !== undefined ? tags : (map.tags || '');

    // 5. Re-generate embedding based on updated map state for pgvector similarity search
    let embeddingStr = null;
    try {
      const nodeLabels = nodes?.map(n => n.data?.label).filter(Boolean) || [];
      const combinedText = `Title: ${updatedTitle}\nTags: ${updatedTags}\n\nConcepts: ${nodeLabels.join(', ')}`;
      const embedding = await aiService.generateEmbedding(combinedText);
      embeddingStr = `[${embedding.join(',')}]`;
    } catch (embError) {
      console.warn('Embedding generation warning during update:', embError);
    }

    if (embeddingStr) {
      await prisma.$queryRaw`
        UPDATE "Map"
        SET title = ${updatedTitle}, tags = ${updatedTags}, embedding = ${embeddingStr}::vector, "updatedAt" = NOW()
        WHERE id = ${id}
      `;
    } else {
      await prisma.map.update({
        where: { id },
        data: {
          title: updatedTitle,
          tags: updatedTags,
          updatedAt: new Date()
        }
      });
    }

    res.json({ message: 'Mind map saved successfully' });
  } catch (error) {
    console.error('Error saving map state:', error);
    res.status(500).json({ error: error.message || 'Failed to save mind map state.' });
  }
};

/**
 * Delete a specific mind map and cascade delete nodes/edges.
 */
const deleteMap = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const map = await prisma.map.findUnique({
      where: { id }
    });

    if (!map || map.userId !== userId) {
      return res.status(404).json({ error: 'Mind map not found.' });
    }

    await prisma.map.delete({
      where: { id }
    });

    res.json({ message: 'Mind map deleted successfully' });
  } catch (error) {
    console.error('Error deleting map:', error);
    res.status(500).json({ error: 'Failed to delete mind map.' });
  }
};

/**
 * Use Gemini to summarize all current nodes and auto-generate a professional title.
 */
const generateAiTitle = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const map = await prisma.map.findUnique({
      where: { id },
      include: {
        nodes: true
      }
    });

    if (!map || map.userId !== userId) {
      return res.status(404).json({ error: 'Mind map not found.' });
    }

    const nodeLabels = map.nodes.map(n => n.label).filter(Boolean);
    if (nodeLabels.length === 0) {
      return res.json({ title: map.title }); // Return current title if no nodes are present
    }

    const newTitle = await aiService.generateTitleFromNodes(nodeLabels);

    // Update the title in the database
    await prisma.map.update({
      where: { id },
      data: {
        title: newTitle
      }
    });

    res.json({ title: newTitle });
  } catch (error) {
    console.error('Error generating AI title:', error);
    res.status(500).json({ error: 'Failed to auto-generate title.' });
  }
};

module.exports = {
  getMaps,
  getMapById,
  createMap,
  updateMap,
  deleteMap,
  generateAiTitle
};
