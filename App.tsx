import React, { useState } from 'react';
import { DemoMode } from './types';
import ChatView from './components/ChatView';
import FunctionView from './components/FunctionView';
import EmbeddingView from './components/EmbeddingView';
import { MessageSquare, Cpu, Network, Info } from 'lucide-react';

const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<DemoMode>(DemoMode.ChatConfig);
  const [apiKeyMissing, setApiKeyMissing] = useState(!process.env.API_KEY);

  if (apiKeyMissing) {
     // Fallback if no API key is detected
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans selection:bg-blue-500/30">
      
      {/* Sidebar - Increased width from w-64 to w-80 for larger text */}
      <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
        <div className="p-8 border-b border-gray-800">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Gemini Tutor
          </h1>
          <p className="text-sm text-gray-400 mt-2">Interactive API Learning</p>
        </div>

        <nav className="flex-1 p-6 space-y-4">
          <button
            onClick={() => setCurrentMode(DemoMode.ChatConfig)}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all ${
              currentMode === DemoMode.ChatConfig 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <MessageSquare size={28} />
            <div className="text-left">
              <div className="font-bold text-lg">Chat & Config</div>
              <div className="text-sm opacity-80">History, Sys Instruct</div>
            </div>
          </button>

          <button
            onClick={() => setCurrentMode(DemoMode.FunctionCalling)}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all ${
              currentMode === DemoMode.FunctionCalling 
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Cpu size={28} />
            <div className="text-left">
              <div className="font-bold text-lg">Function Calling</div>
              <div className="text-sm opacity-80">Tools, JSON, Logic</div>
            </div>
          </button>

          <button
            onClick={() => setCurrentMode(DemoMode.Embeddings)}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all ${
              currentMode === DemoMode.Embeddings 
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/50' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Network size={28} />
            <div className="text-left">
              <div className="font-bold text-lg">Embeddings</div>
              <div className="text-sm opacity-80">Vectors & Memory</div>
            </div>
          </button>
        </nav>

        <div className="p-6 border-t border-gray-800">
          <div className="bg-gray-800 rounded-lg p-4 flex gap-3 items-start">
            <Info className="text-blue-400 shrink-0 mt-1" size={20} />
            <p className="text-sm text-gray-400 leading-relaxed">
              Using <strong>Gemini 2.5 Flash</strong>. 
              Optimized for presentation.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-hidden h-full relative">
        {/* Background decorations */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
           <div className="absolute -top-20 -right-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
           <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 h-full">
          {currentMode === DemoMode.ChatConfig && <ChatView />}
          {currentMode === DemoMode.FunctionCalling && <FunctionView />}
          {currentMode === DemoMode.Embeddings && <EmbeddingView />}
        </div>
      </main>
    </div>
  );
};

export default App;