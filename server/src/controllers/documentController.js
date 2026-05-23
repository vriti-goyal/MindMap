const prisma = require('../config/prisma');

const uploadDocument = async (req, res) => {
  try {
    const { title, sourceType } = req.body;
    const userId = req.user.userId;

    if (!title || !sourceType) {
      return res.status(400).json({ error: 'Title and sourceType are required' });
    }

    // Handle file upload (PDF, Image)
    if (req.file) {
      const document = await prisma.document.create({
        data: {
          userId,
          title,
          sourceType,
          storageUrl: req.file.path, // Temporary local path
          contentText: 'Pending extraction...' // We'll extract this later
        }
      });
      return res.status(201).json({ message: 'File uploaded successfully', document });
    }

    // Handle URL or YouTube source type
    const { url } = req.body;
    if (url && (sourceType === 'URL' || sourceType === 'YouTube')) {
      const document = await prisma.document.create({
        data: {
          userId,
          title,
          sourceType,
          storageUrl: url,
          contentText: 'Pending extraction...'
        }
      });
      return res.status(201).json({ message: 'URL saved successfully', document });
    }

    return res.status(400).json({ error: 'File or URL is required based on sourceType' });

  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getDocuments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const documents = await prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(documents);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  uploadDocument,
  getDocuments
};
