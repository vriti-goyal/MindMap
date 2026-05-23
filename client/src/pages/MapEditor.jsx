import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react';
import { 
  ArrowLeft, 
  Save, 
  Sparkles, 
  Plus, 
  Trash2, 
  X, 
  Layers, 
  GitBranch, 
  FileText,
  Loader2,
  CheckCircle,
  HelpCircle,
  Tag,
  Globe,
  Video,
  ImageIcon
} from 'lucide-react';
import MindMapNode from '../components/CustomNode';

const nodeTypes = {
  concept: MindMapNode,
  subconcept: MindMapNode,
  detail: MindMapNode
};

const MapEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fitView } = useReactFlow();

  // State
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [documents, setDocuments] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success', 'error', null
  const [aiGeneratingTitle, setAiGeneratingTitle] = useState(false);
  
  // Drawer States
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [drawerTab, setDrawerTab] = useState('map'); // 'map' or 'node'
  const [selectedNode, setSelectedNode] = useState(null);

  // Load Map Data
  useEffect(() => {
    const fetchMap = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/maps/${id}`);
        setTitle(res.data.title);
        setTags(res.data.tags || '');
        setDocuments(res.data.documents || []);
        setNodes(res.data.nodes || []);
        setEdges(res.data.edges || []);
        
        // Wait a small moment for layout to stabilize, then fit view
        setTimeout(() => {
          fitView({ padding: 0.15, duration: 800 });
        }, 100);
      } catch (err) {
        console.error('Failed to load map:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMap();
  }, [id, setNodes, setEdges, fitView]);

  // Handle Edge connections drawn by the user
  const onConnect = useCallback(
    (params) => {
      const newEdge = {
        ...params,
        id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        animated: true,
        style: { stroke: '#aa3bff', strokeWidth: 2 }
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  // Save map state to DB
  const saveMapState = async () => {
    try {
      setSaving(true);
      setSaveStatus(null);
      await axios.put(`/maps/${id}`, {
        title,
        tags,
        nodes,
        edges
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Failed to save map state:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  // AI auto-generate title
  const handleAiTitleGenerate = async () => {
    try {
      setAiGeneratingTitle(true);
      const res = await axios.post(`/maps/${id}/ai-title`);
      setTitle(res.data.title);
    } catch (err) {
      console.error('Failed to generate AI title:', err);
    } finally {
      setAiGeneratingTitle(false);
    }
  };

  // Node Selection events
  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
    setDrawerTab('node');
    setDrawerOpen(true);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setDrawerTab('map');
  }, []);

  // Update selected node label/type/content locally in the React Flow state
  const updateNodeData = (field, value) => {
    if (!selectedNode) return;

    // Handle standard fields or nested data
    if (field === 'type') {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === selectedNode.id) {
            const updated = { ...node, type: value };
            setSelectedNode(updated); // Sync selection panel state
            return updated;
          }
          return node;
        })
      );
    } else {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === selectedNode.id) {
            const updated = {
              ...node,
              data: {
                ...node.data,
                [field]: value
              }
            };
            setSelectedNode(updated); // Sync selection panel state
            return updated;
          }
          return node;
        })
      );
    }
  };

  // Add a brand new floating node at center
  const addFloatingNode = (type = 'concept') => {
    const uniqueId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNode = {
      id: uniqueId,
      type,
      position: {
        x: (window.innerWidth / 2 - 200) + (Math.random() - 0.5) * 100,
        y: (window.innerHeight / 2 - 100) + (Math.random() - 0.5) * 100
      },
      data: { 
        label: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`, 
        content: '' 
      }
    };
    setNodes((nds) => nds.concat(newNode));
    setSelectedNode(newNode);
    setDrawerTab('node');
    setDrawerOpen(true);
  };

  // Add child node auto-linked to selected node
  const addChildNode = () => {
    if (!selectedNode) return;

    const childId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const edgeId = `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Determine type: if parent is concept, child is subconcept; if parent is subconcept, child is detail; else detail
    let childType = 'detail';
    if (selectedNode.type === 'concept') childType = 'subconcept';
    else if (selectedNode.type === 'subconcept') childType = 'detail';

    // Position child slightly below the parent
    const childNode = {
      id: childId,
      type: childType,
      position: {
        x: selectedNode.position.x + (Math.random() - 0.5) * 80,
        y: selectedNode.position.y + 120
      },
      data: {
        label: `New ${childType}`,
        content: ''
      }
    };

    const newEdge = {
      id: edgeId,
      source: selectedNode.id,
      target: childId,
      sourceHandle: 'bottom',
      targetHandle: 'top',
      animated: true,
      style: { stroke: '#aa3bff', strokeWidth: 2 }
    };

    setNodes((nds) => nds.concat(childNode));
    setEdges((eds) => eds.concat(newEdge));
    setSelectedNode(childNode); // focus on the new child node
    setDrawerTab('node');
  };

  // Delete the selected node and its edges
  const deleteSelectedNode = () => {
    if (!selectedNode) return;

    const nodeId = selectedNode.id;
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
    setDrawerTab('map');
  };

  // Create First root node for manual creation
  const addFirstNode = () => {
    const uniqueId = `node-${Date.now()}`;
    const newNode = {
      id: uniqueId,
      type: 'concept',
      position: { x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 200 },
      data: { label: 'Main Concept Topic', content: 'Double click to edit details...' }
    };
    setNodes([newNode]);
    setSelectedNode(newNode);
    setDrawerTab('node');
    setDrawerOpen(true);
  };

  // Helper for document visual icon and download paths
  const getDocumentIcon = (sourceType) => {
    switch (sourceType) {
      case 'PDF': return <FileText className="w-4 h-4 text-rose-400" />;
      case 'Image': return <ImageIcon className="w-4 h-4 text-sky-400" />;
      case 'URL': return <Globe className="w-4 h-4 text-emerald-400" />;
      case 'YouTube': return <Video className="w-4 h-4 text-red-400" />;
      default: return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  const getDocLink = (doc) => {
    if (!doc.storageUrl) return '#';
    if (doc.storageUrl.startsWith('http://') || doc.storageUrl.startsWith('https://')) {
      return doc.storageUrl;
    }
    return `http://localhost:5000/${doc.storageUrl}`; // Relative static file asset link
  };

  // Spinner UI
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-gray-900 text-white">
        <Loader2 className="w-12 h-12 animate-spin text-purple-500 mb-4" />
        <p className="text-gray-400 font-medium">Hydrating interactive map...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen bg-gray-950 overflow-hidden relative font-sans text-gray-100">
      
      {/* Back & Save & AI Title Header Panel */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between pointer-events-none">
        
        {/* Navigation & Title Group */}
        <div className="flex items-center space-x-3 pointer-events-auto bg-gray-900/90 backdrop-blur-md border border-gray-800 px-4 py-2.5 rounded-2xl shadow-xl w-full md:w-auto">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-gray-800 text-gray-400 hover:text-white rounded-xl transition-colors cursor-pointer flex-shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="h-6 w-[1px] bg-gray-800 flex-shrink-0" />
          
          <div className="flex items-center space-x-2 flex-grow truncate">
            <input 
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              className="bg-transparent text-sm md:text-lg font-bold text-white border-b border-transparent focus:border-purple-500 focus:outline-none px-1 py-0.5 w-full md:w-[350px] transition-colors truncate"
              placeholder="Give your map a title..."
            />
            
            <button
              onClick={handleAiTitleGenerate}
              disabled={aiGeneratingTitle}
              className="p-1.5 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-600/20 text-purple-400 rounded-lg hover:text-purple-300 transition-colors disabled:opacity-50 cursor-pointer flex-shrink-0"
              title="AI Auto-Generate Title"
            >
              {aiGeneratingTitle ? (
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Toolbar & Floating Save Panel */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pointer-events-auto w-full md:w-auto">
          
          {/* Quick Node Creator Panel */}
          <div className="flex items-center justify-between sm:justify-start space-x-1.5 bg-gray-900/90 backdrop-blur-md border border-gray-800 px-3 py-1.5 rounded-2xl shadow-xl">
            <span className="text-xs text-gray-500 mr-1.5 hidden sm:inline">Add Node:</span>
            <div className="flex items-center space-x-1 w-full sm:w-auto justify-around">
              <button
                onClick={() => addFloatingNode('concept')}
                className="px-2 py-1 text-[10px] md:text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center cursor-pointer"
              >
                <Plus className="w-3 h-3 mr-0.5 sm:mr-1" /> Concept
              </button>
              <button
                onClick={() => addFloatingNode('subconcept')}
                className="px-2 py-1 text-[10px] md:text-xs bg-gray-800 hover:bg-gray-700 border border-purple-500/30 hover:border-purple-500/50 text-purple-300 rounded-lg font-medium flex items-center cursor-pointer"
              >
                <Plus className="w-3 h-3 mr-0.5 sm:mr-1" /> Branch
              </button>
              <button
                onClick={() => addFloatingNode('detail')}
                className="px-2 py-1 text-[10px] md:text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg font-normal flex items-center cursor-pointer"
              >
                <Plus className="w-3 h-3 mr-0.5 sm:mr-1" /> Leaf
              </button>
            </div>
          </div>

          {/* Save Status and Action */}
          <div className="flex items-center space-x-2 justify-end sm:justify-start">
            {saveStatus === 'success' && (
              <span className="flex items-center text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl text-xs font-medium shadow-md">
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Saved
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl text-xs font-medium shadow-md">
                Failed
              </span>
            )}
            
            <button
              onClick={saveMapState}
              disabled={saving}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-500/25 flex items-center space-x-1.5 transition-transform active:scale-95 disabled:opacity-70 cursor-pointer justify-center"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save State</span>
                </>
              )}
            </button>

            {/* Toggle Settings drawer button (shown on mobile to reopen panel) */}
            <button 
              onClick={() => setDrawerOpen(!drawerOpen)}
              className="p-2 bg-gray-900 border border-gray-800 text-purple-400 hover:text-white rounded-xl shadow-md cursor-pointer"
              title="Toggle Config Panel"
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Main React Flow Canvas */}
      <div className="flex-1 h-full w-full relative min-h-[50vh]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          fitView
          className="bg-gray-950"
        >
          <Background color="#334155" gap={20} size={1} variant="dots" />
          <MiniMap 
            nodeColor={(node) => {
              if (node.type === 'concept') return '#aa3bff';
              if (node.type === 'subconcept') return '#d8b4fe';
              return '#475569';
            }}
            maskColor="rgba(15, 23, 42, 0.7)"
            className="!bg-gray-900 !border-gray-800 rounded-xl hidden md:block"
          />
        </ReactFlow>

        {/* Empty Onboarding State Overlay */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 p-4">
            <div className="bg-gray-900/90 backdrop-blur-lg border border-gray-800 p-8 rounded-3xl text-center shadow-2xl max-w-sm pointer-events-auto transition-all scale-100 hover:scale-[1.02]">
              <Layers className="w-12 h-12 text-purple-500 mx-auto mb-4 animate-bounce" />
              <h3 className="text-xl font-bold text-white mb-2">Blank Canvas Map</h3>
              <p className="text-sm text-gray-400 mb-6">
                Create nodes from scratch to visualize your ideas manually.
              </p>
              <button
                onClick={addFirstNode}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-purple-500/25 flex items-center justify-center space-x-2 transition-transform active:scale-95 cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                <span>Add Root Concept</span>
              </button>
            </div>
          </div>
        )}

        {/* Floating Help Instructions (Bottom Left) */}
        <div className="absolute bottom-4 left-4 z-10 hidden md:block bg-gray-900/80 backdrop-blur-md border border-gray-800 px-3.5 py-2.5 rounded-xl shadow-lg max-w-[260px]">
          <h4 className="text-xs font-semibold text-purple-400 flex items-center mb-1">
            <HelpCircle className="w-3.5 h-3.5 mr-1" /> Quick Controls
          </h4>
          <ul className="text-[11px] text-gray-400 space-y-1">
            <li>• Click a node to inspect & edit details.</li>
            <li>• Drag handles (dots) to draw connections.</li>
            <li>• Click on an edge and hit <kbd className="bg-gray-800 px-1 border border-gray-700 rounded text-[9px]">Backspace</kbd> to delete.</li>
          </ul>
        </div>
      </div>

      {/* Premium Sliding Inspector & Settings Drawer (Right Panel) */}
      <div 
        className={`fixed md:relative top-0 right-0 h-full w-full sm:w-[350px] bg-gray-900/95 backdrop-blur-md border-l border-gray-800 shadow-2xl flex flex-col z-20 transition-transform duration-300 ${
          drawerOpen ? 'translate-x-0' : 'translate-x-full md:absolute md:translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-950/20">
          <h3 className="text-md font-bold text-white flex items-center">
            {drawerTab === 'map' ? 'Map Overview' : 'Node Inspector'}
          </h3>
          <button 
            onClick={() => setDrawerOpen(false)}
            className="p-1 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Tabs (Only enabled if a node is selected) */}
        <div className="flex border-b border-gray-800 bg-gray-950/10 px-2 pt-1.5 flex-shrink-0">
          <button
            onClick={() => setDrawerTab('map')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 text-center cursor-pointer ${
              drawerTab === 'map' 
                ? 'border-purple-500 text-purple-400 font-extrabold' 
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Map Settings
          </button>
          <button
            onClick={() => {
              if (selectedNode) setDrawerTab('node');
            }}
            disabled={!selectedNode}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 text-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
              drawerTab === 'node' 
                ? 'border-purple-500 text-purple-400 font-extrabold' 
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Node Details
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
          
          {/* TAB 1: MAP OVERVIEW & CONFIGURATIONS */}
          {drawerTab === 'map' && (
            <div className="space-y-6">
              
              {/* Comma-separated Tags configuration */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center">
                  <Tag className="w-3.5 h-3.5 mr-1.5 text-purple-400 animate-pulse" />
                  Map Tags (Comma Separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                  placeholder="e.g. History, Revolution, France"
                />
                
                {/* Visual badges rendering */}
                {tags && (
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    {tags.split(',').map((t, idx) => {
                      const tag = t.trim();
                      if (!tag) return null;
                      return (
                        <span key={idx} className="px-2.5 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/25 text-xs font-semibold rounded-lg flex items-center">
                          #{tag}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Documents Used scroll list */}
              <div className="space-y-3 pt-3 border-t border-gray-800/80">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center">
                  <Layers className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
                  Contributed Sources ({documents.length})
                </label>

                {documents.length === 0 ? (
                  <div className="text-xs text-gray-500 italic p-4 text-center border border-dashed border-gray-800 rounded-xl bg-gray-950/20">
                    No documents uploaded. Map was created from scratch manually.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {documents.map((doc) => (
                      <a
                        key={doc.id}
                        href={getDocLink(doc)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group bg-gray-950 border border-gray-800 hover:border-purple-500/40 p-3.5 rounded-xl flex items-center justify-between transition-all hover:scale-[1.01] block cursor-pointer"
                      >
                        <div className="flex items-center space-x-3 truncate mr-3">
                          {getDocumentIcon(doc.sourceType)}
                          <span className="text-xs font-semibold text-white group-hover:text-purple-400 transition-colors truncate">
                            {doc.title}
                          </span>
                        </div>
                        <span className="text-[10px] text-purple-500 group-hover:underline flex-shrink-0">
                          View →
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: SELECTED NODE INSPECTOR */}
          {drawerTab === 'node' && selectedNode && (
            <div className="space-y-6">
              
              {/* Type Switcher */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Node Level Tier
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-gray-950 p-1.5 rounded-xl border border-gray-800">
                  <button
                    onClick={() => updateNodeData('type', 'concept')}
                    className={`py-2 text-[11px] font-semibold rounded-lg flex flex-col items-center justify-center space-y-1 transition-all cursor-pointer ${
                      selectedNode.type === 'concept' 
                        ? 'bg-purple-600 text-white shadow-md font-bold' 
                        : 'text-gray-400 hover:text-white hover:bg-gray-900'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Concept</span>
                  </button>
                  <button
                    onClick={() => updateNodeData('type', 'subconcept')}
                    className={`py-2 text-[11px] font-semibold rounded-lg flex flex-col items-center justify-center space-y-1 transition-all cursor-pointer ${
                      selectedNode.type === 'subconcept' 
                        ? 'bg-purple-600/30 border border-purple-500/40 text-purple-300 shadow-sm font-bold' 
                        : 'text-gray-400 hover:text-white hover:bg-gray-900'
                    }`}
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>Branch</span>
                  </button>
                  <button
                    onClick={() => updateNodeData('type', 'detail')}
                    className={`py-2 text-[11px] font-semibold rounded-lg flex flex-col items-center justify-center space-y-1 transition-all cursor-pointer ${
                      selectedNode.type === 'detail' || !selectedNode.type
                        ? 'bg-gray-800 text-gray-200 border border-gray-700 font-bold' 
                        : 'text-gray-400 hover:text-white hover:bg-gray-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Leaf</span>
                  </button>
                </div>
              </div>

              {/* Edit Concept Label */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Concept Title Label
                </label>
                <input
                  type="text"
                  value={selectedNode.data?.label || ''}
                  onChange={(e) => updateNodeData('label', e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                  placeholder="Enter text..."
                />
              </div>

              {/* Edit Optional Description */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Detailed Notes / Content (Optional)
                </label>
                <textarea
                  rows={5}
                  value={selectedNode.data?.content || ''}
                  onChange={(e) => updateNodeData('content', e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-3 text-sm text-gray-300 outline-none resize-none"
                  placeholder="Write a longer explanation, definitions, or custom notes..."
                />
              </div>

              {/* Quick Spawning Child Node */}
              <div className="pt-2">
                <button
                  onClick={addChildNode}
                  className="w-full py-3 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-600/20 text-purple-400 hover:text-purple-300 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer animate-pulse"
                >
                  <Plus className="w-4 h-4" />
                  <span>Grow Child Node</span>
                </button>
              </div>

            </div>
          )}
        </div>

        {/* Drawer Footer (Only visible on node tab for deletion) */}
        {drawerTab === 'node' && selectedNode && (
          <div className="px-5 py-4 border-t border-gray-800 bg-gray-950/50 flex-shrink-0">
            <button
              onClick={deleteSelectedNode}
              className="w-full py-2.5 bg-rose-900/10 border border-rose-900/20 hover:bg-rose-900/20 text-rose-400 hover:text-rose-300 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Node & Edges</span>
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

export default function MapEditorWithProvider() {
  return (
    <ReactFlowProvider>
      <MapEditor />
    </ReactFlowProvider>
  );
}
