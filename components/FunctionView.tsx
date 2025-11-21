import React, { useState, useEffect, useRef } from 'react';
import { generateFunctionCall, sendToolResponse } from '../services/geminiService';
import { GPUSearchTool, EmailTool } from '../types';
import { Server, ChevronRight, RotateCcw, Code, Edit3, CheckCircle, AlertTriangle, XCircle, Play, MessageSquare, ArrowDown, User, Settings, Save, ArrowUpCircle, Database } from 'lucide-react';

interface ApiLogEntry {
  timestamp: string;
  turnIndex: number;
  requestPayload: any;
  responseData: any;
}

type InteractionPhase = 'IDLE' | 'PROCESSING' | 'USER_MOCK_RESPONSE' | 'USER_REPLY_NEEDED' | 'FINISHED';

const FunctionView: React.FC = () => {
  const [input, setInput] = useState('Check the price of RTX 5090. If it is over $1000, send an email to boss@company.com asking for approval.');
  const [phase, setPhase] = useState<InteractionPhase>('IDLE');
  
  // Full conversation history for the left-side chat bubbles
  const [history, setHistory] = useState<any[]>([]);
  
  // API Logs for the right-side inspector
  const [apiLogs, setApiLogs] = useState<ApiLogEntry[]>([]);
  
  // The specific tool call waiting for user simulation
  const [pendingToolCall, setPendingToolCall] = useState<any>(null);
  
  // Editor content for the mock JSON
  const [mockResultJson, setMockResultJson] = useState<string>(''); 
  
  // Input for user replies in the loop
  const [userReplyInput, setUserReplyInput] = useState('');

  // Tool Definitions Editing
  const [showToolConfig, setShowToolConfig] = useState(false);
  const [toolConfigJson, setToolConfigJson] = useState(JSON.stringify([GPUSearchTool, EmailTool], null, 2));

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [apiLogs, phase]);

  const reset = () => {
    setPhase('IDLE');
    setHistory([]);
    setApiLogs([]);
    setPendingToolCall(null);
    setMockResultJson('');
    setUserReplyInput('');
    setErrorMsg(null);
  };

  const getTools = () => {
    try {
      return JSON.parse(toolConfigJson);
    } catch (e) {
      throw new Error("Invalid Tool Definition JSON");
    }
  };

  const getMockData = (toolName: string, args: any, scenario: 'success' | 'failure' | 'error') => {
    if (toolName === 'getNvidiaGpuPrice') {
      const modelName = args.modelName || "Unknown GPU";
      if (scenario === 'success') {
        return { 
          model: modelName, 
          price: 1599, 
          currency: "USD",
          availability: "In Stock",
          source: "MockDatabase_v2"
        };
      } else if (scenario === 'failure') {
        return { 
          model: modelName, 
          availability: "Out of Stock", 
          restockDate: "2025-01-01"
        };
      } else {
        return { error: "InvalidModel", message: `GPU '${modelName}' not found.` };
      }
    } else if (toolName === 'sendEmail') {
       if (scenario === 'success') {
         return { success: true, messageId: "smtp_12345", status: "queued" };
       } else if (scenario === 'failure') {
         return { success: false, error: "Timeout", details: "SMTP server unavailable" };
       } else {
         return { success: false, error: "Validation", details: "Invalid email format" };
       }
    }
    return { info: "Generic mock response. You can edit this JSON manually." };
  };

  // Step 1: Initial User Prompt
  const handleStart = async () => {
    if (!input.trim()) return;
    
    let tools;
    try {
        tools = getTools();
    } catch (e) {
        setErrorMsg("Tool Definitions JSON is invalid. Please check the Definitions tab.");
        setPhase('FINISHED');
        return;
    }

    setPhase('PROCESSING');
    setErrorMsg(null);
    setShowToolConfig(false); // Auto switch back to view
    
    // Initial history only contains the user message
    const initialHistory = [{ role: 'user', parts: [{ text: input }] }];
    setHistory(initialHistory);

    try {
      // PREPARE LOGGING DATA
      const requestPayload = {
          model: 'gemini-2.5-flash',
          contents: initialHistory,
          tools: { functionDeclarations: tools }
      };

      // API Call: Send Prompt
      const response = await generateFunctionCall([], input, tools);
      
      // LOG SUCCESS
      setApiLogs(prev => [...prev, {
         timestamp: new Date().toLocaleTimeString(),
         turnIndex: prev.length + 1,
         requestPayload,
         responseData: response
      }]);

      processModelResponse(response, initialHistory);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "API Error");
      setPhase('FINISHED');
    }
  };

  // Step X: User Replies to Model Text
  const handleUserReply = async () => {
    if (!userReplyInput.trim()) return;
    
    let tools;
    try {
        tools = getTools();
    } catch (e) {
        setErrorMsg("Tool Definitions JSON is invalid.");
        return;
    }

    setPhase('PROCESSING');
    setErrorMsg(null);

    const userTurn = { role: 'user', parts: [{ text: userReplyInput }] };
    const nextHistory = [...history, userTurn];
    setHistory(nextHistory);
    
    try {
       // PREPARE LOGGING DATA (Reconstructing what the service sends)
       const requestPayload = {
           model: 'gemini-2.5-flash',
           contents: [...history, { role: 'user', parts: [{ text: userReplyInput }] }],
           tools: { functionDeclarations: tools }
       };

       const response = await generateFunctionCall(history, userReplyInput, tools);
       setUserReplyInput('');

       // LOG SUCCESS
       setApiLogs(prev => [...prev, {
          timestamp: new Date().toLocaleTimeString(),
          turnIndex: prev.length + 1,
          requestPayload,
          responseData: response
       }]);

       processModelResponse(response, nextHistory);
    } catch (e: any) {
       console.error(e);
       setErrorMsg(e.message || "API Error");
       setPhase('FINISHED');
    }
  };

  // Common logic to handle what the model returned (Text or Function Call)
  const processModelResponse = (response: any, currentHistory: any[]) => {
    const part = response.candidates?.[0]?.content?.parts?.[0];

    if (!part) {
      setErrorMsg("Empty response from model.");
      setPhase('FINISHED');
      return;
    }

    if (part.functionCall) {
      // Case A: Model wants to call a function
      const modelTurn = { role: 'model', parts: [part] };
      const newHistory = [...currentHistory, modelTurn];
      
      setHistory(newHistory);
      setPendingToolCall(part.functionCall);
      
      // Auto-fill editor with a success case
      const defaultJson = getMockData(part.functionCall.name, part.functionCall.args, 'success');
      setMockResultJson(JSON.stringify(defaultJson, null, 2));
      
      setPhase('USER_MOCK_RESPONSE');
    } else {
      // Case B: Model returned final text
      const modelTurn = { role: 'model', parts: [{ text: part.text || "" }] };
      setHistory([...currentHistory, modelTurn]);
      setPendingToolCall(null);
      
      // Instead of finishing, we allow the conversation to continue
      setPhase('USER_REPLY_NEEDED');
    }
  };

  // Step 2: User submits the mock data for the pending function call
  const handleSubmitMockResponse = async () => {
    if (!pendingToolCall) return;

    let parsedData;
    try {
      parsedData = JSON.parse(mockResultJson);
    } catch (e) {
      alert("Invalid JSON");
      return;
    }

    let tools;
    try {
        tools = getTools();
    } catch (e) {
        setErrorMsg("Tool Definitions JSON is invalid.");
        return;
    }

    setPhase('PROCESSING');

    // 1. Append the USER'S simulated tool response to history
    const toolResponseTurn = {
      role: 'tool',
      parts: [{
        functionResponse: {
          name: pendingToolCall.name,
          response: { result: parsedData }
        }
      }]
    };
    
    try {
      // PREPARE LOGGING DATA
      // The service constructs contents = [...history, toolTurn]
      const requestPayload = {
          model: 'gemini-2.5-flash',
          contents: [...history, toolResponseTurn],
          tools: { functionDeclarations: tools }
      };

      const response = await sendToolResponse(history, pendingToolCall.name, parsedData, tools);
      
      // LOG SUCCESS
      setApiLogs(prev => [...prev, {
         timestamp: new Date().toLocaleTimeString(),
         turnIndex: prev.length + 1,
         requestPayload,
         responseData: response
      }]);

      // Now update our local history state to include the tool response we just sent
      const historyWithToolResponse = [...history, toolResponseTurn];
      processModelResponse(response, historyWithToolResponse);

    } catch (e: any) {
      console.error(e);
      setErrorMsg("Error sending tool response: " + e.message);
      setPhase('FINISHED');
    }
  };

  const applyPreset = (scenario: 'success' | 'failure' | 'error') => {
    if (!pendingToolCall) return;
    const data = getMockData(pendingToolCall.name, pendingToolCall.args, scenario);
    setMockResultJson(JSON.stringify(data, null, 2));
  };

  return (
    <div className="flex h-full gap-6">
      {/* Left Panel: Interactive Flow */}
      <div className="w-[520px] flex flex-col gap-4 shrink-0">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg flex flex-col h-full">
          
          {/* Header */}
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-700">
             <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <Server className="text-purple-400" size={24} /> 
                {showToolConfig ? 'Tool Definitions' : 'Loop Simulator'}
             </h2>
             <div className="flex gap-3">
               <button 
                 onClick={() => setShowToolConfig(!showToolConfig)} 
                 className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition border ${
                    showToolConfig 
                    ? 'bg-blue-900 text-blue-200 border-blue-600' 
                    : 'bg-gray-700 text-gray-300 border-transparent hover:bg-gray-600'
                 }`}
               >
                 <Settings size={18} /> {showToolConfig ? 'View Loop' : 'Edit Tools'}
               </button>
               <button onClick={reset} className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-gray-700 hover:bg-gray-600 rounded-lg transition">
                 <RotateCcw size={18} /> Reset
               </button>
             </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar relative">
            
            {/* TOOL EDITOR MODE */}
            {showToolConfig ? (
               <div className="flex flex-col h-full animate-fade-in">
                  <div className="bg-blue-900/20 border border-blue-500/20 p-4 rounded-lg mb-4 text-sm text-blue-200 leading-relaxed">
                     <p>Define the tools (functions) accessible to the model. You can modify descriptions, add new parameters, or create new tools here.</p>
                  </div>
                  <div className="flex-1 flex flex-col">
                     <label className="text-sm text-gray-400 font-bold mb-2 flex items-center gap-2">
                       <Code size={16}/> functionDeclarations (JSON Array)
                     </label>
                     <textarea 
                       value={toolConfigJson}
                       onChange={(e) => setToolConfigJson(e.target.value)}
                       className="flex-1 bg-black border border-gray-700 rounded-lg p-4 font-mono text-sm text-green-300 focus:ring-2 focus:ring-blue-500 outline-none custom-scrollbar resize-none leading-relaxed"
                       spellCheck={false}
                     />
                  </div>
                  <button 
                     onClick={() => setShowToolConfig(false)}
                     className="mt-4 w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition"
                  >
                     <Save size={18} /> Save & Return to Simulator
                  </button>
               </div>
            ) : (
               /* INTERACTION MODE */
               <>
                {/* 1. User Prompt Section */}
                <div className={`transition-all duration-500 ${history.length > 0 ? 'opacity-50 pointer-events-none hidden' : 'opacity-100'}`}>
                  <div className="flex items-center gap-2 mb-3 text-blue-300 font-bold text-base uppercase tracking-wider">
                    <MessageSquare size={18} /> Step 1: Your Command
                  </div>
                  <textarea 
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-600 rounded-xl p-4 text-lg text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none h-32 leading-relaxed"
                      placeholder="Ask Gemini to do something requiring tools..."
                  />
                  <button 
                    onClick={handleStart}
                    disabled={phase === 'PROCESSING'}
                    className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition text-lg shadow-lg"
                  >
                    {phase === 'PROCESSING' ? 'Thinking...' : 'Start Interaction'} <Play size={20}/>
                  </button>
                </div>

                {/* 2. Dynamic Interaction Loop */}
                {history.length > 0 && (
                  <div className="relative space-y-6 py-2">
                    
                    {/* Visual history of what happened so far */}
                    {history.map((turn, idx) => (
                      <div key={idx} className="animate-fade-in">
                          {/* Initial User Prompt */}
                          {turn.role === 'user' && idx === 0 && (
                            <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl text-sm mb-2">
                              <div className="text-blue-300 font-bold mb-2 flex items-center gap-2 text-base">
                                <MessageSquare size={16} /> You Started
                              </div>
                              <div className="text-gray-100 text-lg leading-relaxed whitespace-pre-wrap">
                                {turn.parts[0].text}
                              </div>
                            </div>
                          )}

                          {/* Subsequent User Reply */}
                          {turn.role === 'user' && idx > 0 && (
                            <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl text-sm mb-2 text-right ml-auto max-w-[95%]">
                              <div className="text-blue-300 font-bold mb-2 flex items-center justify-end gap-2 text-base">
                                You Replied <User size={16} />
                              </div>
                              <div className="text-gray-100 text-lg leading-relaxed whitespace-pre-wrap">
                                {turn.parts[0].text}
                              </div>
                            </div>
                          )}

                          {/* Model Function Call */}
                          {turn.role === 'model' && turn.parts[0].functionCall && (
                            <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-xl text-sm mb-2">
                              <div className="text-purple-300 font-bold mb-2 flex items-center gap-2 text-base">
                                <Code size={16} /> AI Called Function
                              </div>
                              <div className="font-mono text-sm text-gray-200 bg-black/40 p-3 rounded-lg border border-purple-500/20">
                                {turn.parts[0].functionCall.name}
                                <span className="text-purple-200">
                                  ({JSON.stringify(turn.parts[0].functionCall.args)})
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {/* Tool Response (User Simulation) */}
                          {turn.role === 'tool' && (
                            <div className="bg-green-900/20 border border-green-500/30 p-4 rounded-xl text-sm mb-2 text-right ml-auto max-w-[95%]">
                              <div className="text-green-300 font-bold mb-2 flex items-center justify-end gap-2 text-base">
                                You Replied (Mock) <CheckCircle size={16} /> 
                              </div>
                              <div className="font-mono text-gray-300 text-sm truncate opacity-80">
                                {JSON.stringify(turn.parts[0].functionResponse.response.result)}
                              </div>
                            </div>
                          )}

                          {/* Model Text Response */}
                          {turn.role === 'model' && turn.parts[0].text && (
                            <div className="bg-orange-900/20 border border-orange-500/30 p-4 rounded-xl text-sm mb-2">
                              <div className="text-orange-300 font-bold mb-2 flex items-center gap-2 text-base">
                                <MessageSquare size={16} /> AI Said
                              </div>
                              <div className="text-gray-100 text-lg leading-relaxed whitespace-pre-wrap">
                                {turn.parts[0].text}
                              </div>
                            </div>
                          )}
                      </div>
                    ))}

                    {/* ACTIVE STATE: Mock Response Editor */}
                    {phase === 'USER_MOCK_RESPONSE' && pendingToolCall && (
                      <div className="animate-slide-up bg-gray-900 border border-green-500/50 p-5 rounded-xl shadow-2xl ring-1 ring-green-500/20">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-green-400 font-bold text-base flex items-center gap-2">
                              <Edit3 size={18} /> Simulate Return Value
                            </span>
                            <span className="text-xs bg-gray-800 px-3 py-1 rounded-full text-gray-300 border border-gray-700">
                              For: {pendingToolCall.name}
                            </span>
                          </div>
                          
                          <div className="flex gap-3 mb-4">
                            <button onClick={() => applyPreset('success')} className="flex-1 bg-green-900/30 hover:bg-green-900 text-green-300 text-xs font-bold py-2 rounded border border-green-800 transition uppercase tracking-wide">Success</button>
                            <button onClick={() => applyPreset('failure')} className="flex-1 bg-yellow-900/30 hover:bg-yellow-900 text-yellow-300 text-xs font-bold py-2 rounded border border-yellow-800 transition uppercase tracking-wide">Fail</button>
                            <button onClick={() => applyPreset('error')} className="flex-1 bg-red-900/30 hover:bg-red-900 text-red-300 text-xs font-bold py-2 rounded border border-red-800 transition uppercase tracking-wide">Error</button>
                          </div>

                          <textarea 
                            value={mockResultJson}
                            onChange={e => setMockResultJson(e.target.value)}
                            className="w-full h-40 bg-black border border-gray-700 rounded-lg p-3 font-mono text-sm text-green-100 focus:ring-1 focus:ring-green-500 outline-none custom-scrollbar mb-4 leading-relaxed"
                          />
                          
                          <button 
                            onClick={handleSubmitMockResponse}
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition shadow-lg"
                          >
                            Submit Response to AI <ChevronRight size={18}/>
                          </button>
                      </div>
                    )}

                    {/* ACTIVE STATE: User Reply */}
                    {phase === 'USER_REPLY_NEEDED' && (
                      <div className="animate-slide-up bg-gray-900 border border-blue-500/50 p-5 rounded-xl shadow-2xl ring-1 ring-blue-500/20 mt-4">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-blue-400 font-bold text-base flex items-center gap-2">
                              <MessageSquare size={18} /> Your Reply
                            </span>
                          </div>
                          <textarea 
                            value={userReplyInput}
                            onChange={e => setUserReplyInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleUserReply();
                              }
                            }}
                            className="w-full h-32 bg-black border border-gray-700 rounded-lg p-4 text-lg text-blue-100 focus:ring-1 focus:ring-blue-500 outline-none custom-scrollbar mb-4 resize-none leading-relaxed"
                            placeholder="Reply to the AI... (e.g. 'That is too expensive, look for something cheaper')"
                          />
                          <button 
                            onClick={handleUserReply}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition shadow-lg"
                          >
                            Send Reply <ChevronRight size={18}/>
                          </button>
                      </div>
                    )}

                    {/* FINAL STATE: Conclusion / Error */}
                    {phase === 'FINISHED' && errorMsg && (
                      <div className="animate-fade-in bg-gradient-to-br from-gray-800 to-gray-900 border border-red-700 p-6 rounded-xl">
                          <div className="text-red-400 font-bold text-lg mb-3 flex items-center gap-2">
                            <AlertTriangle size={20} /> Error
                          </div>
                          <p className="text-base text-red-300 mt-2">{errorMsg}</p>
                          <button onClick={reset} className="mt-4 text-sm text-gray-400 underline hover:text-white">
                            Restart
                          </button>
                      </div>
                    )}

                    {/* Loading Indicator */}
                    {phase === 'PROCESSING' && (
                      <div className="flex items-center gap-3 text-gray-400 p-4">
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm font-medium">AI is deciding next step...</span>
                      </div>
                    )}
                  </div>
                )}
               </>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel: Request / Response Log */}
      <div className="flex-1 flex flex-col bg-[#1e1e1e] rounded-xl border border-gray-700 shadow-2xl overflow-hidden shrink-0">
        <div className="p-4 bg-black/30 border-b border-gray-700 flex items-center gap-3">
           <Server className="text-purple-400" size={24} />
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
                          {/* Removed max-h and overflow-y-auto */}
                          <pre className="text-base font-mono text-blue-100 whitespace-pre-wrap break-all leading-relaxed custom-scrollbar">
                              {JSON.stringify(log.requestPayload, null, 2)}
                          </pre>
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
                          {/* Removed max-h and overflow-y-auto */}
                          <pre className="text-base font-mono text-orange-100 whitespace-pre-wrap break-all leading-relaxed custom-scrollbar">
                              {JSON.stringify(log.responseData, null, 2)}
                          </pre>
                      </div>
                  </div>
              </div>
            </div>
          ))}
          
          {phase === 'PROCESSING' && (
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
    </div>
  );
};

export default FunctionView;