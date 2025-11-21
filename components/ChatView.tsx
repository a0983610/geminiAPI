import React, { useState, useRef, useEffect } from 'react';
import { ModelConfig, ChatMessage } from '../types';
import { generateChatResponse } from '../services/geminiService';
import { Send, RotateCcw, Code2, MessageSquare, ArrowDown, Server, Database, ArrowUpCircle } from 'lucide-react';

interface ApiLogEntry {
  timestamp: string;
  turnIndex: number;
  requestPayload: any;
  responseData: any;
}

const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiLogs, setApiLogs] = useState<ApiLogEntry[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const [config, setConfig] = useState<ModelConfig>({
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 1000,
    systemInstruction: "You are a helpful AI assistant explaining technical concepts clearly.",
  });

  const [showDevMode, setShowDevMode] = useState(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToLogBottom = () => {
    if (logEndRef.current) {
        logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(scrollToBottom, [messages, loading]);
  useEffect(scrollToLogBottom, [apiLogs, loading, showDevMode]);

  const handleSend = async () => {
    if (!input.trim()) return;

    // 1. Update Chat UI immediately
    const userMsg: ChatMessage = { role: 'user', text: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      // 2. Prepare Data for API Service
      // Note: The service takes 'history' (previous messages) and 'current message' separately
      const historyForService = messages
        .filter(m => m.role !== 'system') // System is handled via config
        .map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        }));

      // 3. Prepare Visualization Data (What the API actually receives)
      // We reconstruct the exact payload the SDK sends to visualize statelessness
      const fullContentsPayload = [
        ...historyForService,
        { role: 'user', parts: [{ text: input }] }
      ];

      const visualizationRequest = {
        model: 'gemini-2.5-flash',
        systemInstruction: config.systemInstruction,
        contents: fullContentsPayload, // This shows the GROWING array
        generationConfig: {
           temperature: config.temperature,
           topK: config.topK,
           topP: config.topP,
           maxOutputTokens: config.maxOutputTokens,
        }
      };

      // 4. Call API
      const response = await generateChatResponse(historyForService, input, config);
      
      // 5. Update Logs
      const newLog: ApiLogEntry = {
        timestamp: new Date().toLocaleTimeString(),
        turnIndex: apiLogs.length + 1,
        requestPayload: visualizationRequest,
        responseData: response // The raw response object from SDK
      };
      setApiLogs(prev => [...prev, newLog]);

      // 6. Update UI with Response
      const text = response.text || "No response text generated.";
      setMessages(prev => [...prev, { role: 'model', text }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'model', text: `Error: ${e.message}` }]);
      // Log error as well
      setApiLogs(prev => [...prev, {
         timestamp: new Date().toLocaleTimeString(),
         turnIndex: prev.length + 1,
         requestPayload: { error: "Request Failed" },
         responseData: { error: e.message }
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setMessages([]);
    setApiLogs([]);
  };

  return (
    <div className="flex h-full gap-6">
      {/* Left Panel: Chat Interface */}
      {/* Logic updated: Fixed width (400px) if logs are shown, otherwise flex-1 */}
      <div className={`${showDevMode ? 'w-[400px] shrink-0' : 'flex-1'} flex flex-col bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700 transition-all duration-300`}>
        {/* Header */}
        <div className="p-5 bg-gray-900 border-b border-gray-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <MessageSquare className="text-blue-400" size={24} />
            <h2 className="font-bold text-xl text-white">Chat Demo</h2>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowDevMode(!showDevMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition border ${
                showDevMode 
                  ? 'bg-blue-900/50 text-blue-200 border-blue-700' 
                  : 'bg-gray-700 text-gray-300 border-transparent hover:bg-gray-600'
              }`}
              title="Toggle JSON Inspector"
            >
              <Code2 size={18} />
              {showDevMode ? 'Hide Logs' : 'Show Logs'}
            </button>
            <button 
              onClick={clearAll}
              className="p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-red-400 transition"
              title="Clear History"
            >
              <RotateCcw size={22} />
            </button>
          </div>
        </div>

        {/* Config Bar */}
        <div className="bg-gray-800 p-4 border-b border-gray-700 flex flex-wrap gap-6 items-center text-sm">
           <div className="flex items-center gap-3">
              <label className="text-gray-400 font-medium">Temp:</label>
              <input 
                type="range" min="0" max="2" step="0.1"
                value={config.temperature}
                onChange={(e) => setConfig({...config, temperature: parseFloat(e.target.value)})}
                className="w-32 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-blue-300 w-8 text-center font-mono font-bold">{config.temperature}</span>
           </div>
           <div className="flex items-center gap-3 flex-1">
              <label className="text-gray-400 font-medium shrink-0">System Prompt:</label>
              <input 
                type="text"
                value={config.systemInstruction}
                onChange={(e) => setConfig({...config, systemInstruction: e.target.value})}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
              />
           </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0d1117]">
           {messages.length === 0 && (
             <div className="text-center text-gray-500 mt-20 text-lg">
               <p>Send a message to see the API interaction log.</p>
             </div>
           )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-5 rounded-xl shadow-md ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-gray-700 text-gray-100 rounded-bl-none border border-gray-600'
              }`}>
                <div className="text-xs opacity-50 mb-2 uppercase tracking-wider font-bold">{msg.role}</div>
                <div className="whitespace-pre-wrap text-lg leading-relaxed">{msg.text}</div>
              </div>
            </div>
          ))}
          {loading && (
             <div className="flex justify-start">
               <div className="bg-gray-700 p-5 rounded-xl rounded-bl-none flex items-center gap-3">
                 <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce"></div>
                 <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                 <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce delay-150"></div>
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 bg-gray-800 border-t border-gray-700">
          <div className="flex gap-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type a message..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-6 py-4 text-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
            />
            <button
              onClick={handleSend}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-xl transition disabled:opacity-50"
            >
              <Send size={28} />
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel: Request / Response Log - Turn Based */}
      {showDevMode && (
        // Layout Updated: Now flex-1 to take remaining space (primary focus)
        <div className="flex-1 flex flex-col bg-[#1e1e1e] rounded-xl border border-gray-700 shadow-2xl overflow-hidden shrink-0 min-w-0">
          <div className="p-4 bg-black/30 border-b border-gray-700 flex items-center gap-3">
             <Server className="text-green-400" size={24} />
             <span className="text-xl font-bold text-gray-200">Request / Response Log</span>
          </div>
          
          <div className="flex-1 overflow-auto p-6 custom-scrollbar bg-[#0d1117] space-y-12">
            
            {apiLogs.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-600 opacity-60 gap-4">
                    <Database size={48} />
                    <p className="text-lg text-center max-w-[200px]">
                        Interactions will appear here pairwise (Request & Response)
                    </p>
                </div>
            )}

            {apiLogs.map((log, idx) => (
              <div key={idx} className="animate-fade-in relative pl-6 border-l-2 border-gray-800">
                {/* Timeline Connector Dot */}
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-gray-700 border-2 border-[#0d1117]" />

                <div className="mb-8">
                    {/* Header for this Turn */}
                    <div className="flex items-center gap-3 mb-4 opacity-50">
                        <span className="font-mono text-sm font-bold bg-gray-800 px-2 py-1 rounded text-gray-300">TURN #{log.turnIndex}</span>
                        <span className="text-xs text-gray-500">{log.timestamp}</span>
                    </div>

                    {/* 1. REQUEST BOX */}
                    <div className="mb-4">
                        <div className="text-blue-400 font-bold text-sm mb-2 flex items-center gap-2 uppercase tracking-wider">
                            <ArrowUpCircle size={18} /> Outgoing Request
                        </div>
                        <div className="bg-blue-950/20 border border-blue-500/30 rounded-lg p-4 shadow-sm relative group">
                            <div className="absolute top-2 right-2 px-2 py-1 bg-blue-900/50 rounded text-[10px] text-blue-300 font-bold border border-blue-800 opacity-70">
                                PAYLOAD
                            </div>
                            {/* Removed max-h and overflow-y-auto for easier full reading */}
                            <pre className="text-base font-mono text-blue-100 whitespace-pre-wrap break-all leading-relaxed custom-scrollbar">
                                {JSON.stringify(log.requestPayload, null, 2)}
                            </pre>
                        </div>
                        {/* Hint text explaining what just happened */}
                        <div className="mt-1 text-xs text-blue-500/70 px-1 italic">
                           *Contains full conversation history + new message
                        </div>
                    </div>

                    {/* Arrow Down */}
                    <div className="flex justify-center mb-4">
                        <ArrowDown className="text-gray-600 animate-pulse" size={24} />
                    </div>

                    {/* 2. RESPONSE BOX */}
                    <div>
                        <div className="text-orange-400 font-bold text-sm mb-2 flex items-center gap-2 uppercase tracking-wider">
                            <ArrowDown className="rotate-0" size={18} /> Incoming Response
                        </div>
                        <div className="bg-orange-950/20 border border-orange-500/30 rounded-lg p-4 shadow-sm relative group">
                             <div className="absolute top-2 right-2 px-2 py-1 bg-orange-900/50 rounded text-[10px] text-orange-300 font-bold border border-orange-800 opacity-70">
                                DATA
                            </div>
                            {/* Removed max-h and overflow-y-auto for easier full reading */}
                            <pre className="text-base font-mono text-orange-100 whitespace-pre-wrap break-all leading-relaxed custom-scrollbar">
                                {JSON.stringify(log.responseData, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
              </div>
            ))}
            
            {loading && (
                <div className="pl-6 border-l-2 border-gray-800 animate-pulse">
                     <div className="text-blue-400 font-bold text-sm mb-2 flex items-center gap-2 uppercase tracking-wider opacity-50">
                        <ArrowUpCircle size={18} /> Sending Request...
                    </div>
                    <div className="h-20 bg-gray-800/50 rounded-lg w-full mb-4 border border-gray-700/50"></div>
                </div>
            )}
            
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatView;