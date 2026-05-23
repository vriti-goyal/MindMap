import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { 
  LogOut, 
  Map as MapIcon, 
  FileText, 
  Globe, 
  Video, 
  ImageIcon, 
  Loader2, 
  Search, 
  Trash2, 
  Plus, 
  Sparkles,
  Calendar,
  X,
  AlertCircle,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import UploadManager from '../components/UploadManager';

const MyUploads = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // State
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('all'); // 'all', 'pdf', 'image', 'url', 'video'
  const [sortOrder, setSortOrder] = useState('date_desc'); // 'date_desc', 'date_asc'
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedDocs, setSelectedDocs] = useState([]); // Bulk selection IDs
  
  // Modals & Panels State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocDetails, setSelectedDocDetails] = useState(null); // Detail modal document object
  const [showDeleteWarningModal, setShowDeleteWarningModal] = useState(false); // Warning cascade deletion modal
  const [pendingDeleteDocs, setPendingDeleteDocs] = useState([]); // Docs selected for deletion

  // Helper for active navigation tabs
  const isActive = (path) => location.pathname === path;

  // Load Documents from API
  const fetchDocuments = async (pageNum = 1, shouldAppend = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      
      const typeParam = selectedType !== 'all' ? `&type=${selectedType}` : '';
      const url = `/documents/all?page=${pageNum}&limit=12&sort=${sortOrder}${typeParam}`;
      const res = await axios.get(url);
      
      if (shouldAppend) {
        setDocuments(prev => [...prev, ...res.data]);
      } else {
        setDocuments(res.data);
      }

      setHasMore(res.data.length === 12);
    } catch (err) {
      console.error('Failed to load uploads:', err);
    } finally {
      setLoading(false);
    }
  };

  // Triggers reload on filter or sort order changes
  useEffect(() => {
    setPage(1);
    fetchDocuments(1, false);
    setSelectedDocs([]);
  }, [selectedType, sortOrder]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchDocuments(nextPage, true);
  };

  // Re-run fetch on successful uploads
  const handleUploadFinished = (newDocs) => {
    setShowUploadModal(false);
    setPage(1);
    fetchDocuments(1, false);
  };

  // Bulk / Single Select checks
  const handleSelectDoc = (id, e) => {
    e.stopPropagation();
    setSelectedDocs(prev => 
      prev.includes(id) ? prev.filter(dId => dId !== id) : [...prev, id]
    );
  };

  // Deletion logic
  const initiateDeletion = (docsToDelete) => {
    setPendingDeleteDocs(docsToDelete);
    
    // Check if any of these documents are linked to maps
    const linkedToMaps = docsToDelete.filter(doc => doc.usedInMapsCount > 0);
    
    if (linkedToMaps.length > 0) {
      setShowDeleteWarningModal(true);
    } else {
      executeDeletion(docsToDelete);
    }
  };

  const executeDeletion = async (docs) => {
    setShowDeleteWarningModal(false);
    setLoading(true);
    try {
      for (const doc of docs) {
        await axios.delete(`/documents/${doc.id}`);
      }
      // Reload
      setPage(1);
      fetchDocuments(1, false);
      setSelectedDocs([]);
      setSelectedDocDetails(null);
    } catch (err) {
      console.error('Failed to delete documents:', err);
      alert(err.response?.data?.error || 'Failed to delete some documents. They might be used in active maps.');
    } finally {
      setLoading(false);
    }
  };

  // Helper visual colors and icons
  const getDocTypeTheme = (type) => {
    switch (type) {
      case 'PDF': 
        return {
          bg: 'bg-red-500/10 hover:border-red-500/30',
          border: 'border-red-500/10',
          badge: 'bg-red-500/10 border-red-500/20 text-red-400',
          text: 'text-red-400',
          icon: <FileText className="w-5 h-5 text-red-400" />
        };
      case 'Image': 
        return {
          bg: 'bg-sky-500/10 hover:border-sky-500/30',
          border: 'border-sky-500/10',
          badge: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
          text: 'text-sky-400',
          icon: <ImageIcon className="w-5 h-5 text-sky-400" />
        };
      case 'URL': 
        return {
          bg: 'bg-emerald-500/10 hover:border-emerald-500/30',
          border: 'border-emerald-500/10',
          badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
          text: 'text-emerald-400',
          icon: <Globe className="w-5 h-5 text-emerald-400" />
        };
      case 'YouTube': 
        return {
          bg: 'bg-purple-500/10 hover:border-purple-500/30',
          border: 'border-purple-500/10',
          badge: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
          text: 'text-purple-400',
          icon: <Video className="w-5 h-5 text-purple-400" />
        };
      default:
        return {
          bg: 'bg-gray-500/10',
          border: 'border-gray-800',
          badge: 'bg-gray-800 border-gray-700 text-gray-400',
          text: 'text-gray-400',
          icon: <FileText className="w-5 h-5 text-gray-400" />
        };
    }
  };

  const getDocLink = (doc) => {
    if (!doc.url) return '#';
    if (doc.url.startsWith('http://') || doc.url.startsWith('https://')) {
      return doc.url;
    }
    return `http://localhost:5000/${doc.url}`;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans relative">
      
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

      {/* Main Container */}
      <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        
        {/* Header Panel */}
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h2 className="text-3xl font-extrabold text-white sm:truncate">
              Document Vault
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Upload files or links to build a permanent standalone semantic repository for concept mapping.
            </p>
          </div>
          <div className="mt-4 flex gap-3 md:mt-0 md:ml-4">
            <button 
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center px-5 py-3 border border-transparent rounded-2xl shadow-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Plus className="h-4.5 w-4.5 mr-2" />
              Upload Source
            </button>
          </div>
        </div>

        {/* Filter bar and Sorting */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-gray-900/40 border border-gray-850 p-4.5 rounded-2xl mb-8">
          
          {/* Types Filters */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'All Sources', icon: <FileText className="w-3.5 h-3.5" /> },
              { id: 'pdf', label: 'PDFs', icon: <FileText className="w-3.5 h-3.5 text-red-400" /> },
              { id: 'image', label: 'Images', icon: <ImageIcon className="w-3.5 h-3.5 text-sky-400" /> },
              { id: 'url', label: 'URLs', icon: <Globe className="w-3.5 h-3.5 text-emerald-400" /> },
              { id: 'video', label: 'Videos', icon: <Video className="w-3.5 h-3.5 text-purple-400" /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedType(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                  selectedType === tab.id 
                    ? 'bg-purple-600 text-white shadow-md' 
                    : 'bg-gray-950 border border-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Sort order select */}
          <div className="flex items-center space-x-2.5">
            <span className="text-xs text-gray-500 font-medium">Sort Order:</span>
            <div className="relative">
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="appearance-none bg-gray-950 border border-gray-800 focus:border-purple-500 rounded-xl pl-3.5 pr-8 py-2 text-xs font-semibold text-white outline-none cursor-pointer"
              >
                <option value="date_desc">Newest First</option>
                <option value="date_asc">Oldest First</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-3.5 top-3 pointer-events-none" />
            </div>
          </div>

        </div>

        {/* Grid and Documents list */}
        {loading && page === 1 ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 border border-dashed border-gray-800 rounded-3xl bg-gray-950/20 text-center">
            <FileText className="w-12 h-12 text-gray-700 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Empty Repository</h3>
            <p className="text-sm text-gray-400 max-w-sm mb-6">
              You haven't uploaded any documents or linked sites under "{selectedType}" yet.
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4.5 py-2.5 bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white rounded-xl cursor-pointer"
            >
              Add Your First Source
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {documents.map((doc) => {
                const theme = getDocTypeTheme(doc.type);
                const isSelected = selectedDocs.includes(doc.id);
                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDocDetails(doc)}
                    className={`group bg-gray-900/90 border rounded-2xl p-4.5 shadow-sm transition-all hover:-translate-y-1 relative cursor-pointer flex flex-col justify-between ${
                      isSelected 
                        ? 'border-purple-600 ring-1 ring-purple-600/30' 
                        : 'border-gray-800 hover:border-purple-500/20'
                    }`}
                  >
                    
                    {/* Checkbox on hover */}
                    <div 
                      className={`absolute top-3.5 left-3.5 z-10 transition-opacity ${
                        isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      onClick={(e) => handleSelectDoc(doc.id, e)}
                    >
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Handled by outer container click event
                        className="w-4.5 h-4.5 bg-gray-950 border border-gray-800 rounded-lg text-purple-600 focus:ring-purple-500 outline-none cursor-pointer"
                      />
                    </div>

                    <div>
                      {/* Document Type Icon header badge */}
                      <div className="flex justify-between items-start mb-3.5">
                        <div className={`p-2.5 rounded-xl flex-shrink-0 ${theme.bg}`}>
                          {theme.icon}
                        </div>
                        <span className={`px-2 py-0.5 border text-[9px] font-bold rounded-md uppercase tracking-wider ${theme.badge}`}>
                          {doc.type}
                        </span>
                      </div>

                      {/* Document Details Info */}
                      <h4 
                        className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors line-clamp-2 pr-1 mb-2"
                        title={doc.name}
                      >
                        {doc.name}
                      </h4>
                    </div>

                    <div className="border-t border-gray-850 mt-4 pt-3 space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] text-gray-500">
                        <span className="flex items-center">
                          <Calendar className="w-3.5 h-3.5 mr-1" />
                          {new Date(doc.uploadedAt).toLocaleDateString(undefined, { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center text-[10px] text-gray-400">
                        <span>Used in {doc.usedInMapsCount} maps</span>
                        <span className="font-semibold text-purple-400 group-hover:underline">
                          View details →
                        </span>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>

            {/* Pagination Load More button */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={loadMore}
                  className="px-5 py-3 border border-gray-800 bg-gray-900/60 hover:bg-gray-850 text-xs font-bold text-gray-300 hover:text-white rounded-xl shadow-lg transition-colors cursor-pointer"
                >
                  Load More Uploads
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Bulk Delete Floating Panel Bar */}
      {selectedDocs.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 w-[90%] max-w-md bg-gray-900 border border-purple-500/50 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center justify-between backdrop-blur-md animate-bounce">
          <span className="text-xs font-bold text-white">
            {selectedDocs.length} source{selectedDocs.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSelectedDocs([])}
              className="px-3.5 py-1.5 bg-transparent hover:bg-gray-800 text-xs font-semibold text-gray-400 hover:text-white rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const docs = documents.filter(d => selectedDocs.includes(d.id));
                initiateDeletion(docs);
              }}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white rounded-xl shadow-md flex items-center space-x-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* Upload source drawer modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setShowUploadModal(false)}
            className="absolute inset-0 bg-gray-950/75 backdrop-blur-sm" 
          />
          <div className="w-full max-w-lg relative z-10">
            <UploadManager 
              context="standalone" 
              onUploadComplete={handleUploadFinished}
              onClose={() => setShowUploadModal(false)}
            />
          </div>
        </div>
      )}

      {/* Document details modal panel */}
      {selectedDocDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setSelectedDocDetails(null)}
            className="absolute inset-0 bg-gray-950/75 backdrop-blur-sm" 
          />
          
          <div className="w-full max-w-xl bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-800 flex justify-between items-center bg-gray-950/30">
              <div className="flex items-center space-x-2.5 min-w-0 mr-3">
                <div className={`p-2 rounded-xl flex-shrink-0 ${getDocTypeTheme(selectedDocDetails.type).bg}`}>
                  {getDocTypeTheme(selectedDocDetails.type).icon}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-white truncate pr-1" title={selectedDocDetails.name}>
                    {selectedDocDetails.name}
                  </h3>
                  <span className="text-[9px] text-gray-500 uppercase tracking-wider font-extrabold">
                    {selectedDocDetails.type} Vault File
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedDocDetails(null)}
                className="p-1 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* File Info parameters */}
              <div className="grid grid-cols-2 gap-4 bg-gray-950/60 p-4 rounded-2xl border border-gray-850">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider block">Uploaded At</span>
                  <span className="text-xs text-white font-semibold flex items-center mt-1">
                    <Calendar className="w-3.5 h-3.5 text-purple-400 mr-1.5" />
                    {new Date(selectedDocDetails.uploadedAt).toLocaleDateString(undefined, { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider block">Access Source</span>
                  <a
                    href={getDocLink(selectedDocDetails)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center mt-1 group"
                  >
                    <span>View / Download</span>
                    <ExternalLink className="w-3 h-3 text-purple-400 ml-1 group-hover:translate-x-0.5 transition-transform" />
                  </a>
                </div>
              </div>

              {/* Maps Associated lists */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Associated Mind Maps ({selectedDocDetails.mapsAttachedTo?.length || 0})
                </span>
                
                {(!selectedDocDetails.mapsAttachedTo || selectedDocDetails.mapsAttachedTo.length === 0) ? (
                  <div className="text-xs text-gray-500 italic p-4 text-center border border-dashed border-gray-850 rounded-xl bg-gray-950/20">
                    This document is standalone and isn't attached to any mind maps yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedDocDetails.mapsAttachedTo.map((map) => (
                      <div
                        key={map.id}
                        onClick={() => navigate(`/maps/${map.id}`)}
                        className="group bg-gray-950 border border-gray-850 hover:border-purple-500/40 px-4 py-3.5 rounded-xl flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 mr-3">
                          <MapIcon className="w-4 h-4 text-purple-500 flex-shrink-0" />
                          <span className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors truncate">
                            {map.title}
                          </span>
                        </div>
                        <span className="text-[10px] text-purple-400 group-hover:underline flex-shrink-0 font-semibold">
                          Open Map →
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Actions Footer */}
            <div className="px-6 py-4.5 border-t border-gray-800 bg-gray-950/40 flex justify-between items-center">
              <button
                onClick={() => initiateDeletion([selectedDocDetails])}
                className="px-4 py-2.5 bg-rose-600/10 border border-rose-900/25 hover:bg-rose-600 text-rose-400 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Vault File</span>
              </button>

              <button
                onClick={() => setSelectedDocDetails(null)}
                className="px-5 py-2.5 bg-gray-950 border border-gray-800 text-gray-400 hover:text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Safety Warning Delete Modal (Linked to Maps conflict) */}
      {showDeleteWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setShowDeleteWarningModal(false)}
            className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm" 
          />
          
          <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl relative z-10 overflow-hidden">
            
            {/* Header */}
            <div className="p-6 bg-rose-950/20 border-b border-gray-800 flex items-center space-x-3 text-rose-400">
              <AlertCircle className="w-6 h-6 flex-shrink-0 animate-pulse" />
              <h3 className="text-md font-extrabold text-white">
                Cascade Warning! Active Map Links
              </h3>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-300 leading-relaxed">
                The file(s) you are trying to delete are currently linked as knowledge sources inside maps. Deleting them will automatically detach them, which could disrupt the AI context:
              </p>

              <div className="max-h-[160px] overflow-y-auto bg-gray-950 p-3.5 rounded-xl border border-gray-850 space-y-2">
                {pendingDeleteDocs.map(doc => {
                  if (doc.usedInMapsCount === 0) return null;
                  return (
                    <div key={doc.id} className="text-xs">
                      <span className="font-bold text-white block mb-1.5">• {doc.name}</span>
                      <div className="pl-3.5 space-y-1 text-[10px] text-gray-400 border-l border-gray-800">
                        {doc.mapsAttachedTo?.map(m => (
                          <span key={m.id} className="block">Attached to: <span className="font-bold text-gray-200">{m.title}</span></span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4.5 border-t border-gray-800 bg-gray-950/40 flex justify-between">
              <button
                onClick={() => setShowDeleteWarningModal(false)}
                className="px-4 py-2 bg-transparent hover:bg-gray-850 text-xs font-semibold text-gray-400 hover:text-white rounded-xl cursor-pointer"
              >
                Back
              </button>
              
              <button
                onClick={() => executeDeletion(pendingDeleteDocs)}
                className="px-4.5 py-2 bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white rounded-xl shadow-md cursor-pointer"
              >
                Confirm Cascade Delete
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default MyUploads;
