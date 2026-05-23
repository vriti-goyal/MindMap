const prisma = require('../config/prisma');
const aiService = require('../services/aiService');

/**
 * Get all mind maps for the authenticated user, supporting optional search queries.
 */
const getMaps = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { search, tagId, folderId } = req.query;

    const where = { userId };
    
    if (tagId) {
      where.mapTags = { some: { tagId } };
    }
    
    if (folderId) {
      where.folders = { some: { folderId } };
    }
    
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
          documentAttachments: {
            some: {
              document: {
                title: { contains: search, mode: 'insensitive' }
              }
            }
          }
        },
        {
          legacyDocuments: {
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
        documentAttachments: {
          select: {
            document: {
              select: {
                id: true,
                title: true,
                sourceType: true
              }
            }
          }
        },
        legacyDocuments: {
          select: {
            id: true,
            title: true,
            sourceType: true
          }
        },
        folders: {
          select: {
            folder: {
              select: { id: true, name: true }
            }
          }
        },
        mapTags: {
          select: {
            tag: {
              select: { id: true, name: true, color: true }
            }
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    // Format output with merged documents
    const formattedMaps = maps.map(map => {
      const junctionDocs = map.documentAttachments.map(att => att.document);
      const legacyDocs = map.legacyDocuments || [];
      
      const allDocsMap = new Map();
      [...junctionDocs, ...legacyDocs].forEach(doc => {
        allDocsMap.set(doc.id, doc);
      });
      
      return {
        id: map.id,
        title: map.title,
        tags: map.mapTags ? map.mapTags.map(mt => mt.tag) : [],
        folders: map.folders ? map.folders.map(mf => mf.folder) : [],
        legacyTags: map.tags || '',
        createdAt: map.createdAt,
        updatedAt: map.updatedAt,
        documents: Array.from(allDocsMap.values()).map(doc => ({
          id: doc.id,
          title: doc.title,
          sourceType: doc.sourceType
        }))
      };
    });

    res.json(formattedMaps);
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
        documentAttachments: {
          include: {
            document: true
          }
        },
        legacyDocuments: true,
        folders: {
          select: {
            folder: { select: { id: true, name: true } }
          }
        },
        mapTags: {
          select: {
            tag: { select: { id: true, name: true, color: true } }
          }
        }
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

    // Merge and deduplicate documents
    const junctionDocs = map.documentAttachments.map(att => att.document);
    const legacyDocs = map.legacyDocuments || [];
    
    const allDocsMap = new Map();
    [...junctionDocs, ...legacyDocs].forEach(doc => {
      allDocsMap.set(doc.id, doc);
    });

    res.json({
      id: map.id,
      title: map.title,
      tags: map.mapTags ? map.mapTags.map(mt => mt.tag) : [],
      folders: map.folders ? map.folders.map(mf => mf.folder) : [],
      legacyTags: map.tags || '',
      createdAt: map.createdAt,
      updatedAt: map.updatedAt,
      nodes: formattedNodes,
      edges: formattedEdges,
      documents: Array.from(allDocsMap.values()).map(doc => ({
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

/**
 * Import a mind map from an exported JSON format
 */
const importMap = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { version, map } = req.body;

    if (!version || !map || !map.title || !Array.isArray(map.nodes) || !Array.isArray(map.edges)) {
      return res.status(400).json({ error: 'Invalid map format', details: ['Missing required fields or wrong structure'] });
    }

    const { title, nodes, edges, folders, tags } = map;

    // 1. Create the new Map entity
    const newMap = await prisma.map.create({
      data: {
        userId,
        title: `[Imported] ${title}`,
        tags: '', // Legacy tags field, leave empty or we can add string tags later
      }
    });

    const mapId = newMap.id;

    // 2. Handle Tags
    if (tags && Array.isArray(tags)) {
      for (const t of tags) {
        if (!t.name) continue;
        // Find existing tag by name for this user
        let existingTag = await prisma.tag.findFirst({
          where: { userId, name: t.name }
        });
        
        if (!existingTag) {
          existingTag = await prisma.tag.create({
            data: {
              userId,
              name: t.name,
              color: t.color || '#3b82f6'
            }
          });
        }
        
        await prisma.mapTag.create({
          data: {
            mapId,
            tagId: existingTag.id
          }
        });
      }
    }

    // 3. Handle Folders
    if (folders && Array.isArray(folders)) {
      for (const f of folders) {
        if (!f) continue;
        let existingFolder = await prisma.folder.findFirst({
          where: { userId, name: f }
        });

        if (!existingFolder) {
          existingFolder = await prisma.folder.create({
            data: {
              userId,
              name: f
            }
          });
        }

        await prisma.mapFolder.create({
          data: {
            mapId,
            folderId: existingFolder.id
          }
        });
      }
    }

    // 4. Handle Nodes
    // We must map old node IDs to new node IDs because the relationships in edges need to match the new IDs.
    // However, the prompt says "All nodes with their positions, labels, and data", and "All edges with their source/target connections".
    // We can just keep the IDs from the import if they don't collide, but the DB might have them as String/UUID.
    // It's safer to just use the IDs as they come from the import since they are string IDs generated by React Flow (e.g. 'node-12345').
    // Wait, if we use the exact same ID, and another map already has that ID? No, Prisma Node model `id` is primary key, if it collides it fails.
    // We need to generate new UUIDs or React Flow IDs for the nodes, and map the old IDs to new IDs for the edges.
    const idMapping = {};
    for (const node of nodes) {
      const newNodeId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      idMapping[node.id] = newNodeId;

      await prisma.node.create({
        data: {
          id: newNodeId,
          mapId,
          type: node.type || 'concept',
          label: node.data?.label || node.label || '',
          xPos: parseFloat(node.position?.x) || 0,
          yPos: parseFloat(node.position?.y) || 0,
          content: node.data?.content || null
        }
      });
    }

    // 5. Handle Edges
    for (const edge of edges) {
      const sourceNodeId = idMapping[edge.source] || edge.source;
      const targetNodeId = idMapping[edge.target] || edge.target;
      
      const newEdgeId = `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      await prisma.edge.create({
        data: {
          id: newEdgeId,
          mapId,
          sourceNodeId,
          targetNodeId
        }
      });
    }
    
    // 6. Generate Embeddings (Optional, similar to updateMap)
    let embeddingStr = null;
    try {
      const nodeLabels = nodes.map(n => n.data?.label || n.label).filter(Boolean);
      const tagNames = tags?.map(t => t.name).join(', ') || '';
      const combinedText = `Title: ${newMap.title}\nTags: ${tagNames}\n\nConcepts: ${nodeLabels.join(', ')}`;
      const embedding = await aiService.generateEmbedding(combinedText);
      embeddingStr = `[${embedding.join(',')}]`;
    } catch (embError) {
      console.warn('Embedding generation warning during import:', embError);
    }

    if (embeddingStr) {
      await prisma.$queryRaw`
        UPDATE "Map"
        SET embedding = ${embeddingStr}::vector
        WHERE id = ${mapId}
      `;
    }

    res.status(201).json({
      mapId,
      mapTitle: newMap.title,
      nodeCount: nodes.length,
      edgeCount: edges.length
    });

  } catch (error) {
    console.error('Error importing map:', error);
    res.status(500).json({ error: 'Failed to import mind map.', details: [error.message] });
  }
};

module.exports = {
  getMaps,
  getMapById,
  createMap,
  updateMap,
  deleteMap,
  generateAiTitle,
  importMap
};
