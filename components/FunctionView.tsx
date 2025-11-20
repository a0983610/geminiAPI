import React, { useState, useEffect, useRef } from 'react';
import { generateFunctionCall, sendToolResponse } from '../services/geminiService';
import { GPUSearchTool, EmailTool } from '../types';
import { Server, ChevronRight, RotateCcw, Code, Edit3, CheckCircle, AlertTriangle, XCircle, Play, MessageSquare, ArrowDown, User, Settings, Save } from 'lucide-react';

type InteractionPhase = 'IDLE' | 'PROCESSING' | 'USER_MOCK_RESPONSE' | 'USER_REPLY_NEEDED' | 'FINISHED';

const FunctionView: React.FC = () => {
  const [input, setInput] = useState('Check the price of RTX 5090. If it is over $1000, send an email to boss@company.com asking for approval.');
  const [phase, setPhase] = useState<InteractionPhase>('IDLE');
  
  // Full conversation history including User, Model(Calls), and Tool(Responses)
  const [history, setHistory] = useState<any[]>([]);
  
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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, phase]);

  const reset = () => {
    setPhase('IDLE');
    setHistory([]);
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
      // API Call: Send Prompt
      const response = await generateFunctionCall([], input, tools);
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
       const response = await generateFunctionCall(history, userReplyInput, tools);
       setUserReplyInput('');
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
      const response = await sendToolResponse(history, pendingToolCall.name, parsedData, tools);
      
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
      <div className="w-[450px] flex flex-col gap-4">
        <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 shadow-lg flex flex-col h-full">
          
          {/* Header */}
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-700">
             <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Server className="text-purple-400" /> 
                {showToolConfig ? 'Tool Definitions' : 'Loop Simulator'}
             </h2>
             <div className="flex gap-2">
               <button 
                 onClick={() => setShowToolConfig(!showToolConfig)} 
                 className={`flex items-center gap-2 px-3 py-1 text-xs rounded transition border ${
                    showToolConfig 
                    ? 'bg-blue-900 text-blue-200 border-blue-600' 
                    : 'bg-gray-700 text-gray-300 border-transparent hover:bg-gray-600'
                 }`}
               >
                 <Settings size={14} /> {showToolConfig ? 'View Loop' : 'Edit Tools'}
               </button>
               <button onClick={reset} className="flex items-center gap-2 px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition">
                 <RotateCcw size={14} /> Reset
               </button>
             </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar relative">
            
            {/* TOOL EDITOR MODE */}
            {showToolConfig ? (
               <div className="flex flex-col h-full animate-fade-in">
                  <div className="bg-blue-900/20 border border-blue-500/20 p-3 rounded mb-3 text-xs text-blue-200">
                     <p>Define the tools (functions) accessible to the model. You can modify descriptions, add new parameters, or create new tools here.</p>
                  </div>
                  <div className="flex-1 flex flex-col">
                     <label className="text-xs text-gray-500 mb-2 flex items-center gap-2">
                       <Code size={12}/> functionDeclarations (JSON Array)
                     </label>
                     <textarea 
                       value={toolConfigJson}
                       onChange={(e) => setToolConfigJson(e.target.value)}
                       className="flex-1 bg-black border border-gray-700 rounded p-3 font-mono text-xs text-green-300 focus:ring-2 focus:ring-blue-500 outline-none custom-scrollbar resize-none"
                       spellCheck={false}
                     />
                  </div>
                  <button 
                     onClick={() => setShowToolConfig(false)}
                     className="mt-4 w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-xs font-bold flex items-center justify-center gap-2 transition"
                  >
                     <Save size={14} /> Save & Return to Simulator
                  </button>
               </div>
            ) : (
               /* INTERACTION MODE */
               <>
                {/* 1. User Prompt Section */}
                <div className={`transition-all duration-500 ${history.length > 0 ? 'opacity-50 pointer-events-none hidden' : 'opacity-100'}`}>
                  <div className="flex items-center gap-2 mb-2 text-blue-300 font-bold text-sm uppercase tracking-wider">
                    <MessageSquare size={14} /> Step 1: Your Command
                  </div>
                  <textarea 
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none h-24"
                      placeholder="Ask Gemini to do something requiring tools..."
                  />
                  <button 
                    onClick={handleStart}
                    disabled={phase === 'PROCESSING'}
                    className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold flex items-center justify-center gap-2 transition"
                  >
                    {phase === 'PROCESSING' ? 'Thinking...' : 'Start Interaction'} <Play size={16}/>
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
                            <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded text-xs mb-2">
                              <div className="text-blue-300 font-bold mb-1 flex items-center gap-2">
                                <MessageSquare size={12} /> You Started
                              </div>
                              <div className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                                {turn.parts[0].text}
                              </div>
                            </div>
                          )}

                          {/* Subsequent User Reply */}
                          {turn.role === 'user' && idx > 0 && (
                            <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded text-xs mb-2 text-right ml-auto max-w-[90%]">
                              <div className="text-blue-300 font-bold mb-1 flex items-center justify-end gap-2">
                                You Replied <User size={12} />
                              </div>
                              <div className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                                {turn.parts[0].text}
                              </div>
                            </div>
                          )}

                          {/* Model Function Call */}
                          {turn.role === 'model' && turn.parts[0].functionCall && (
                            <div className="bg-purple-900/20 border border-purple-500/30 p-3 rounded text-xs mb-2">
                              <div className="text-purple-300 font-bold mb-1 flex items-center gap-2">
                                <Code size={12} /> AI Called Function
                              </div>
                              <div className="font-mono text-gray-300 bg-black/30 p-1 rounded">
                                {turn.parts[0].functionCall.name}({JSON.stringify(turn.parts[0].functionCall.args)})
                              </div>
                            </div>
                          )}
                          
                          {/* Tool Response (User Simulation) */}
                          {turn.role === 'tool' && (
                            <div className="bg-green-900/20 border border-green-500/30 p-3 rounded text-xs mb-2 text-right ml-auto max-w-[90%]">
                              <div className="text-green-300 font-bold mb-1 flex items-center justify-end gap-2">
                                You Replied (Mock) <CheckCircle size={12} /> 
                              </div>
                              <div className="font-mono text-gray-400 opacity-70 truncate">
                                {JSON.stringify(turn.parts[0].functionResponse.response.result)}
                              </div>
                            </div>
                          )}

                          {/* Model Text Response */}
                          {turn.role === 'model' && turn.parts[0].text && (
                            <div className="bg-orange-900/20 border border-orange-500/30 p-3 rounded text-xs mb-2">
                              <div className="text-orange-300 font-bold mb-1 flex items-center gap-2">
                                <MessageSquare size={12} /> AI Said
                              </div>
                              <div className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                                {turn.parts[0].text}
                              </div>
                            </div>
                          )}
                      </div>
                    ))}

                    {/* ACTIVE STATE: Mock Response Editor */}
                    {phase === 'USER_MOCK_RESPONSE' && pendingToolCall && (
                      <div className="animate-slide-up bg-gray-900 border border-green-500/50 p-4 rounded-xl shadow-2xl ring-1 ring-green-500/20">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-green-400 font-bold text-sm flex items-center gap-2">
                              <Edit3 size={14} /> Simulate Return Value
                            </span>
                            <span className="text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-400">
                              For: {pendingToolCall.name}
                            </span>
                          </div>
                          
                          <div className="flex gap-2 mb-3">
                            <button onClick={() => applyPreset('success')} className="flex-1 bg-green-900/30 hover:bg-green-900 text-green-300 text-[10px] py-1 rounded border border-green-800 transition">Success</button>
                            <button onClick={() => applyPreset('failure')} className="flex-1 bg-yellow-900/30 hover:bg-yellow-900 text-yellow-300 text-[10px] py-1 rounded border border-yellow-800 transition">Fail</button>
                            <button onClick={() => applyPreset('error')} className="flex-1 bg-red-900/30 hover:bg-red-900 text-red-300 text-[10px] py-1 rounded border border-red-800 transition">Error</button>
                          </div>

                          <textarea 
                            value={mockResultJson}
                            onChange={e => setMockResultJson(e.target.value)}
                            className="w-full h-32 bg-black border border-gray-700 rounded p-2 font-mono text-xs text-green-100 focus:ring-1 focus:ring-green-500 outline-none custom-scrollbar mb-3"
                          />
                          
                          <button 
                            onClick={handleSubmitMockResponse}
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded text-xs font-bold flex items-center justify-center gap-2 transition"
                          >
                            Submit Response to AI <ChevronRight size={14}/>
                          </button>
                      </div>
                    )}

                    {/* ACTIVE STATE: User Reply */}
                    {phase === 'USER_REPLY_NEEDED' && (
                      <div className="animate-slide-up bg-gray-900 border border-blue-500/50 p-4 rounded-xl shadow-2xl ring-1 ring-blue-500/20 mt-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-blue-400 font-bold text-sm flex items-center gap-2">
                              <MessageSquare size={14} /> Your Reply
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
                            className="w-full h-24 bg-black border border-gray-700 rounded p-2 text-xs text-blue-100 focus:ring-1 focus:ring-blue-500 outline-none custom-scrollbar mb-3 resize-none"
                            placeholder="Reply to the AI... (e.g. 'That is too expensive, look for something cheaper')"
                          />
                          <button 
                            onClick={handleUserReply}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-xs font-bold flex items-center justify-center gap-2 transition"
                          >
                            Send Reply <ChevronRight size={14}/>
                          </button>
                      </div>
                    )}

                    {/* FINAL STATE: Conclusion / Error */}
                    {phase === 'FINISHED' && errorMsg && (
                      <div className="animate-fade-in bg-gradient-to-br from-gray-800 to-gray-900 border border-red-700 p-4 rounded-lg">
                          <div className="text-red-400 font-bold text-sm mb-2 flex items-center gap-2">
                            <AlertTriangle size={14} /> Error
                          </div>
                          <p className="text-sm text-red-300 mt-2">{errorMsg}</p>
                          <button onClick={reset} className="mt-4 text-xs text-gray-400 underline hover:text-white">
                            Restart
                          </button>
                      </div>
                    )}

                    {/* Loading Indicator */}
                    {phase === 'PROCESSING' && (
                      <div className="flex items-center gap-3 text-gray-400 p-2">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs">AI is deciding next step...</span>
                      </div>
                    )}
                  </div>
                )}
               </>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel: Live JSON Inspector */}
      <div className="flex-1 flex flex-col bg-[#1e1e1e] rounded-xl border border-gray-700 shadow-2xl overflow-hidden">
        <div className="p-3 bg-black/30 border-b border-gray-700 flex items-center gap-2">
           <Code className="text-yellow-400" size={16} />
           <span className="font-bold text-gray-200 text-sm">Context History (JSON)</span>
        </div>
        
        <div ref={scrollRef} className="flex-1 overflow-auto p-6 custom-scrollbar bg-[#0d1117] space-y-6">
          {history.length === 0 && (
            <div className="text-center mt-20 text-gray-600 text-sm">
               Context is empty. Start a conversation to see the JSON structure grow.
            </div>
          )}

          {history.map((turn, idx) => {
            let label = "UNKNOWN";
            let color = "text-gray-400";
            let bgColor = "bg-gray-900";
            let borderColor = "border-gray-700";

            if (turn.role === 'user') {
              label = "USER PROMPT";
              color = "text-blue-300";
              bgColor = "bg-blue-900/10";
              borderColor = "border-blue-500/30";
            } else if (turn.role === 'model') {
              if (turn.parts[0].functionCall) {
                label = "MODEL (TOOL REQUEST)";
                color = "text-purple-300";
                bgColor = "bg-purple-900/10";
                borderColor = "border-purple-500/30";
              } else {
                label = "MODEL (TEXT RESPONSE)";
                color = "text-orange-300";
                bgColor = "bg-orange-900/10";
                borderColor = "border-orange-500/30";
              }
            } else if (turn.role === 'tool') {
               label = "FUNCTION (MOCK RESULT)";
               color = "text-green-300";
               bgColor = "bg-green-900/10";
               borderColor = "border-green-500/30";
            }

            return (
              <div key={idx} className="animate-fade-in">
                <div className={`text-[10px] font-bold mb-1 uppercase tracking-wider flex items-center gap-2 ${color}`}>
                  <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[8px]">{idx + 1}</span>
                  {label}
                </div>
                <div className={`${bgColor} border ${borderColor} rounded p-3 relative group`}>
                  <pre className={`text-xs font-mono whitespace-pre-wrap break-all ${color}`}>
                    {JSON.stringify(turn, null, 2)}
                  </pre>
                </div>
                {idx < history.length - 1 && (
                  <div className="flex justify-center my-2">
                    <ArrowDown size={14} className="text-gray-700" />
                  </div>
                )}
              </div>
            );
          })}

          {phase === 'USER_MOCK_RESPONSE' && (
             <div className="opacity-50 animate-pulse border border-dashed border-green-500/50 p-4 rounded text-center">
                <span className="text-green-500 text-xs font-mono">Waiting for Tool Response JSON...</span>
             </div>
          )}
          {phase === 'USER_REPLY_NEEDED' && (
             <div className="opacity-50 animate-pulse border border-dashed border-blue-500/50 p-4 rounded text-center">
                <span className="text-blue-500 text-xs font-mono">Waiting for User Reply JSON...</span>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FunctionView;