import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus } from 'lucide-react';

const TagBar = ({ selectedTags, onTagToggle }) => {
  const [tags, setTags] = useState([]);
  const [showNewTagPopover, setShowNewTagPopover] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');

  const presetColors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#06b6d4', '#3b82f6', '#6366f1', '#a855f7'
  ];

  const fetchTags = async () => {
    try {
      const res = await axios.get('/tags');
      setTags(res.data);
    } catch (err) {
      console.error('Failed to fetch tags', err);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleCreateTag = async (e) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    try {
      await axios.post('/tags', { name: newTagName, color: newTagColor });
      setNewTagName('');
      setShowNewTagPopover(false);
      fetchTags();
    } catch (err) {
      console.error('Failed to create tag', err);
      alert('Error creating tag. It might already exist.');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mt-4 relative">
      {tags.map((tag) => {
        const isSelected = selectedTags.includes(tag.id);
        return (
          <button
            key={tag.id}
            onClick={() => onTagToggle(tag.id)}
            className={`flex items-center px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              isSelected ? 'border-transparent shadow-sm' : 'border-gray-800 hover:border-gray-700'
            }`}
            style={{
              backgroundColor: isSelected ? tag.color : 'transparent',
              color: isSelected ? '#fff' : '#d1d5db',
            }}
          >
            <span
              className="w-2 h-2 rounded-full mr-2"
              style={{ backgroundColor: isSelected ? '#fff' : tag.color }}
            />
            {tag.name} <span className="ml-1.5 opacity-70">({tag.mapCount})</span>
          </button>
        );
      })}

      <div className="relative">
        <button
          onClick={() => setShowNewTagPopover(!showNewTagPopover)}
          className="flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border border-dashed border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-all"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          New Tag
        </button>

        {showNewTagPopover && (
          <div className="absolute top-full mt-2 left-0 z-50 bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-xl w-64">
            <h4 className="text-sm font-bold text-white mb-3">Create New Tag</h4>
            <form onSubmit={handleCreateTag} className="space-y-3">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tag name"
                className="w-full bg-gray-950 border border-gray-800 focus:border-purple-500 rounded-lg px-3 py-2 text-sm text-white outline-none"
                autoFocus
              />
              <div className="flex flex-wrap gap-2">
                {presetColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewTagColor(c)}
                    className={`w-6 h-6 rounded-full border-2 ${
                      newTagColor === c ? 'border-white scale-110' : 'border-transparent'
                    } transition-all`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-1.5 rounded-lg text-xs font-bold transition-colors"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewTagPopover(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-1.5 rounded-lg text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default TagBar;
