import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { 
  LogOut, 
  Map as MapIcon, 
  Upload, 
  Search, 
  Trash2, 
  Plus, 
  Globe, 
  Video, 
  FileText, 
  ImageIcon,
  Sparkles,
  Loader2,
  X,
  Calendar,
  AlertCircle
} from 'lucide-react';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // State
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingManual, setCreatingManual] = useState(false);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [sourceType, setSourceType] = useState('None'); // None, PDF, Image, URL, YouTube
  const [sourceUrl, setSourceUrl] = useState('');
  const [file, setFile] = useState(null);
  
  // Similarity Interceptor States
  const [showSimilarityModal, setShowSimilarityModal] = useState(false);
  const [similarMaps, setSimilarMaps] = useState([]);
  const [pendingFormData, setPendingFormData] = useState(null);

  // AI generation states
  const [generating, setGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(0);
  const [error, setError] = useState('');

  // Fetch Maps list with server search
  const fetchMaps = async (query = '') => {
    try {
      setLoading(true);
      const url = query ? `/maps?search=${encodeURIComponent(query)}` : '/maps';
      const res = await axios.get(url);
      setMaps(res.data);
    } catch (err) {
      console.error('Failed to load mind maps:', err);
    } finally {
      setLoading(false);
    }
  };

  // Debounced Search Effect
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchMaps(searchQuery);
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Animating the AI steps during generation
  useEffect(() => {
    let interval;
    if (generating) {
      interval = setInterval(() => {
        setGeneratingStep((prev) => (prev + 1) % 4);
      }, 3000);
    } else {
      setGeneratingStep(0);
    }
    return () => clearInterval(interval);
  }, [generating]);

  const steps = [
    "🧠 Gemini is digesting your prompt and documents...",
    "✨ Mapping semantic concepts and hierarchical nodes...",
    "📐 Engineering layout coordinates for perfect visualization...",
    "🚀 Committing structured mind map to postgres DB..."
  ];

  // Delete Map
  const handleDeleteMap = async (id, e) => {
    e.stopPropagation(); // Avoid triggering route navigation
    if (!window.confirm("Are you sure you want to delete this mind map?")) return;
    
    try {
      await axios.delete(`/maps/${id}`);
      setMaps((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error('Failed to delete map:', err);
    }
  };

  // Create Manual Map (Blank Canvas)
  const handleCreateManualMap = async () => {
    try {
      setCreatingManual(true);
      const res = await axios.post('/maps', {
        title: 'Untitled Mind Map'
      });
      navigate(`/maps/${res.data.mapId}`);
    } catch (err) {
      console.error('Manual map creation failure:', err);
      alert('Failed to create a blank mind map. Please try again.');
    } finally {
      setCreatingManual(false);
    }
  };

  // Intercept Generate Map and check similarity first
  const handleGenerateSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() && sourceType === 'None') {
      setError('Please provide either a prompt description or a document source.');
      return;
    }

    try {
      setError('');
      setGenerating(true);
      
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('sourceType', sourceType);
      
      if (sourceType === 'URL' || sourceType === 'YouTube') {
        formData.append('sourceUrl', sourceUrl);
      } else if (file) {
        formData.append('file', file);
      }

      // Check for similar maps first
      const simCheck = await axios.post('/generate/check-similarity', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (simCheck.data.similarExistingMaps && simCheck.data.similarExistingMaps.length > 0) {
        setSimilarMaps(simCheck.data.similarExistingMaps);
        setPendingFormData(formData);
        setShowSimilarityModal(true);
        setGenerating(false); // Stop loading since we need user choice
        return;
      }

      // If no similar maps are found, proceed directly with generation
      await proceedWithGeneration(formData);
    } catch (err) {
      console.error('Generation pre-check failure:', err);
      setError(err.response?.data?.error || 'Failed to verify prompt similarity. Please try again.');
      setGenerating(false);
    }
  };

  const proceedWithGeneration = async (formData) => {
    try {
      setError('');
      setGenerating(true);
      setShowSimilarityModal(false);

      const res = await axios.post('/generate', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      closeGenerationModal();
      navigate(`/maps/${res.data.mapId}`);
    } catch (err) {
      console.error('Generation failure:', err);
      setError(err.response?.data?.error || 'Failed to generate mind map. Please verify your files/links.');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAnyway = () => {
    if (pendingFormData) {
      proceedWithGeneration(pendingFormData);
    }
  };

  // Reset form inputs when modal is closed
  const closeGenerationModal = () => {
    setShowModal(false);
    setPrompt('');
    setSourceType('None');
    setSourceUrl('');
    setFile(null);
    setError('');
    setPendingFormData(null);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans relative">
      
      {/* AI Processing overlay */}
      {generating && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-lg z-50 flex flex-col justify-center items-center px-4 text-center">
          <div className="p-8 rounded-3xl bg-gray-900 border border-gray-800 shadow-2xl flex flex-col items-center max-w-lg">
            <Loader2 className="w-16 h-16 text-purple-500 animate-spin mb-6" />
            <h3 className="text-xl font-bold text-white mb-2">Synthesizing Mind Map</h3>
            <p className="text-purple-400 font-medium animate-pulse transition-all">
              {steps[generatingStep]}
            </p>
            <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mt-6">
              <div 
                className="bg-purple-600 h-full rounded-full transition-all duration-[3000ms]"
                style={{ width: `${(generatingStep + 1) * 25}%` }}
              />
            </div>
          </div>
        </div>
      )}

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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="md:flex md:items-center md:justify-between mb-10">
          <div className="flex-1 min-w-0">
            <h2 className="text-3xl font-extrabold text-white sm:truncate">
              My Knowledge Repository
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Select or generate fully interactive, AI-driven concepts map.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 md:mt-0 md:ml-4">
            <button 
              onClick={handleCreateManualMap}
              disabled={creatingManual}
              className="inline-flex items-center px-5 py-3 border border-gray-800 rounded-2xl shadow-xl text-sm font-semibold text-gray-300 bg-gray-900 hover:bg-gray-800 transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
            >
              {creatingManual ? (
                <Loader2 className="h-4.5 w-4.5 mr-2 animate-spin text-purple-500" />
              ) : (
                <Plus className="h-4.5 w-4.5 mr-2 text-purple-500 animate-pulse" />
              )}
              Create Blank Map
            </button>
            <button 
              onClick={() => setShowModal(true)}
              className="inline-flex items-center px-5 py-3 border border-transparent rounded-2xl shadow-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Sparkles className="h-4.5 w-4.5 mr-2 animate-bounce" />
              Generate New Map
            </button>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="space-y-6">
          <div className="bg-gray-900/40 border border-gray-800 rounded-3xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <h3 className="text-xl font-bold text-white flex items-center">
                <MapIcon className="h-5 w-5 mr-2.5 text-purple-500" />
                My Generated Mind Maps
              </h3>
              
              {/* Search */}
              <div className="w-full sm:w-[300px] relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-500 animate-pulse" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-gray-950 border border-gray-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 block w-full pl-10 pr-4 py-2.5 sm:text-sm text-white rounded-xl outline-none"
                  placeholder="Search titles, tags, nodes..."
                />
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-48">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              </div>
            ) : maps.length === 0 ? (
              <div className="text-sm text-gray-500 flex flex-col items-center justify-center h-48 border border-dashed border-gray-800 rounded-2xl bg-gray-950/20">
                <MapIcon className="h-10 w-10 text-gray-700 mb-3" />
                <p className="text-gray-400 font-medium">No mind maps matched your search</p>
                <button
                  onClick={() => setShowModal(true)}
                  className="mt-3 text-xs font-semibold text-purple-400 hover:text-purple-300 underline cursor-pointer"
                >
                  Create one now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {maps.map((map) => (
                  <div
                    key={map.id}
                    onClick={() => navigate(`/maps/${map.id}`)}
                    className="group bg-gray-900 border border-gray-800/80 hover:border-purple-500/50 rounded-2xl p-5 shadow-sm hover:shadow-purple-500/5 flex flex-col justify-between transition-all hover:-translate-y-1 cursor-pointer"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
                          <MapIcon className="w-5 h-5" />
                        </span>
                        
                        <button
                          onClick={(e) => handleDeleteMap(map.id, e)}
                          className="p-1.5 bg-transparent hover:bg-rose-950/30 text-gray-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                          title="Delete Map"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <h4 className="text-md font-bold text-white group-hover:text-purple-400 transition-colors line-clamp-2">
                        {map.title}
                      </h4>
                      
                      {map.tags && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {map.tags.split(',').map((t, idx) => {
                            const tag = t.trim();
                            if (!tag) return null;
                            return (
                              <span key={idx} className="px-2 py-0.5 bg-gray-800 text-gray-400 text-[10px] font-medium rounded-md border border-gray-700">
                                {tag}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-gray-800/80 mt-5 pt-3.5 flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center">
                        <Calendar className="w-3.5 h-3.5 mr-1.5" />
                        {new Date(map.updatedAt).toLocaleDateString(undefined, { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </span>
                      <span className="font-semibold text-purple-400 group-hover:underline">
                        Open Editor →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Generation Wizard Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-950/70 backdrop-blur-sm z-40 flex justify-center items-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-800 flex justify-between items-center bg-gray-950/30">
              <h3 className="text-lg font-bold text-white flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-purple-500 animate-bounce" />
                Generate AI Mind Map
              </h3>
              <button 
                onClick={closeGenerationModal}
                className="p-1 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleGenerateSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {error && (
                <div className="flex items-start space-x-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-sm">
                  <AlertCircle className="w-5 h-5 mr-1 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Prompt input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Concept Prompt or Map Subject
                </label>
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-3 text-sm text-white outline-none resize-none"
                  placeholder="Example: Core concepts of quantum computing, or a layout breakdown of the French Revolution..."
                  required={sourceType === 'None'}
                />
              </div>

              {/* Source type selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 font-semibold">
                  Enhance Context with Document Source
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 bg-gray-950 p-1.5 rounded-xl border border-gray-800">
                  {[
                    { value: 'None', label: 'None', icon: <Plus className="w-3.5 h-3.5" /> },
                    { value: 'PDF', label: 'PDF', icon: <FileText className="w-3.5 h-3.5" /> },
                    { value: 'Image', label: 'Image', icon: <ImageIcon className="w-3.5 h-3.5" /> },
                    { value: 'URL', label: 'Web URL', icon: <Globe className="w-3.5 h-3.5" /> },
                    { value: 'YouTube', label: 'YouTube', icon: <Video className="w-3.5 h-3.5" /> }
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setSourceType(opt.value);
                        setFile(null);
                        setSourceUrl('');
                      }}
                      className={`py-2 text-[10px] font-semibold rounded-lg flex flex-col items-center justify-center space-y-1 transition-all cursor-pointer ${
                        sourceType === opt.value 
                          ? 'bg-purple-600 text-white shadow-md' 
                          : 'text-gray-400 hover:text-white hover:bg-gray-900'
                      }`}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional URL Sources */}
              {(sourceType === 'URL' || sourceType === 'YouTube') && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    {sourceType === 'YouTube' ? 'YouTube Video URL' : 'Website Address URL'}
                  </label>
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                    placeholder={sourceType === 'YouTube' ? 'https://www.youtube.com/watch?v=...' : 'https://example.com/article-title'}
                    required
                  />
                </div>
              )}

              {/* Conditional File Uploads */}
              {(sourceType === 'PDF' || sourceType === 'Image') && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Upload {sourceType} Document
                  </label>
                  
                  <div className="border-2 border-dashed border-gray-800 hover:border-purple-500/50 rounded-xl p-6 bg-gray-950/20 text-center transition-colors relative cursor-pointer">
                    <input
                      type="file"
                      accept={sourceType === 'PDF' ? '.pdf' : 'image/*'}
                      onChange={(e) => setFile(e.target.files[0])}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      required={!file}
                    />
                    
                    <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                    {file ? (
                      <span className="text-sm font-semibold text-purple-400 block truncate">
                        {file.name}
                      </span>
                    ) : (
                      <>
                        <span className="text-sm text-gray-300 block font-medium">
                           Select {sourceType} File
                        </span>
                        <span className="text-[10px] text-gray-500 mt-1 block">
                          Maximum file size: 10MB
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-gray-800/80 bg-gray-900">
                <button
                  type="button"
                  onClick={closeGenerationModal}
                  className="px-5 py-2.5 bg-gray-950 border border-gray-800 text-gray-400 hover:text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold flex items-center shadow-lg shadow-purple-500/20 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Let's Map It
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Similarity Suggestion Modal */}
      {showSimilarityModal && (
        <div className="fixed inset-0 bg-gray-950/70 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-800 flex justify-between items-center bg-gray-950/30">
              <h3 className="text-lg font-bold text-white flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-yellow-500 animate-pulse" />
                Similar Maps Found!
              </h3>
              <button 
                onClick={() => {
                  setShowSimilarityModal(false);
                  setPendingFormData(null);
                }}
                className="p-1 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-300">
                We noticed you already have mind maps that are highly related to your prompt/document source. Would you like to open one of these instead of creating a redundant map?
              </p>

              <div className="space-y-3">
                {similarMaps.map((map) => {
                  const similarityPct = (map.similarity * 100).toFixed(0);
                  return (
                    <div 
                      key={map.id}
                      onClick={() => {
                        setShowSimilarityModal(false);
                        closeGenerationModal();
                        navigate(`/maps/${map.id}`);
                      }}
                      className="group bg-gray-950 border border-gray-800 hover:border-yellow-500/50 p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01]"
                    >
                      <div className="flex items-center space-x-3 truncate mr-3">
                        <MapIcon className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                        <span className="text-sm font-semibold text-white group-hover:text-yellow-400 transition-colors truncate">
                          {map.title}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 flex-shrink-0">
                        <span className="px-2 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs font-bold rounded-lg">
                          {similarityPct}% Match
                        </span>
                        <span className="text-xs font-semibold text-yellow-500 group-hover:underline">
                          Open →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-800 bg-gray-950/40 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowSimilarityModal(false);
                  setPendingFormData(null);
                }}
                className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleGenerateAnyway}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold flex items-center shadow-lg cursor-pointer"
              >
                Generate New Map Anyway
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
