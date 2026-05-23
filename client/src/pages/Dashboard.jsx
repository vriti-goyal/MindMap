import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Map as MapIcon, Upload, Search } from 'lucide-react';

const Dashboard = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <MapIcon className="h-8 w-8 text-purple-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">MindMap AI</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">{user?.email}</span>
              <button
                onClick={logout}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
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
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              My Knowledge Base
            </h2>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4 space-x-3">
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              <Upload className="h-4 w-4 mr-2 text-gray-500" />
              Upload Document
            </button>
            <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700">
              <MapIcon className="h-4 w-4 mr-2" />
              Create Map
            </button>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* Documents Section */}
          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 col-span-1">
            <div className="p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center mb-4">
                Recent Documents
              </h3>
              <div className="text-sm text-gray-500 flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-200 rounded-lg">
                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                <p>No documents uploaded yet</p>
              </div>
            </div>
          </div>

          {/* Maps Section */}
          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 col-span-2">
            <div className="p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center mb-4">
                My Mind Maps
              </h3>
              
              <div className="mb-4">
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="focus:ring-purple-500 focus:border-purple-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border outline-none"
                    placeholder="Search mind maps..."
                  />
                </div>
              </div>

              <div className="text-sm text-gray-500 flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-200 rounded-lg mt-4">
                <MapIcon className="h-8 w-8 text-gray-400 mb-2" />
                <p>No mind maps created yet</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
