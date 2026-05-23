const prisma = require('../config/prisma');
const documentService = require('../services/documentService');
const fs = require('fs').promises;
const path = require('path');
const aiService = require('../services/aiService');

/**
 * Upload a document (PDF, Image, URL, or YouTube).
 * MapId is optional. If provided, attaches the document to the map in the junction table.
 */
const uploadDocument = async (req, res) => {
  try {
    const { title, sourceType, mapId } = req.body;
    const userId = req.user.userId;

    if (!title || !sourceType) {
      return res.status(400).json({ error: 'Title and sourceType are required' });
    }

    let storageUrl = null;
    let contentText = 'Pending extraction...';

    // 1. Process files (PDF, Image)
    if (req.file) {
      storageUrl = `uploads/${req.file.filename}`;

      try {
        const fileBuffer = await fs.readFile(req.file.path);
        if (sourceType === 'PDF') {
          contentText = await documentService.processPDF(fileBuffer);
        } else if (sourceType === 'Image') {
          contentText = await documentService.processImage(fileBuffer, req.file.mimetype);
        }
      } catch (parseErr) {
        console.error('Text extraction failed during upload:', parseErr);
        // We'll keep the text as 'Pending extraction...' if it fails
      }
    } 
    // 2. Process URLs and YouTube links
    else {
      const { url } = req.body;
      if (url && (sourceType === 'URL' || sourceType === 'YouTube')) {
        storageUrl = url;
        try {
          if (sourceType === 'URL') {
            contentText = await documentService.processURL(url);
          } else if (sourceType === 'YouTube') {
            contentText = await documentService.processYouTube(url);
          }
        } catch (parseErr) {
          console.error('Text extraction failed during link upload:', parseErr);
        }
      } else if (sourceType !== 'None') {
        return res.status(400).json({ error: 'File or URL is required based on sourceType' });
      }
    }

    const cleanMapId = (mapId && mapId !== 'undefined' && mapId !== 'null' && mapId !== '') ? mapId : null;

    // 3. Save Document to database
    const document = await prisma.document.create({
      data: {
        userId,
        title,
        sourceType,
        storageUrl,
        contentText,
        mapId: cleanMapId
      }
    });

    // 4. Attach to Map if cleanMapId provided
    let mapsAttachedTo = [];
    if (cleanMapId) {
      // Verify map ownership
      const map = await prisma.map.findUnique({
        where: { id: cleanMapId }
      });

      if (!map || map.userId !== userId) {
        return res.status(404).json({ error: 'Associated map not found or unauthorized' });
      }

      await prisma.documentMapAttachment.create({
        data: {
          documentId: document.id,
          mapId: map.id
        }
      });

      mapsAttachedTo.push({
        id: map.id,
        title: map.title
      });
    }

    res.status(201).json({
      documentId: document.id,
      name: document.title,
      type: document.sourceType,
      url: document.storageUrl,
      uploadedAt: document.createdAt,
      mapsAttachedTo
    });

  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Fetch all documents belonging to the authenticated user with filters, pagination, and sorting.
 */
const getDocuments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type, page = 1, limit = 20, sort = 'date_desc' } = req.query;

    const where = { userId };
    
    // Type filtering
    if (type) {
      if (type === 'pdf') where.sourceType = 'PDF';
      else if (type === 'image') where.sourceType = 'Image';
      else if (type === 'url') where.sourceType = 'URL';
      else if (type === 'video') where.sourceType = 'YouTube';
    }

    // Sorting
    const orderBy = sort === 'date_asc' ? { createdAt: 'asc' } : { createdAt: 'desc' };

    // Fetch documents
    const documents = await prisma.document.findMany({
      where,
      include: {
        mapAttachments: {
          include: {
            map: {
              select: {
                id: true,
                title: true
              }
            }
          }
        },
        map: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy,
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });

    // Format list
    const formattedDocs = documents.map(doc => {
      const junctionMaps = doc.mapAttachments.map(att => att.map);
      const legacyMap = doc.map ? [doc.map] : [];
      
      const allMapsMap = new Map();
      [...junctionMaps, ...legacyMap].forEach(m => {
        allMapsMap.set(m.id, m);
      });
      
      const mergedMaps = Array.from(allMapsMap.values());

      return {
        id: doc.id,
        name: doc.title,
        type: doc.sourceType,
        url: doc.storageUrl,
        uploadedAt: doc.createdAt,
        usedInMapsCount: mergedMaps.length,
        mapsAttachedTo: mergedMaps.map(m => ({
          id: m.id,
          title: m.title
        }))
      };
    });

    res.json(formattedDocs);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Attach a pre-uploaded document to a map manually.
 */
const attachDocument = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { documentId, mapId } = req.body;

    if (!documentId || !mapId) {
      return res.status(400).json({ error: 'DocumentId and mapId are required' });
    }

    // Validate document ownership
    const doc = await prisma.document.findUnique({
      where: { id: documentId }
    });
    if (!doc || doc.userId !== userId) {
      return res.status(404).json({ error: 'Document not found or unauthorized' });
    }

    // Validate map ownership
    const map = await prisma.map.findUnique({
      where: { id: mapId }
    });
    if (!map || map.userId !== userId) {
      return res.status(404).json({ error: 'Map not found or unauthorized' });
    }

    // Insert record in junction table (upsert to prevent unique constraint failures)
    await prisma.documentMapAttachment.upsert({
      where: {
        documentId_mapId: {
          documentId,
          mapId
        }
      },
      create: {
        documentId,
        mapId
      },
      update: {}
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Attach document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete a document from the database and storage.
 * Aborts if the document is linked/used in any maps.
 */
const deleteDocument = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    // Validate document ownership
    const doc = await prisma.document.findUnique({
      where: { id }
    });
    if (!doc || doc.userId !== userId) {
      return res.status(404).json({ error: 'Document not found or unauthorized' });
    }

    // Check if document is linked in any maps
    const attachments = await prisma.documentMapAttachment.findMany({
      where: { documentId: id },
      include: {
        map: {
          select: { id: true, title: true }
        }
      }
    });

    const junctionMaps = attachments.map(a => a.map);
    const legacyMap = doc.mapId ? [await prisma.map.findUnique({ where: { id: doc.mapId }, select: { id: true, title: true } })].filter(Boolean) : [];

    const allMapsMap = new Map();
    [...junctionMaps, ...legacyMap].forEach(m => {
      allMapsMap.set(m.id, m);
    });
    
    const mergedMaps = Array.from(allMapsMap.values());

    if (mergedMaps.length > 0) {
      return res.status(409).json({
        usedInMaps: mergedMaps.map(m => ({
          id: m.id,
          title: m.title
        }))
      });
    }

    // Delete local storage file if present
    if (doc.storageUrl && !doc.storageUrl.startsWith('http')) {
      const filePath = path.join(__dirname, '../../', doc.storageUrl);
      await fs.unlink(filePath).catch(err => {
        console.warn('Physical file deletion warning:', err.message);
      });
    }

    // Delete document record
    await prisma.document.delete({
      where: { id }
    });

    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const exploreSimilarity = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sourceType, url } = req.body;
    let fileBuffer, mimeType;
    
    if (req.file) {
      fileBuffer = req.file.buffer;
      mimeType = req.file.mimetype;
    }

    let extractedText = '';
    
    // Process Document
    if (sourceType === 'PDF' && fileBuffer) {
      extractedText = await documentService.processPDF(fileBuffer);
    } else if (sourceType === 'Image' && fileBuffer) {
      extractedText = await documentService.processImage(fileBuffer, mimeType);
    } else if (sourceType === 'URL' && url) {
      extractedText = await documentService.processURL(url);
    } else if (sourceType === 'YouTube' && url) {
      extractedText = await documentService.processYouTube(url);
    } else {
      return res.status(400).json({ error: 'Valid file or URL with sourceType is required' });
    }

    // Generate embedding
    const embedding = await aiService.generateEmbedding(extractedText);
    const embeddingStr = `[${embedding.join(',')}]`;

    // Query similar documents using raw SQL for pgvector
    const similarDocs = await prisma.$queryRaw`
      SELECT id, title as name, "sourceType" as type, "storageUrl" as url, "createdAt" as "uploadedAt", 1 - (embedding <=> ${embeddingStr}::vector) AS "similarityScore"
      FROM "Document"
      WHERE "userId" = ${userId}
      AND embedding IS NOT NULL
      ORDER BY "similarityScore" DESC
      LIMIT 10
    `;

    if (!similarDocs || similarDocs.length === 0) {
      return res.json({
        similarDocuments: [],
        message: "No uploaded documents to compare against yet."
      });
    }

    res.json({
      similarDocuments: similarDocs
    });

  } catch (error) {
    console.error('Explore similarity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const saveAndCreateMap = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, sourceType, url, selectedDocumentIds, prompt } = req.body;
    let fileBuffer, mimeType;
    
    if (req.file) {
      fileBuffer = req.file.buffer;
      mimeType = req.file.mimetype;
    }

    // 1. Permanently save the query document
    let extractedText = '';
    let storageUrl = null;

    if (sourceType === 'PDF' && fileBuffer) {
      extractedText = await documentService.processPDF(fileBuffer);
    } else if (sourceType === 'Image' && fileBuffer) {
      extractedText = await documentService.processImage(fileBuffer, mimeType);
    } else if (sourceType === 'URL' && url) {
      extractedText = await documentService.processURL(url);
      storageUrl = url;
    } else if (sourceType === 'YouTube' && url) {
      extractedText = await documentService.processYouTube(url);
      storageUrl = url;
    } else {
      return res.status(400).json({ error: 'Valid file or URL with sourceType is required' });
    }

    if (req.file) {
      const uploadsDir = path.join(__dirname, '../../uploads');
      await fs.mkdir(uploadsDir, { recursive: true });
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const fileName = `upload-${uniqueSuffix}${path.extname(req.file.originalname)}`;
      const filePath = path.join(uploadsDir, fileName);
      await fs.writeFile(filePath, fileBuffer);
      storageUrl = `uploads/${fileName}`;
    }

    // Generate doc embedding
    const docEmbedding = await aiService.generateEmbedding(extractedText);
    const docEmbeddingStr = `[${docEmbedding.join(',')}]`;

    // Save to DB via raw query so we can insert the embedding vector
    const savedDocResult = await prisma.$queryRaw`
      INSERT INTO "Document" (id, "userId", title, "sourceType", "storageUrl", "contentText", "createdAt", embedding)
      VALUES (gen_random_uuid(), ${userId}, ${title || (req.file ? req.file.originalname : 'Upload')}, ${sourceType}, ${storageUrl}, ${extractedText}, NOW(), ${docEmbeddingStr}::vector)
      RETURNING id, title
    `;
    const savedDocument = savedDocResult[0];

    // 2. Fetch selected documents
    let ids = [];
    if (selectedDocumentIds) {
      try {
        ids = JSON.parse(selectedDocumentIds);
      } catch (e) {
        if (Array.isArray(selectedDocumentIds)) ids = selectedDocumentIds;
        else if (typeof selectedDocumentIds === 'string') ids = [selectedDocumentIds];
      }
    }

    const selectedDocs = await prisma.document.findMany({
      where: {
        id: { in: ids },
        userId: userId
      }
    });

    let combinedText = '';
    if (prompt) combinedText += `Prompt: ${prompt}\n\n`;
    
    selectedDocs.forEach((doc, idx) => {
      combinedText += `Document ${idx + 1} (${doc.title}):\n${doc.contentText}\n\n`;
    });
    combinedText += `New Document (${savedDocument.title}):\n${extractedText}\n\n`;

    // 3. Generate Map Data
    let mode = prompt ? 'hybrid' : 'upload';
    
    // Map embedding
    const mapEmbedding = await aiService.generateEmbedding(combinedText);
    const mapEmbeddingStr = `[${mapEmbedding.join(',')}]`;

    // Map AI structure
    const mapData = await aiService.generateMapData(combinedText, mode);

    // Save Map
    const mapTitle = prompt ? prompt.substring(0, 50) : 'Generated Map';
    const mapResult = await prisma.$queryRaw`
      INSERT INTO "Map" (id, "userId", title, "createdAt", "updatedAt", embedding, tags)
      VALUES (gen_random_uuid(), ${userId}, ${mapTitle}, NOW(), NOW(), ${mapEmbeddingStr}::vector, '')
      RETURNING id
    `;
    const mapId = mapResult[0].id;

    // Attach all documents
    const attachPromises = [...selectedDocs.map(d => d.id), savedDocument.id].map(docId => {
      return prisma.documentMapAttachment.create({
        data: {
          documentId: docId,
          mapId: mapId
        }
      });
    });
    await Promise.all(attachPromises);

    // Save nodes and edges
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

    const nodePromises = mapData.nodes.map((node, index) => {
      let x = parseFloat(node.xPos) || 0;
      let y = parseFloat(node.yPos) || 0;
      
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
      mapId,
      mapTitle
    });

  } catch (error) {
    console.error('Save and create map error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  uploadDocument,
  getDocuments,
  attachDocument,
  deleteDocument,
  exploreSimilarity,
  saveAndCreateMap
};
