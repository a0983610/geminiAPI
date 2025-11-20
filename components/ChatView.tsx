import React, { useState, useRef, useEffect } from 'react';
import { ModelConfig, ChatMessage } from '../types';
import { generateChatResponse } from '../services/geminiService';
import { Send, Settings, RotateCcw, Code2, MessageSquare } from 'lucide-react';

const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = { role: 'user', text: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const history = newMessages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        }));

      const response = await generateChatResponse(history, input, config);
      const text = response.text || "No response text generated.";
      
      setMessages(prev => [...prev, { role: 'model', text }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'model', text: `Error: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  // Construct the API Payload object for visualization
  const apiPayload = {
    model: "gemini-2.5-flash",
    systemInstruction: {
      parts: [{ text: config.systemInstruction }]
    },
    generationConfig: {
      temperature: config.temperature,
      topK: config.topK,
      topP: config.topP,
      maxOutputTokens: config.maxOutputTokens,
    },
    contents: messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }))
  };

  return (
    <div className="flex h-full gap-4">
      {/* Left Panel: Chat Interface */}
      <div className="flex-1 flex flex-col bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700 transition-all duration-300">
        {/* Header */}
        <div className="p-4 bg-gray-900 border-b border-gray-700 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <MessageSquare className="text-blue-400" size={20} />
            <h2 className="font-bold text-white">Chat Demo</h2>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowDevMode(!showDevMode)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition border ${
                showDevMode 
                  ? 'bg-blue-900/50 text-blue-200 border-blue-700' 
                  : 'bg-gray-700 text-gray-300 border-transparent hover:bg-gray-600'
              }`}
              title="Toggle JSON Inspector"
            >
              <Code2 size={14} />
              {showDevMode ? 'Hide API JSON' : 'Show API JSON'}
            </button>
            <button 
              onClick={() => setMessages([])}
              className="p-2 rounded text-gray-400 hover:bg-gray-700 hover:text-red-400 transition"
              title="Clear History"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </div>

        {/* Config Bar (Compact) */}
        <div className="bg-gray-800 p-3 border-b border-gray-700 flex flex-wrap gap-4 items-center text-xs">
           <div className="flex items-center gap-2">
              <label className="text-gray-400">Temp:</label>
              <input 
                type="range" min="0" max="2" step="0.1"
                value={config.temperature}
                onChange={(e) => setConfig({...config, temperature: parseFloat(e.target.value)})}
                className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-blue-300 w-6">{config.temperature}</span>
           </div>
           <div className="flex items-center gap-2 flex-1">
              <label className="text-gray-400 shrink-0">System Prompt:</label>
              <input 
                type="text"
                value={config.systemInstruction}
                onChange={(e) => setConfig({...config, systemInstruction: e.target.value})}
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-gray-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
           </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0d1117]">
           {messages.length === 0 && (
             <div className="text-center text-gray-500 mt-20">
               <p>Send a message to see how the JSON <code>contents</code> array grows.</p>
             </div>
           )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-lg ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-gray-700 text-gray-100 rounded-bl-none border border-gray-600'
              }`}>
                <div className="text-[10px] opacity-50 mb-1 uppercase tracking-wider font-bold">{msg.role}</div>
                <div className="whitespace-pre-wrap text-sm">{msg.text}</div>
              </div>
            </div>
          ))}
          {loading && (
             <div className="flex justify-start">
               <div className="bg-gray-700 p-3 rounded-lg rounded-bl-none flex items-center gap-2">
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-gray-800 border-t border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type a message..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleSend}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition disabled:opacity-50"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel: JSON Inspector */}
      {showDevMode && (
        <div className="w-[450px] flex flex-col bg-[#1e1e1e] rounded-xl border border-gray-700 shadow-2xl overflow-hidden">
          <div className="p-3 bg-black/30 border-b border-gray-700 flex items-center gap-2">
             <Code2 className="text-green-400" size={16} />
             <span className="text-sm font-bold text-gray-200">API Payload Structure</span>
          </div>
          <div className="flex-1 overflow-auto p-4 custom-scrollbar">
            <div className="text-xs font-mono">
              <div className="mb-6">
                 <span className="text-gray-500 block mb-1">// 1. System Instruction (Persona)</span>
                 <span className="text-purple-400">systemInstruction</span>: <span className="text-yellow-300">"{config.systemInstruction}"</span>,
              </div>

              <div className="mb-6">
                 <span className="text-gray-500 block mb-1">// 2. Generation Config (Parameters)</span>
                 <span className="text-purple-400">generationConfig</span>: {'{'}
                 <div className="pl-4 text-blue-300">
                    temperature: <span className="text-orange-300">{config.temperature}</span>,
                    <br/>
                    topK: <span className="text-orange-300">{config.topK}</span>,
                    <br/>
                    topP: <span className="text-orange-300">{config.topP}</span>
                 </div>
                 {'}'},
              </div>

              <div>
                 <span className="text-gray-500 block mb-1">// 3. Conversation History (Memory)</span>
                 <span className="text-purple-400">contents</span>: [
                 {apiPayload.contents.map((msg, i) => (
                   <div key={i} className="pl-4 my-1">
                     {'{'} <span className="text-blue-300">role</span>: <span className="text-green-300">"{msg.role}"</span>, <span className="text-blue-300">parts</span>: [{'{"text": "..."}'}] {'}'},
                   </div>
                 ))}
                 <div className="pl-4 text-gray-500 opacity-50">
                    ... (Next user message appends here)
                 </div>
                 ]
              </div>

              <div className="mt-6 border-t border-gray-700 pt-4">
                <span className="text-gray-500 block mb-2">// Full Raw JSON Payload</span>
                <pre className="text-[10px] text-gray-400 whitespace-pre-wrap break-all">
                  {JSON.stringify(apiPayload, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatView;