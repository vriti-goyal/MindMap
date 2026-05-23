const prisma = require('../config/prisma');
const documentService = require('../services/documentService');
const aiService = require('../services/aiService');
const fs = require('fs').promises;
const path = require('path');

const generateMap = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { prompt, sourceType, sourceUrl, documentId } = req.body;
    let fileBuffer, mimeType;
    if (req.file) {
      fileBuffer = req.file.buffer;
      mimeType = req.file.mimetype;
    }

    // Determine Mode
    let mode = 'prompt';
    if (prompt && (sourceUrl || fileBuffer || documentId)) {
      mode = 'hybrid';
    } else if (sourceUrl || fileBuffer || documentId) {
      mode = 'upload';
    }

    // Process Document if present & persist it
    let extractedText = '';
    let savedDocument = null;

    if (documentId) {
      const existingDoc = await prisma.document.findUnique({
        where: { id: documentId }
      });
      if (existingDoc && existingDoc.userId === userId) {
        extractedText = existingDoc.contentText || '';
        savedDocument = existingDoc;
      }
    } else if (sourceType && sourceType !== 'None') {
      if (sourceType === 'PDF' && fileBuffer) {
        extractedText = await documentService.processPDF(fileBuffer);
      } else if (sourceType === 'Image' && fileBuffer) {
        extractedText = await documentService.processImage(fileBuffer, mimeType);
      } else if (sourceType === 'URL' && sourceUrl) {
        extractedText = await documentService.processURL(sourceUrl);
      } else if (sourceType === 'YouTube' && sourceUrl) {
        extractedText = await documentService.processYouTube(sourceUrl);
      }

      // Write memory buffer files to standard local uploads directory
      let storageUrl = sourceUrl || null;
      if (req.file) {
        const uploadsDir = path.join(__dirname, '../../uploads');
        await fs.mkdir(uploadsDir, { recursive: true });
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const fileName = `upload-${uniqueSuffix}${path.extname(req.file.originalname)}`;
        const filePath = path.join(uploadsDir, fileName);
        await fs.writeFile(filePath, fileBuffer);
        storageUrl = `uploads/${fileName}`;
      }

      savedDocument = await prisma.document.create({
        data: {
          userId,
          title: req.file ? req.file.originalname : (sourceUrl || `${sourceType} Source`),
          sourceType,
          storageUrl,
          contentText: extractedText
        }
      });
    }

    // Combine prompt and document text
    const combinedText = `Prompt: ${prompt || 'None'}\n\nDocument Text: ${extractedText}`;

    // 1. Generate embedding for similarity search
    const embedding = await aiService.generateEmbedding(combinedText);

    // 2. Similarity Search (pgvector)
    const embeddingStr = `[${embedding.join(',')}]`;
    const similarMaps = await prisma.$queryRaw`
      SELECT id, title, 1 - (embedding <=> ${embeddingStr}::vector) as similarity
      FROM "Map"
      WHERE "userId" = ${userId}
      AND embedding IS NOT NULL
      ORDER BY similarity DESC
      LIMIT 3
    `;

    // Filter by threshold if needed
    const threshold = 0.8;
    const highlySimilar = similarMaps.filter(m => m.similarity > threshold);

    // 3. Generate map structure
    const mapData = await aiService.generateMapData(combinedText, mode);

    // 4. Save to DB without transaction to support Neon connection pooling
    const mapResult = await prisma.$queryRaw`
      INSERT INTO "Map" (id, "userId", title, "createdAt", "updatedAt", embedding, tags)
      VALUES (gen_random_uuid(), ${userId}, ${prompt ? prompt.substring(0, 50) : 'Generated Map'}, NOW(), NOW(), ${embeddingStr}::vector, '')
      RETURNING id
    `;
    const mapId = mapResult[0].id;

    // Link the saved contributing document to the map in the database
    if (savedDocument) {
      await prisma.documentMapAttachment.create({
        data: {
          documentId: savedDocument.id,
          mapId: mapId
        }
      });
    }

    // Calculate bounding box and check for node clustering
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    mapData.nodes.forEach(n => {
      const x = parseFloat(n.xPos) || 0;
      const y = parseFloat(n.yPos) || 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    const width = maxX - minX;
    const height = maxY - minY;
    
    // Scale up coordinates if they are clustered or specified in a tiny scale
    let multiplierX = 1;
    let multiplierY = 1;
    
    if (width > 0 && width < 10) {
      multiplierX = 350;
    } else if (width > 0 && width < 250) {
      multiplierX = 2.5;
    }
    
    if (height > 0 && height < 10) {
      multiplierY = 250;
    } else if (height > 0 && height < 150) {
      multiplierY = 2.0;
    }

    // Save nodes (applying defensive spreading if clustered around 0)
    const nodePromises = mapData.nodes.map((node, index) => {
      let x = parseFloat(node.xPos) || 0;
      let y = parseFloat(node.yPos) || 0;
      
      // If coordinates are too clustered or identical, lay them out in a gorgeous radial tree
      if (width < 50 && height < 50) {
        if (index === 0) {
          x = 250;
          y = 250;
        } else {
          const angle = ((index - 1) * (2 * Math.PI)) / (mapData.nodes.length - 1);
          const radius = 350;
          x = 250 + Math.cos(angle) * radius;
          y = 250 + Math.sin(angle) * radius;
        }
      } else {
        // Otherwise apply spacing multipliers
        x = x * multiplierX;
        y = y * multiplierY;
      }

      return prisma.node.create({
        data: {
          mapId,
          type: node.type || 'concept',
          label: node.label,
          xPos: x,
          yPos: y,
          content: node.content
        }
      });
    });
    const savedNodes = await Promise.all(nodePromises);

    // Save edges
    const aiIdToDbId = {};
    mapData.nodes.forEach((node, index) => {
      aiIdToDbId[node.id] = savedNodes[index].id;
    });

    const edgePromises = mapData.edges.map(edge => {
      return prisma.edge.create({
        data: {
          mapId,
          sourceNodeId: aiIdToDbId[edge.sourceNodeId],
          targetNodeId: aiIdToDbId[edge.targetNodeId]
        }
      });
    });
    await Promise.all(edgePromises);

    res.status(201).json({
      message: 'Map generated successfully',
      mapId,
      similarExistingMaps: highlySimilar
    });

  } catch (error) {
    console.error('Generation Error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Rapid Similarity pre-check endpoint. Matches vector embeddings using pgvector.
 */
const checkSimilarity = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { prompt, sourceType, sourceUrl, documentId } = req.body;
    let fileBuffer, mimeType;
    if (req.file) {
      fileBuffer = req.file.buffer;
      mimeType = req.file.mimetype;
    }

    // Process Document if present to get content text
    let extractedText = '';
    if (documentId) {
      const existingDoc = await prisma.document.findUnique({
        where: { id: documentId }
      });
      if (existingDoc && existingDoc.userId === userId) {
        extractedText = existingDoc.contentText || '';
      }
    } else if (sourceType && sourceType !== 'None') {
      if (sourceType === 'PDF' && fileBuffer) {
        extractedText = await documentService.processPDF(fileBuffer);
      } else if (sourceType === 'Image' && fileBuffer) {
        extractedText = await documentService.processImage(fileBuffer, mimeType);
      } else if (sourceType === 'URL' && sourceUrl) {
        extractedText = await documentService.processURL(sourceUrl);
      } else if (sourceType === 'YouTube' && sourceUrl) {
        extractedText = await documentService.processYouTube(sourceUrl);
      }
    }

    const combinedText = `Prompt: ${prompt || 'None'}\n\nDocument Text: ${extractedText}`;

    // 1. Generate embedding
    const embedding = await aiService.generateEmbedding(combinedText);
    const embeddingStr = `[${embedding.join(',')}]`;

    // 2. Similarity Search (pgvector)
    const similarMaps = await prisma.$queryRaw`
      SELECT id, title, 1 - (embedding <=> ${embeddingStr}::vector) as similarity
      FROM "Map"
      WHERE "userId" = ${userId}
      AND embedding IS NOT NULL
      ORDER BY similarity DESC
      LIMIT 3
    `;

    // Filter by threshold (70%)
    const threshold = 0.7;
    const highlySimilar = similarMaps.filter(m => m.similarity > threshold);

    res.json({
      similarExistingMaps: highlySimilar
    });

  } catch (error) {
    console.error('Similarity Precheck Error:', error);
    res.status(500).json({ error: error.message });
  }
};

const regenerateMap = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { mapId } = req.params;
    const { prompt, sourceType, sourceUrl, documentId } = req.body;
    let fileBuffer, mimeType;
    if (req.file) {
      fileBuffer = req.file.buffer;
      mimeType = req.file.mimetype;
    }

    // Verify map ownership
    const existingMap = await prisma.map.findUnique({
      where: { id: mapId }
    });

    if (!existingMap || existingMap.userId !== userId) {
      return res.status(404).json({ error: 'Map not found or unauthorized' });
    }

    // Determine Mode
    let mode = 'prompt';
    if (prompt && (sourceUrl || fileBuffer || documentId)) {
      mode = 'hybrid';
    } else if (sourceUrl || fileBuffer || documentId) {
      mode = 'upload';
    }

    // Process Document if present & persist it
    let extractedText = '';
    let savedDocument = null;

    if (documentId) {
      const existingDoc = await prisma.document.findUnique({
        where: { id: documentId }
      });
      if (existingDoc && existingDoc.userId === userId) {
        extractedText = existingDoc.contentText || '';
        savedDocument = existingDoc;
      }
    } else if (sourceType && sourceType !== 'None') {
      if (sourceType === 'PDF' && fileBuffer) {
        extractedText = await documentService.processPDF(fileBuffer);
      } else if (sourceType === 'Image' && fileBuffer) {
        extractedText = await documentService.processImage(fileBuffer, mimeType);
      } else if (sourceType === 'URL' && sourceUrl) {
        extractedText = await documentService.processURL(sourceUrl);
      } else if (sourceType === 'YouTube' && sourceUrl) {
        extractedText = await documentService.processYouTube(sourceUrl);
      }

      // Write memory buffer files to standard local uploads directory
      let storageUrl = sourceUrl || null;
      if (req.file) {
        const uploadsDir = path.join(__dirname, '../../uploads');
        await fs.mkdir(uploadsDir, { recursive: true });
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const fileName = `upload-${uniqueSuffix}${path.extname(req.file.originalname)}`;
        const filePath = path.join(uploadsDir, fileName);
        await fs.writeFile(filePath, fileBuffer);
        storageUrl = `uploads/${fileName}`;
      }

      savedDocument = await prisma.document.create({
        data: {
          userId,
          title: req.file ? req.file.originalname : (sourceUrl || `${sourceType} Source`),
          sourceType,
          storageUrl,
          contentText: extractedText
        }
      });
    }

    // Combine prompt and document text
    const combinedText = `Prompt: ${prompt || 'None'}\n\nDocument Text: ${extractedText}`;

    // 1. Generate embedding
    const embedding = await aiService.generateEmbedding(combinedText);
    const embeddingStr = `[${embedding.join(',')}]`;

    // 2. Generate map structure
    const mapData = await aiService.generateMapData(combinedText, mode);

    // 3. Clear old nodes and edges
    await prisma.edge.deleteMany({ where: { mapId } });
    await prisma.node.deleteMany({ where: { mapId } });

    // 4. Update Map Title and Embedding
    const newTitle = prompt ? prompt.substring(0, 50) : (savedDocument ? savedDocument.title : 'Regenerated Map');
    await prisma.$queryRaw`
      UPDATE "Map"
      SET title = ${newTitle}, embedding = ${embeddingStr}::vector, "updatedAt" = NOW()
      WHERE id = ${mapId}
    `;

    // Link the saved contributing document to the map in the database
    if (savedDocument) {
      await prisma.documentMapAttachment.upsert({
        where: {
          documentId_mapId: {
            documentId: savedDocument.id,
            mapId: mapId
          }
        },
        update: {},
        create: {
          documentId: savedDocument.id,
          mapId: mapId
        }
      });
    } else if (documentId) {
      await prisma.documentMapAttachment.upsert({
        where: {
          documentId_mapId: {
            documentId: documentId,
            mapId: mapId
          }
        },
        update: {},
        create: {
          documentId: documentId,
          mapId: mapId
        }
      });
    }

    // Calculate bounding box and check for node clustering
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    mapData.nodes.forEach(n => {
      const x = parseFloat(n.xPos) || 0;
      const y = parseFloat(n.yPos) || 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    const width = maxX - minX;
    const height = maxY - minY;
    
    // Scale up coordinates if they are clustered or specified in a tiny scale
    let multiplierX = 1;
    let multiplierY = 1;
    
    if (width > 0 && width < 10) {
      multiplierX = 350;
    } else if (width > 0 && width < 250) {
      multiplierX = 2.5;
    }
    
    if (height > 0 && height < 10) {
      multiplierY = 250;
    } else if (height > 0 && height < 150) {
      multiplierY = 2.0;
    }

    // Save nodes
    const nodePromises = mapData.nodes.map((node, index) => {
      let x = parseFloat(node.xPos) || 0;
      let y = parseFloat(node.yPos) || 0;
      
      // If coordinates are too clustered or identical, lay them out in a gorgeous radial tree
      if (width < 50 && height < 50) {
        if (index === 0) {
          x = 250;
          y = 250;
        } else {
          const angle = ((index - 1) * (2 * Math.PI)) / (mapData.nodes.length - 1);
          const radius = 350;
          x = 250 + Math.cos(angle) * radius;
          y = 250 + Math.sin(angle) * radius;
        }
      } else {
        // Otherwise apply spacing multipliers
        x = x * multiplierX;
        y = y * multiplierY;
      }

      return prisma.node.create({
        data: {
          mapId,
          type: node.type || 'concept',
          label: node.label,
          xPos: x,
          yPos: y,
          content: node.content
        }
      });
    });
    const savedNodes = await Promise.all(nodePromises);

    // Save edges
    const aiIdToDbId = {};
    mapData.nodes.forEach((node, index) => {
      aiIdToDbId[node.id] = savedNodes[index].id;
    });

    const edgePromises = mapData.edges.map(edge => {
      return prisma.edge.create({
        data: {
          mapId,
          sourceNodeId: aiIdToDbId[edge.sourceNodeId],
          targetNodeId: aiIdToDbId[edge.targetNodeId]
        }
      });
    });
    await Promise.all(edgePromises);

    res.status(200).json({
      message: 'Map regenerated successfully',
      mapId
    });

  } catch (error) {
    console.error('Regeneration Error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  generateMap,
  checkSimilarity,
  regenerateMap
};
