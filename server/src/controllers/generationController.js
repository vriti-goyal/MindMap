const prisma = require('../config/prisma');
const documentService = require('../services/documentService');
const aiService = require('../services/aiService');

const generateMap = async (req, res) => {
  try {
    const userId = req.user.id; // assuming auth middleware
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

    // Process Document if present
    let extractedText = '';
    if (sourceType === 'PDF' && fileBuffer) {
      extractedText = await documentService.processPDF(fileBuffer);
    } else if (sourceType === 'Image' && fileBuffer) {
      extractedText = await documentService.processImage(fileBuffer, mimeType);
    } else if (sourceType === 'URL' && sourceUrl) {
      extractedText = await documentService.processURL(sourceUrl);
    } else if (sourceType === 'YouTube' && sourceUrl) {
      extractedText = await documentService.processYouTube(sourceUrl);
    }

    // Combine prompt and document text
    const combinedText = `Prompt: ${prompt || 'None'}\n\nDocument Text: ${extractedText}`;

    // 1. Generate embedding for similarity search
    const embedding = await aiService.generateEmbedding(combinedText);

    // 2. Similarity Search (pgvector)
    // pgvector uses <-> for L2 distance, <#> for inner product, <=> for cosine distance.
    // We'll use <=> for cosine distance. Let's find maps similar to this embedding.
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

    // If there are highly similar maps, we might return them as a suggestion
    // For now, let's just proceed to generate a new map but include the similarity info in response

    // 3. Generate map structure
    const mapData = await aiService.generateMapData(combinedText, mode);

    // 4. Save to DB without transaction to support Neon connection pooling
    const mapResult = await prisma.$queryRaw`
      INSERT INTO "Map" (id, "userId", title, "createdAt", "updatedAt", embedding)
      VALUES (gen_random_uuid(), ${userId}, ${prompt ? prompt.substring(0, 50) : 'Generated Map'}, NOW(), NOW(), ${embeddingStr}::vector)
      RETURNING id
    `;
    const mapId = mapResult[0].id;

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

    const newMap = mapId;

    res.status(201).json({
      message: 'Map generated successfully',
      mapId: newMap,
      similarExistingMaps: highlySimilar
    });

  } catch (error) {
    console.error('Generation Error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  generateMap
};
