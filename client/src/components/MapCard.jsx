import React, { useState, useRef, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Map as MapIcon, Trash2, Calendar, MoreVertical, FolderPlus, Tag } from 'lucide-react';
import axios from 'axios';

const MapCard = ({ map, onNavigate, onDelete, onMapUpdate }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showFolderSubmenu, setShowFolderSubmenu] = useState(false);
  const [showTagSubmenu, setShowTagSubmenu] = useState(false);
  const [availableFolders, setAvailableFolders] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  
  const menuRef = useRef();

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `map-${map.id}`,
    data: {
      type: 'map',
      mapId: map.id
    }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  } : undefined;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
        setShowFolderSubmenu(false);
        setShowTagSubmenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchMenuData = async () => {
    try {
      const [foldersRes, tagsRes] = await Promise.all([
        axios.get('/folders'),
        axios.get('/tags')
      ]);
      setAvailableFolders(foldersRes.data);
      setAvailableTags(tagsRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMenuClick = (e) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
    if (!showMenu) {
      fetchMenuData();
    }
  };

  const handleToggleFolder = async (folderId, e) => {
    e.stopPropagation();
    try {
      const inFolder = map.folders && map.folders.some(f => f.id === folderId);
      if (inFolder) {
        await axios.delete(`/folders/${folderId}/maps/${map.id}`);
      } else {
        await axios.post(`/folders/${folderId}/maps`, { mapId: map.id });
      }
      onMapUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleTag = async (tagId, e) => {
    e.stopPropagation();
    try {
      const hasTag = map.tags && map.tags.some(t => t.id === tagId);
      if (hasTag) {
        await axios.delete(`/maps/${map.id}/tags/${tagId}`);
      } else {
        await axios.post(`/maps/${map.id}/tags`, { tagId });
      }
      onMapUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onNavigate(map.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        handleMenuClick(e);
      }}
      className="group bg-gray-900 border border-gray-800/80 hover:border-purple-500/50 rounded-2xl p-5 shadow-sm hover:shadow-purple-500/5 flex flex-col justify-between transition-all hover:-translate-y-1 cursor-pointer relative"
    >
      <div>
        <div className="flex justify-between items-start mb-3">
          <span className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
            <MapIcon className="w-5 h-5" />
          </span>
          
          <div className="flex items-center space-x-1">
            <div className="relative" ref={menuRef}>
              <button
                onClick={handleMenuClick}
                className="p-1.5 hover:bg-gray-800 text-gray-500 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-800 rounded-xl shadow-xl z-50 overflow-hidden text-sm py-1">
                  
                  {/* Folders Submenu Toggle */}
                  <div 
                    className="px-4 py-2 hover:bg-gray-800 text-gray-300 cursor-pointer flex justify-between items-center relative"
                    onMouseEnter={() => { setShowFolderSubmenu(true); setShowTagSubmenu(false); }}
                    onMouseLeave={() => setShowFolderSubmenu(false)}
                  >
                    <div className="flex items-center"><FolderPlus className="w-4 h-4 mr-2"/> Folders</div>
                    <span>▶</span>
                    
                    {showFolderSubmenu && (
                      <div className="absolute top-0 right-full mr-1 w-48 bg-gray-900 border border-gray-800 rounded-xl shadow-xl py-1">
                        {availableFolders.length === 0 ? (
                          <div className="px-4 py-2 text-gray-500 italic">No folders</div>
                        ) : (
                          availableFolders.map(folder => {
                            const inFolder = map.folders && map.folders.some(f => f.id === folder.id);
                            return (
                              <div 
                                key={folder.id} 
                                onClick={(e) => handleToggleFolder(folder.id, e)}
                                className="px-4 py-2 hover:bg-gray-800 text-gray-300 cursor-pointer flex items-center"
                              >
                                <input type="checkbox" checked={inFolder} readOnly className="mr-2 rounded border-gray-700 bg-gray-800 text-purple-600" />
                                <span className="truncate">{folder.name}</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tags Submenu Toggle */}
                  <div 
                    className="px-4 py-2 hover:bg-gray-800 text-gray-300 cursor-pointer flex justify-between items-center relative"
                    onMouseEnter={() => { setShowTagSubmenu(true); setShowFolderSubmenu(false); }}
                    onMouseLeave={() => setShowTagSubmenu(false)}
                  >
                    <div className="flex items-center"><Tag className="w-4 h-4 mr-2"/> Tags</div>
                    <span>▶</span>
                    
                    {showTagSubmenu && (
                      <div className="absolute top-0 right-full mr-1 w-48 bg-gray-900 border border-gray-800 rounded-xl shadow-xl py-1 max-h-64 overflow-y-auto">
                        {availableTags.length === 0 ? (
                          <div className="px-4 py-2 text-gray-500 italic">No tags</div>
                        ) : (
                          availableTags.map(tag => {
                            const hasTag = map.tags && map.tags.some(t => t.id === tag.id);
                            return (
                              <div 
                                key={tag.id} 
                                onClick={(e) => handleToggleTag(tag.id, e)}
                                className="px-4 py-2 hover:bg-gray-800 text-gray-300 cursor-pointer flex items-center"
                              >
                                <input type="checkbox" checked={hasTag} readOnly className="mr-2 rounded border-gray-700 bg-gray-800 text-purple-600" />
                                <div className="w-2 h-2 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: tag.color }} />
                                <span className="truncate">{tag.name}</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  <div className="h-px bg-gray-800 my-1"></div>

                  <div 
                    onClick={(e) => onDelete(map.id, e)}
                    className="px-4 py-2 hover:bg-rose-500/20 text-rose-400 cursor-pointer flex items-center"
                  >
                    <Trash2 className="w-4 h-4 mr-2"/> Delete Map
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <h4 className="text-md font-bold text-white group-hover:text-purple-400 transition-colors line-clamp-2">
          {map.title}
        </h4>
        
        {/* Folders Badges */}
        {map.folders && map.folders.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {map.folders.map(f => (
              <span key={f.id} className="px-1.5 py-0.5 bg-gray-800 text-gray-300 text-[10px] font-medium rounded flex items-center">
                📁 {f.name}
              </span>
            ))}
          </div>
        )}

        {/* Tags Chips */}
        {map.tags && map.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {map.tags.map(t => (
              <span 
                key={t.id} 
                className="px-2 py-0.5 text-[10px] font-bold rounded-md flex items-center border border-transparent"
                style={{ backgroundColor: `${t.color}20`, color: t.color, borderColor: `${t.color}40` }}
              >
                <div className="w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: t.color }} />
                {t.name}
              </span>
            ))}
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
  );
};

export default MapCard;
