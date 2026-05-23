const prisma = require('../config/prisma');
const documentService = require('../services/documentService');
const aiService = require('../services/aiService');
const fs = require('fs').promises;
const path = require('path');

const generateMap = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { prompt, sourceType, sourceUrl } = req.body;
    let fileBuffer, mimeType;
    if (req.file) {
      fileBuffer = req.file.buffer;
      mimeType = req.file.mimetype;
    }

    // Determine Mode
    let mode = 'prompt';
    if (prompt && (sourceUrl || fileBuffer)) {
      mode = 'hybrid';
    } else if (sourceUrl || fileBuffer) {
      mode = 'upload';
    }

    // Process Document if present & persist it
    let extractedText = '';
    let savedDocument = null;

    if (sourceType && sourceType !== 'None') {
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
      await prisma.map.update({
        where: { id: mapId },
        data: {
          documents: {
            connect: { id: savedDocument.id }
          }
        }
      });
    }

    // Save nodes
    const nodePromises = mapData.nodes.map(node => {
      return prisma.node.create({
        data: {
          mapId,
          type: node.type || 'concept',
          label: node.label,
          xPos: parseFloat(node.xPos) || 0,
          yPos: parseFloat(node.yPos) || 0,
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
    const { prompt, sourceType, sourceUrl } = req.body;
    let fileBuffer, mimeType;
    if (req.file) {
      fileBuffer = req.file.buffer;
      mimeType = req.file.mimetype;
    }

    // Process Document if present to get content text
    let extractedText = '';
    if (sourceType && sourceType !== 'None') {
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

module.exports = {
  generateMap,
  checkSimilarity
};
