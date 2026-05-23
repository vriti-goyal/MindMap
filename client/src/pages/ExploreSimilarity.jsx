import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Search, Map as MapIcon, Save, FileText, ImageIcon, Globe, Video, Loader2, LogOut } from 'lucide-react';
import UploadManager from '../components/UploadManager';

const ExploreSimilarity = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path) => location.pathname === path;
  const [queuedFile, setQueuedFile] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [similarDocuments, setSimilarDocuments] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleQueueChange = (queue) => {
    if (queue.length > 0) {
      setQueuedFile(queue[0]);
    } else {
      setQueuedFile(null);
    }
  };

  const handleFindSimilar = async () => {
    if (!queuedFile) return;
    setIsSearching(true);
    setSearchError('');
    setSimilarDocuments([]);
    setHasSearched(true);

    try {
      const formData = new FormData();
      if (queuedFile.file) {
        formData.append('file', queuedFile.file);
        formData.append('sourceType', queuedFile.type);
      } else {
        formData.append('url', queuedFile.url);
        formData.append('sourceType', queuedFile.type);
      }

      const res = await axios.post('/documents/explore-similarity', formData);
      if (res.data.similarDocuments) {
        setSimilarDocuments(res.data.similarDocuments);
        // By default, check documents with similarity > 0.75
        const defaultSelected = res.data.similarDocuments
          .filter(d => d.similarityScore > 0.75)
          .map(d => d.id);
        setSelectedDocIds(defaultSelected);
      } else if (res.data.message) {
        setSearchError(res.data.message);
      }
    } catch (err) {
      console.error(err);
      setSearchError('Failed to search for similar documents.');
    } finally {
      setIsSearching(false);
    }
  };

  const toggleSelection = (id) => {
    setSelectedDocIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSaveAndCreate = async (mode) => {
    if (!queuedFile) return;
    if (mode === 'create' && selectedDocIds.length === 0) return;

    setIsProcessing(true);
    try {
      const formData = new FormData();
      if (queuedFile.file) {
        formData.append('file', queuedFile.file);
        formData.append('sourceType', queuedFile.type);
      } else {
        formData.append('url', queuedFile.url);
        formData.append('sourceType', queuedFile.type);
      }
      
      formData.append('title', queuedFile.name);
      formData.append('selectedDocumentIds', JSON.stringify(mode === 'create' ? selectedDocIds : []));
      if (prompt) {
        formData.append('prompt', prompt);
      }

      const res = await axios.post('/documents/save-and-create-map', formData);
      
      if (mode === 'create') {
        navigate(`/maps/${res.data.mapId}`);
      } else {
        alert('Document saved successfully!');
        setQueuedFile(null);
        setHasSearched(false);
        setSimilarDocuments([]);
        setPrompt('');
      }
    } catch (err) {
      console.error(err);
      alert('Action failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getSimColor = (score) => {
    if (score >= 0.8) return 'bg-emerald-500';
    if (score >= 0.6) return 'bg-yellow-500';
    return 'bg-rose-500';
  };

  const getItemIcon = (type) => {
    switch (type) {
      case 'PDF': return <FileText className="w-5 h-5 text-red-500" />;
      case 'Image': return <ImageIcon className="w-5 h-5 text-blue-500" />;
      case 'URL': return <Globe className="w-5 h-5 text-green-500" />;
      case 'YouTube': return <Video className="w-5 h-5 text-purple-500" />;
      default: return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans relative flex flex-col">
      {/* Navbar */}
      <nav className="bg-gray-900/60 backdrop-blur-md border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-xl">
                <MapIcon className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-300 bg-clip-text text-transparent">
                MindMap AI
              </span>
              
              {/* Premium Nav Tabs */}
              <div className="hidden md:flex items-center space-x-1.5 ml-8 bg-gray-950 p-1.5 rounded-xl border border-gray-850">
                <button
                  onClick={() => navigate('/dashboard')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                    isActive('/dashboard') ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-900'
                  }`}
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  <span>My Maps</span>
                </button>
                <button
                  onClick={() => navigate('/uploads')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                    isActive('/uploads') ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>My Uploads</span>
                </button>
                <button
                  onClick={() => navigate('/explore')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                    isActive('/explore') ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-900'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Explore Similarity</span>
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-5">
              <div className="text-sm text-gray-400 hidden sm:block">
                Logged in as <span className="text-gray-200 font-semibold">{user?.email}</span>
              </div>
              <button
                onClick={logout}
                className="inline-flex items-center px-4 py-2 border border-gray-800 text-sm leading-4 font-medium rounded-xl text-gray-300 bg-gray-900 hover:bg-gray-800 hover:text-white transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-gray-800 p-6 flex flex-col space-y-6 overflow-y-auto bg-gray-950">
        <div>
          <h1 className="text-2xl font-bold flex items-center mb-2">
            <Search className="mr-2 text-purple-500" />
            Find Similar Documents
          </h1>
          <p className="text-sm text-gray-400">
            Upload a document to discover related content in your library
          </p>
        </div>

        <div className="flex-1">
          <UploadManager 
            context="explore-similarity" 
            singleFile={true} 
            onQueueChange={handleQueueChange} 
          />
          
          <button
            onClick={handleFindSimilar}
            disabled={!queuedFile || isSearching}
            className="w-full mt-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-sm font-bold text-white shadow-xl flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isSearching ? (
              <><Loader2 className="w-4 h-4 animate-spin" /><span>Searching your library...</span></>
            ) : (
              <><Search className="w-4 h-4" /><span>Find Similar</span></>
            )}
          </button>
          
          {searchError && (
            <p className="mt-4 text-sm text-rose-400 text-center">{searchError}</p>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full md:w-2/3 p-6 flex flex-col relative overflow-hidden">
        {!hasSearched ? (
          <div className="flex-1 flex flex-col items-center justify-center opacity-40">
            <Search className="w-24 h-24 mb-4 text-gray-500" />
            <p className="text-lg text-gray-400">Your results will appear here</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <h2 className="text-xl font-bold mb-4">Found {similarDocuments.length} similar documents for "{queuedFile?.name}"</h2>
            
            {isProcessing && (
              <div className="absolute inset-0 bg-gray-950/80 backdrop-blur flex flex-col items-center justify-center z-10">
                <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
                <p className="text-lg font-bold">Generating your map...</p>
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {similarDocuments.map(doc => {
                const simPct = Math.round(doc.similarityScore * 100);
                return (
                  <div key={doc.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center">
                    <input 
                      type="checkbox" 
                      className="mr-4 w-5 h-5 rounded border-gray-700 text-purple-600 focus:ring-purple-500 bg-gray-800 cursor-pointer"
                      checked={selectedDocIds.includes(doc.id)}
                      onChange={() => toggleSelection(doc.id)}
                    />
                    <div className="p-2 bg-gray-800 rounded-lg mr-4">
                      {getItemIcon(doc.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold truncate" title={doc.name}>{doc.name}</h3>
                      <p className="text-xs text-gray-500">Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                      
                      <div className="mt-2 flex items-center text-xs">
                        <div className="w-full bg-gray-800 h-1.5 rounded-full mr-3">
                          <div className={`h-full rounded-full ${getSimColor(doc.similarityScore)}`} style={{ width: `${simPct}%` }}></div>
                        </div>
                        <span className="font-bold text-gray-400 w-16 text-right">{simPct}% similar</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 border-t border-gray-800 pt-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2">Add instructions for map generation (optional)</label>
                <textarea 
                  className="w-full bg-gray-900 border border-gray-800 focus:border-purple-500 rounded-xl p-3 text-sm resize-none"
                  rows="3"
                  placeholder="e.g. Focus on the main themes and ignore the appendix..."
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                />
              </div>
              <div className="flex space-x-4">
                <button 
                  onClick={() => handleSaveAndCreate('save')}
                  className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-bold transition-colors"
                >
                  <Save className="w-4 h-4 inline mr-2" />
                  Save Document Only
                </button>
                <button 
                  onClick={() => handleSaveAndCreate('create')}
                  disabled={selectedDocIds.length === 0}
                  className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold transition-colors"
                >
                  <MapIcon className="w-4 h-4 inline mr-2" />
                  Create Map from Selected
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
};

export default ExploreSimilarity;
