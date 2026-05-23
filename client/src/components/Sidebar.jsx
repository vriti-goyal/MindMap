import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useDroppable } from '@dnd-kit/core';
import { ChevronRight, ChevronDown, Folder as FolderIcon, Plus, MoreVertical, Edit2, Trash2 } from 'lucide-react';

const FolderNode = ({ folder, level, onSelectFolder, selectedFolderId, fetchFolders, onRename, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [showMenu, setShowMenu] = useState(false);

  // Droppable zone for Dnd Kit
  const { setNodeRef, isOver } = useDroppable({
    id: `folder-${folder.id}`,
    data: {
      type: 'folder',
      folderId: folder.id
    }
  });

  const hasSubFolders = folder.subFolders && folder.subFolders.length > 0;
  const isSelected = selectedFolderId === folder.id;

  const handleSaveRename = async () => {
    if (editName.trim() && editName !== folder.name) {
      await onRename(folder.id, editName);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSaveRename();
    if (e.key === 'Escape') {
      setEditName(folder.name);
      setIsEditing(false);
    }
  };

  return (
    <div className="select-none">
      <div 
        ref={setNodeRef}
        onClick={() => onSelectFolder(folder.id)}
        className={`flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer group transition-colors ${
          isSelected ? 'bg-purple-600/20 text-purple-300' : 
          isOver ? 'bg-purple-600/30 border border-purple-500' : 'hover:bg-gray-800 text-gray-300'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        <div className="flex items-center flex-1 min-w-0">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-0.5 hover:bg-gray-700 rounded mr-1 invisible group-hover:visible transition-all"
            style={{ visibility: hasSubFolders ? 'visible' : undefined }}
          >
            {hasSubFolders ? (
              expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
            ) : <div className="w-3.5 h-3.5" />}
          </button>
          
          <FolderIcon className={`w-4 h-4 mr-2 flex-shrink-0 ${isSelected ? 'text-purple-400' : 'text-gray-500'}`} />
          
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveRename}
              onKeyDown={handleKeyDown}
              className="bg-gray-950 border border-gray-700 text-sm text-white px-1.5 py-0.5 rounded outline-none w-full"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-sm truncate flex-1 font-medium">
              {folder.name}
            </span>
          )}
        </div>

        {!isEditing && (
          <div className="flex items-center ml-2">
            <span className={`text-xs ${isSelected ? 'text-purple-300/70' : 'text-gray-500'} group-hover:hidden`}>
              {folder.mapCount}
            </span>
            <div className="hidden group-hover:flex items-center space-x-1">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(folder.id, folder.name);
                }}
                className="p-1 hover:bg-rose-500/20 rounded text-gray-400 hover:text-rose-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {expanded && hasSubFolders && (
        <div className="mt-0.5">
          {folder.subFolders.map(sub => (
            <FolderNode 
              key={sub.id} 
              folder={sub} 
              level={level + 1} 
              onSelectFolder={onSelectFolder}
              selectedFolderId={selectedFolderId}
              fetchFolders={fetchFolders}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const Sidebar = ({ selectedFolderId, onSelectFolder }) => {
  const [folders, setFolders] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const fetchFolders = async () => {
    try {
      const res = await axios.get('/folders');
      setFolders(res.data);
    } catch (err) {
      console.error('Failed to fetch folders', err);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  const totalMaps = folders.reduce((sum, f) => {
    const subSum = f.subFolders ? f.subFolders.reduce((s, sub) => s + sub.mapCount, 0) : 0;
    return sum + f.mapCount + subSum;
  }, 0); // Note: This might not equal total maps if some maps are unassigned. Let's just use it as a rough count or leave it out if we can't get true total.

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setIsCreating(false);
      return;
    }
    try {
      await axios.post('/folders', { name: newFolderName });
      setNewFolderName('');
      setIsCreating(false);
      fetchFolders();
    } catch (err) {
      console.error(err);
      alert('Failed to create folder');
    }
  };

  const handleRenameFolder = async (id, name) => {
    try {
      await axios.patch(`/folders/${id}`, { name });
      fetchFolders();
    } catch (err) {
      console.error(err);
      alert('Failed to rename folder');
    }
  };

  const handleDeleteFolder = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This will unassign maps but not delete them.`)) {
      try {
        await axios.delete(`/folders/${id}`);
        if (selectedFolderId === id) onSelectFolder(null);
        fetchFolders();
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="w-64 flex-shrink-0 bg-gray-900/50 border-r border-gray-800 hidden md:flex flex-col h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto">
      <div className="p-4 flex-1">
        <div className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 px-2">Folders</h3>
          
          <div 
            onClick={() => onSelectFolder(null)}
            className={`flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${
              selectedFolderId === null ? 'bg-purple-600/20 text-purple-300' : 'hover:bg-gray-800 text-gray-300'
            }`}
          >
            <div className="flex items-center">
              <FolderIcon className={`w-4 h-4 mr-2 ${selectedFolderId === null ? 'text-purple-400' : 'text-gray-500'}`} />
              <span className="text-sm font-medium">All Maps</span>
            </div>
          </div>

          <div className="mt-2 space-y-0.5">
            {folders.map(folder => (
              <FolderNode 
                key={folder.id} 
                folder={folder} 
                level={0}
                onSelectFolder={onSelectFolder}
                selectedFolderId={selectedFolderId}
                fetchFolders={fetchFolders}
                onRename={handleRenameFolder}
                onDelete={handleDeleteFolder}
              />
            ))}
          </div>

          {isCreating && (
            <div className="mt-2 flex items-center px-2 py-1.5 bg-gray-800 rounded-lg">
              <FolderIcon className="w-4 h-4 mr-2 text-gray-500" />
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onBlur={handleCreateFolder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') {
                    setNewFolderName('');
                    setIsCreating(false);
                  }
                }}
                className="bg-transparent border-none text-sm text-white w-full outline-none"
                placeholder="Folder name"
                autoFocus
              />
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-gray-800 bg-gray-900/80 sticky bottom-0">
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center justify-center w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Folder
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
