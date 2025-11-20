import React, { useState } from 'react';
import { generateEmbedding } from '../services/geminiService';
import { BarChart3, ArrowDown, FileJson, Hash, Microscope } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const EmbeddingView: React.FC = () => {
  const [input, setInput] = useState('Nvidia Graphics Card');
  const [vector, setVector] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string>('');

  const handleGenerate = async () => {
    if (!input.trim()) return;
    // Don't clear vector immediately to allow comparison visual if needed, 
    // but we will clear it to show "reload" effect
    setVector([]); 
    setLoading(true);
    
    try {
      const vec = await generateEmbedding(input);
      setVector(vec || []);
      setLastGenerated(new Date().toLocaleTimeString());
    } catch (e) {
      console.error(e);
      alert("Failed to generate embedding");
    } finally {
      setLoading(false);
    }
  };

  // Format data for Recharts
  const chartData = vector.slice(0, 64).map((val, idx) => ({
    index: idx,
    value: val,
  }));

  return (
    <div className="flex h-full gap-6">
       {/* Left Panel: Visuals */}
       <div className="flex-1 flex flex-col gap-6">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <BarChart3 className="text-orange-400" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Text to Vector</h2>
                <p className="text-sm text-gray-400">
                  Convert text into numbers. Try "Apple" vs "Apple Pie" to see subtle differences.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Text Input</label>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  placeholder="Enter any text..."
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-bold transition disabled:opacity-50 h-[46px] min-w-[100px]"
              >
                {loading ? '...' : 'Convert'}
              </button>
            </div>
          </div>

          <div className="flex-1 bg-gray-900 rounded-xl border border-gray-700 p-6 flex flex-col relative overflow-hidden">
            {vector.length > 0 ? (
              <>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-gray-200">Visual Representation (First 64 Dims)</h3>
                    <p className="text-[10px] text-gray-500">Total Dimensions: 768</p>
                  </div>
                  <div className="text-right">
                     <span className="text-[10px] text-gray-500 block">Last Update</span>
                     <span className="text-xs font-mono text-orange-300">{lastGenerated}</span>
                  </div>
                </div>
                
                <div className="flex-1 w-full min-h-[150px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barGap={0} barCategoryGap={1}>
                      <XAxis dataKey="index" hide />
                      <YAxis hide domain={[-0.1, 0.1]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6' }}
                        itemStyle={{ color: '#fbbf24' }}
                        cursor={{fill: 'rgba(255,255,255,0.05)'}}
                      />
                      <Bar dataKey="value" animationDuration={500}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.value > 0 ? '#34d399' : '#f87171'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-600 opacity-50">
                {loading ? (
                   <div className="animate-pulse text-orange-400">Generating High-Dimensional Vectors...</div>
                ) : (
                   <>
                    <BarChart3 size={64} className="mb-4" />
                    <p>Waiting for input...</p>
                   </>
                )}
              </div>
            )}
          </div>
       </div>

       {/* Right Panel: Raw Data Inspection */}
       <div className="w-[400px] bg-[#1e1e1e] rounded-xl border border-gray-700 shadow-xl flex flex-col overflow-hidden">
          <div className="p-3 bg-black/30 border-b border-gray-700 flex items-center gap-2">
             <Microscope className="text-orange-400" size={16} />
             <span className="text-sm font-bold text-gray-200">Raw Value Inspector</span>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-6">
             {/* 1. Raw Values Table */}
             <div>
               <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">First 5 Dimensions (Proof of Change)</h4>
               {vector.length > 0 ? (
                 <div className="bg-black rounded border border-gray-800 overflow-hidden">
                    <table className="w-full text-[10px] font-mono">
                      <thead>
                         <tr className="bg-gray-900 text-gray-400 border-b border-gray-800">
                           <th className="p-2 text-left">Index</th>
                           <th className="p-2 text-right">Float Value</th>
                         </tr>
                      </thead>
                      <tbody>
                        {vector.slice(0, 5).map((v, i) => (
                          <tr key={i} className="border-b border-gray-800/50 last:border-0">
                             <td className="p-2 text-gray-500">Dim[{i}]</td>
                             <td className="p-2 text-right text-orange-200">{v.toFixed(8)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
               ) : (
                 <div className="p-4 text-center text-gray-600 text-xs">No data yet</div>
               )}
             </div>

             <div className="flex justify-center">
                <ArrowDown className="text-gray-600" />
             </div>

             <div>
               <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Full JSON Response</h4>
               {vector.length > 0 ? (
                 <div className="bg-black rounded border border-gray-800 p-3 animate-fade-in">
                   <pre className="text-[11px] font-mono text-green-300 whitespace-pre-wrap break-all h-64 overflow-y-auto custom-scrollbar">
{`{
  "embedding": {
    "values": [
      ${vector[0]},
      ${vector[1]},
      ${vector[2]},
      ${vector[3]},
      ${vector[4]},
      ... (${vector.length - 5} more items)
    ]
  }
}`}
                   </pre>
                 </div>
               ) : (
                 <div className="text-center py-8 text-gray-600 text-xs italic">
                   Waiting for generation...
                 </div>
               )}
             </div>
          </div>
       </div>
    </div>
  );
};

export default EmbeddingView;