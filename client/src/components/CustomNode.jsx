import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Sparkles, GitCommit, FileText } from 'lucide-react';

export const MindMapNode = ({ data, selected, type }) => {
  // Determine styles based on node type
  let cardClass = '';
  let icon = null;

  switch (type) {
    case 'concept':
      cardClass = 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-none shadow-lg shadow-purple-500/20 px-5 py-3 rounded-xl min-w-[160px] text-center font-semibold';
      icon = <Sparkles className="w-4 h-4 mr-2 inline" />;
      break;
    case 'subconcept':
      cardClass = 'bg-white border-2 border-purple-300 text-gray-800 shadow-md px-4 py-2.5 rounded-lg min-w-[140px] text-center font-medium hover:border-purple-500 transition-colors';
      icon = <GitCommit className="w-4 h-4 mr-1.5 text-purple-500 inline" />;
      break;
    case 'detail':
    default:
      cardClass = 'bg-gray-50 border border-gray-200 text-gray-600 shadow-sm px-3.5 py-2 rounded-md min-w-[120px] text-center text-sm font-normal hover:bg-white hover:border-gray-300 transition-all';
      icon = <FileText className="w-3.5 h-3.5 mr-1 text-gray-400 inline" />;
      break;
  }

  // Active selected state styling
  const activeBorderClass = selected 
    ? 'ring-2 ring-purple-500 ring-offset-2 scale-[1.03] transition-all'
    : 'hover:scale-[1.01] transition-transform duration-200';

  return (
    <div className={`relative ${cardClass} ${activeBorderClass} group flex flex-col justify-center items-center`}>
      {/* Handles */}
      <Handle 
        type="target" 
        position={Position.Top} 
        id="top"
        className="w-2.5 h-2.5 !bg-purple-500 !border-2 !border-white group-hover:scale-125 transition-transform" 
      />
      
      <div className="flex items-center justify-center pointer-events-none">
        {icon}
        <span className="truncate max-w-[200px]">{data.label}</span>
      </div>

      {data.content && (
        <div className="text-[10px] opacity-75 mt-1 pointer-events-none max-w-[180px] truncate">
          {data.content}
        </div>
      )}

      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="bottom"
        className="w-2.5 h-2.5 !bg-purple-500 !border-2 !border-white group-hover:scale-125 transition-transform" 
      />
    </div>
  );
};

export default MindMapNode;
