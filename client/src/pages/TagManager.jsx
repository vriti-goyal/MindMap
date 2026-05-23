import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const TagManager = () => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTag, setEditingTag] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#6366f1');
  const navigate = useNavigate();

  const presetColors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#06b6d4', '#3b82f6', '#6366f1', '#a855f7',
    '#ec4899', '#64748b'
  ];

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const response = await fetch('/api/tags', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch tags');
      const data = await response.json();
      setTags(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTag = async (id) => {
    try {
      const response = await fetch(`/api/tags/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name: editName, color: editColor })
      });
      if (response.ok) {
        fetchTags();
        setEditingTag(null);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to update tag');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteTag = async (id, name, mapCount) => {
    if (window.confirm(`Are you sure you want to delete the "${name}" tag? It will be removed from ${mapCount} maps.`)) {
      try {
        const response = await fetch(`/api/tags/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (response.ok) {
          fetchTags();
        }
      } catch (error) {
        console.error(error);
      }
    }
  };

  const startEditing = (tag) => {
    setEditingTag(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="text-slate-500 hover:text-slate-800 transition-colors font-medium flex items-center gap-2"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-xl font-bold text-slate-800">Tag Manager</h1>
        </div>
      </header>
      
      <main className="flex-1 max-w-4xl w-full mx-auto p-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                <th className="px-6 py-4 font-medium w-16">Color</th>
                <th className="px-6 py-4 font-medium">Tag Name</th>
                <th className="px-6 py-4 font-medium w-32">Maps</th>
                <th className="px-6 py-4 font-medium w-48 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-slate-500">Loading tags...</td>
                </tr>
              ) : tags.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-slate-500">No tags found. Create some on the Dashboard.</td>
                </tr>
              ) : (
                tags.map(tag => (
                  <tr key={tag.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      {editingTag === tag.id ? (
                        <div className="flex items-center gap-2">
                          <input 
                            type="color" 
                            value={editColor} 
                            onChange={(e) => setEditColor(e.target.value)}
                            className="w-8 h-8 p-0 border-0 rounded cursor-pointer"
                          />
                        </div>
                      ) : (
                        <div 
                          className="w-6 h-6 rounded-full shadow-sm" 
                          style={{ backgroundColor: tag.color }}
                        />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingTag === tag.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                          autoFocus
                        />
                      ) : (
                        <span className="font-medium text-slate-700">{tag.name}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {tag.mapCount}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {editingTag === tag.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleUpdateTag(tag.id)}
                            className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
                          >
                            Save
                          </button>
                          <button 
                            onClick={() => setEditingTag(null)}
                            className="px-3 py-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2 opacity-0 hover:opacity-100 transition-opacity" style={{ opacity: 1 }}>
                          <button 
                            onClick={() => startEditing(tag)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => handleDeleteTag(tag.id, tag.name, tag.mapCount)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Color Palette Helper when editing */}
        {editingTag && (
          <div className="mt-4 p-4 bg-white rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-medium text-slate-700 mb-2">Preset Colors</h3>
            <div className="flex gap-2 flex-wrap">
              {presetColors.map(c => (
                <button
                  key={c}
                  onClick={() => setEditColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${editColor === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TagManager;
