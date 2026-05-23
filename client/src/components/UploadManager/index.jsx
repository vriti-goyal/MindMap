import React, { useState, useRef } from 'react';
import axios from 'axios';
import { 
  Upload, 
  X, 
  FileText, 
  Globe, 
  Video, 
  ImageIcon, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Plus, 
  Trash2,
  Link as LinkIcon
} from 'lucide-react';

const UploadManager = ({ context = 'standalone', mapId = '', singleFile = false, onUploadComplete, onClose, onQueueChange }) => {
  const [queue, setQueue] = useState([]);
  const [linkInput, setLinkInput] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Parse link type (YouTube vs General Web URL)
  const getLinkType = (url) => {
    try {
      const parsed = new URL(url);
      if (
        parsed.hostname.includes('youtube.com') || 
        parsed.hostname.includes('youtu.be')
      ) {
        return 'YouTube';
      }
      return 'URL';
    } catch (e) {
      return 'URL';
    }
  };

  // Add files to upload queue
  const addFilesToQueue = (files) => {
    let newItems = Array.from(files).map(file => {
      let sourceType = 'Image';
      if (file.type === 'application/pdf') {
        sourceType = 'PDF';
      }

      return {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        name: file.name,
        type: sourceType,
        url: null,
        progress: 0,
        status: 'queued',
        error: null
      };
    });

    if (singleFile) {
      newItems = [newItems[0]];
      setQueue(newItems);
      if (onQueueChange) onQueueChange(newItems);
    } else {
      setQueue(prev => {
        const next = [...prev, ...newItems];
        if (onQueueChange) onQueueChange(next);
        return next;
      });
    }
  };

  // Add website link or YouTube URL to queue
  const handleAddLink = (e) => {
    e.preventDefault();
    if (!linkInput.trim()) return;

    let urlStr = linkInput.trim();
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
      urlStr = 'https://' + urlStr;
    }

    const detectedType = getLinkType(urlStr);
    const title = linkTitle.trim() || `${detectedType} Source (${new URL(urlStr).hostname})`;

    const newItem = {
      id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file: null,
      name: title,
      type: detectedType,
      url: urlStr,
      progress: 0,
      status: 'queued',
      error: null
    };

    if (singleFile) {
      const next = [newItem];
      setQueue(next);
      if (onQueueChange) onQueueChange(next);
    } else {
      setQueue(prev => {
        const next = [...prev, newItem];
        if (onQueueChange) onQueueChange(next);
        return next;
      });
    }
    setLinkInput('');
    setLinkTitle('');
  };

  // Drag and Drop Handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      // Filter allowed files
      const allowedFiles = Array.from(e.dataTransfer.files).filter(file => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        return allowedTypes.includes(file.type);
      });
      addFilesToQueue(allowedFiles);
    }
  };

  // Remove item from queue
  const handleRemoveItem = (id) => {
    if (uploading) return;
    setQueue(prev => {
      const next = prev.filter(item => item.id !== id);
      if (onQueueChange) onQueueChange(next);
      return next;
    });
  };

  // sequential upload runner
  const handleUploadAll = async () => {
    const pendingItems = queue.filter(item => item.status === 'queued' || item.status === 'error');
    if (pendingItems.length === 0) return;

    setUploading(true);
    const uploadedDocs = [];

    for (const item of pendingItems) {
      // 1. Mark item as uploading
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading', progress: 10 } : q));

      try {
        const formData = new FormData();
        
        if (item.file) {
          formData.append('file', item.file);
          formData.append('title', item.name);
          formData.append('sourceType', item.type);
        } else {
          formData.append('url', item.url);
          formData.append('title', item.name);
          formData.append('sourceType', item.type);
        }

        if (mapId) {
          formData.append('mapId', mapId);
        }

        // Simulate upload progress
        const response = await axios.post('/documents/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, progress: Math.min(pct, 90) } : q));
          }
        });

        // 2. Mark item as processing text extraction
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing', progress: 95 } : q));
        
        // Brief artificial pause to indicate Gemini text digest extraction
        await new Promise(resolve => setTimeout(resolve, 800));

        // 3. Mark ready
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'ready', progress: 100 } : q));
        uploadedDocs.push(response.data);

      } catch (err) {
        console.error('Failed uploading item:', item.name, err);
        const errMsg = err.response?.data?.error || 'Upload failed. Please try again.';
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', progress: 0, error: errMsg } : q));
      }
    }

    setUploading(false);
    
    // Auto call onUploadComplete if any items succeeded
    if (uploadedDocs.length > 0 && onUploadComplete) {
      onUploadComplete(uploadedDocs);
    }
  };

  // Queue icon mapping
  const getItemIcon = (type) => {
    switch (type) {
      case 'PDF': return <FileText className="w-5 h-5 text-red-500" />;
      case 'Image': return <ImageIcon className="w-5 h-5 text-blue-500" />;
      case 'URL': return <Globe className="w-5 h-5 text-green-500" />;
      case 'YouTube': return <Video className="w-5 h-5 text-purple-500" />;
      default: return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  // Render Status Badge
  const renderStatus = (item) => {
    switch (item.status) {
      case 'queued':
        return <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-md border border-gray-700">Queued</span>;
      case 'uploading':
        return (
          <span className="text-[10px] bg-blue-950/40 text-blue-400 px-2 py-0.5 rounded-md border border-blue-900/30 flex items-center">
            <Loader2 className="w-2.5 h-2.5 animate-spin mr-1 text-blue-400" />
            Uploading ({item.progress}%)
          </span>
        );
      case 'processing':
        return (
          <span className="text-[10px] bg-yellow-950/40 text-yellow-400 px-2 py-0.5 rounded-md border border-yellow-900/30 flex items-center">
            <Loader2 className="w-2.5 h-2.5 animate-spin mr-1 text-yellow-400" />
            Digest (AI)...
          </span>
        );
      case 'ready':
        return (
          <span className="text-[10px] bg-emerald-950/40 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-900/30 flex items-center">
            <CheckCircle className="w-2.5 h-2.5 mr-1 text-emerald-400" />
            Ready
          </span>
        );
      case 'error':
        return (
          <span 
            className="text-[10px] bg-rose-950/40 text-rose-400 px-2 py-0.5 rounded-md border border-rose-900/30 flex items-center cursor-help"
            title={item.error}
          >
            <AlertCircle className="w-2.5 h-2.5 mr-1 text-rose-400" />
            Error
          </span>
        );
      default:
        return null;
    }
  };

  // Base Upload UI contents
  const uploadContent = (
    <div className="space-y-6">
      
      {/* File Upload Zone */}
      <div 
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all relative ${
          dragActive 
            ? 'border-purple-500 bg-purple-500/5' 
            : 'border-gray-800 bg-gray-950/20 hover:border-purple-500/40 hover:bg-gray-900/10'
        }`}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={(e) => addFilesToQueue(e.target.files)}
          multiple={!singleFile}
          accept=".pdf,image/*"
          className="hidden" 
        />
        
        <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
        <span className="text-sm font-semibold text-gray-200 block">
          Drag and drop files here, or <span className="text-purple-400 underline">browse</span>
        </span>
        <span className="text-[10px] text-gray-500 mt-1.5 block">
          Accepts PDF and standard images (PNG, JPG, WEBP, GIF) up to 10MB each
        </span>
      </div>

      {/* Link Inputs Panel */}
      <form onSubmit={handleAddLink} className="bg-gray-950/40 border border-gray-800 rounded-2xl p-4.5 space-y-3">
        <div className="flex items-center space-x-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
          <LinkIcon className="w-3.5 h-3.5 text-purple-500" />
          <span>Add URL or YouTube Link</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <input
            type="url"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="https://example.com/article or YouTube video URL..."
            className="bg-gray-950 border border-gray-800 focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none w-full"
          />
          <input
            type="text"
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            placeholder="Link title / name (optional)..."
            className="bg-gray-950 border border-gray-800 focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none w-full"
          />
        </div>
        <button
          type="submit"
          disabled={!linkInput.trim()}
          className="w-full py-2 bg-gray-900 border border-gray-800 hover:bg-purple-600 hover:border-purple-500 text-xs font-bold text-gray-300 hover:text-white rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-40 disabled:hover:bg-gray-900 disabled:hover:border-gray-800 disabled:hover:text-gray-300 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Link to Queue</span>
        </button>
      </form>

      {/* Multi-File Upload Queue list */}
      {queue.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-400 border-b border-gray-800 pb-1.5 font-bold uppercase tracking-wider">
            <span>Upload Queue ({queue.length})</span>
            <button 
              onClick={() => {
                setQueue([]);
                if (onQueueChange) onQueueChange([]);
              }} 
              disabled={uploading}
              className="text-[10px] text-gray-500 hover:text-rose-400 flex items-center cursor-pointer disabled:opacity-50"
            >
              Clear Queue
            </button>
          </div>

          <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
            {queue.map((item) => (
              <div 
                key={item.id}
                className="bg-gray-950 border border-gray-900 hover:border-gray-800 p-3 rounded-xl flex flex-col space-y-2 transition-colors relative"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5 min-w-0 mr-3">
                    <span className="p-1.5 bg-gray-900 border border-gray-800 rounded-lg flex-shrink-0">
                      {getItemIcon(item.type)}
                    </span>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white block truncate" title={item.name}>
                        {item.name}
                      </span>
                      <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">{item.type}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2.5 flex-shrink-0">
                    {renderStatus(item)}
                    
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={uploading}
                      className="p-1 hover:bg-gray-800 text-gray-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {(item.status === 'uploading' || item.status === 'processing' || item.status === 'ready') && (
                  <div className="w-full bg-gray-900 h-1 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        item.status === 'ready' 
                          ? 'bg-emerald-500' 
                          : item.status === 'processing' 
                          ? 'bg-yellow-500' 
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Master upload submit trigger */}
          <button
            onClick={handleUploadAll}
            disabled={uploading || queue.every(q => q.status === 'ready')}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-bold text-white shadow-xl shadow-purple-500/10 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Processing Sequence...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Start Uploading Queue</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );

  // RENDER PER CONTEXT
  if (context === 'map-editor') {
    // slide in drawer right layout
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop overlay */}
        <div 
          onClick={onClose}
          className="absolute inset-0 bg-gray-950/70 backdrop-blur-sm transition-opacity" 
        />
        
        {/* Sliding Panel */}
        <div className="w-full sm:w-[380px] h-full bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col relative z-10 transition-transform duration-300 transform translate-x-0">
          <div className="px-5 py-4.5 border-b border-gray-800 flex justify-between items-center bg-gray-950/20">
            <h3 className="text-md font-bold text-white flex items-center">
              <Upload className="w-4.5 h-4.5 text-purple-400 mr-2" />
              Add Documents to Map
            </h3>
            <button 
              onClick={onClose}
              disabled={uploading}
              className="p-1 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {uploadContent}
          </div>
        </div>
      </div>
    );
  }

  if (context === 'map-creation') {
    // Embedded inline inside dashboard form layout
    return (
      <div className="border border-gray-850 p-5 rounded-2xl bg-gray-950/10 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">
          Attach & Process Knowledge Sources
        </h4>
        {uploadContent}
      </div>
    );
  }

  // default / standalone card
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl">
      <div className="flex justify-between items-center mb-5 border-b border-gray-800 pb-3">
        <h3 className="text-lg font-bold text-white flex items-center">
          <Upload className="w-5 h-5 text-purple-500 mr-2" />
          Document Upload Console
        </h3>
        {onClose && (
          <button 
            onClick={onClose}
            disabled={uploading}
            className="p-1 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      {/* Hide the default start upload button if context is explore-similarity */}
      {context === 'explore-similarity' ? (
        <div className="space-y-6">
          {uploadContent.props.children.slice(0, 3)}
        </div>
      ) : uploadContent}
    </div>
  );
};

export default UploadManager;
