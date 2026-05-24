import React, { useState, useEffect, useRef } from 'react';
import { Bot, User, Send, History, X, Trash2, Plus, Play, Copy, Check, Sparkles, Database, Terminal, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: Message[];
}

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const stored = localStorage.getItem('novamind_sessions');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.length > 0) return parsed;
      } catch (e) {
        console.error("Error loading chat history:", e);
      }
    }
    return [{
      id: 'default',
      title: 'NovaMind Personal Session',
      createdAt: new Date().toLocaleDateString(),
      messages: [
        { 
          role: 'assistant', 
          content: 'Hello! I am NovaMind, your ultra-polished, neural-connected Personal AI companion. 😊\n\nI can assist you with almost anything—whether you want to brainstorm high-level concepts, write and review elegant code, learn a new topic, model a custom task list, or simply have a friendly discussion.\n\nType a message to get started, or try asking me: **"who made you?"**' 
        }
      ]
    }];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const storedActive = localStorage.getItem('novamind_active_session_id');
    return storedActive || 'default';
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('novamind_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('novamind_active_session_id', activeSessionId);
  }, [activeSessionId]);

  // Scroll to bottom on message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeSessionId, isLoading]);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  const updateActiveSessionMessages = (newMessages: Message[]) => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSession.id) {
        // Intelligently generate a nice short title based on first user message if needed
        let updatedTitle = s.title;
        if (s.title === 'NovaMind Personal Session' || s.title === 'New Discussion') {
          const firstUser = newMessages.find(m => m.role === 'user');
          if (firstUser) {
            updatedTitle = firstUser.content.length > 25 
              ? firstUser.content.substring(0, 25) + '...' 
              : firstUser.content;
          }
        }
        return { ...s, title: updatedTitle, messages: newMessages };
      }
      return s;
    }));
  };

  const handleNewChat = () => {
    const newId = 'chat_' + Date.now();
    const newChat: ChatSession = {
      id: newId,
      title: 'New Discussion',
      createdAt: new Date().toLocaleDateString(),
      messages: [
        { 
          role: 'assistant', 
          content: 'Hello! This is a new NovaMind workspace session. Ask me questions, request custom calculations, brainstorming, code refactoring, or simply have a friendly talk.' 
        }
      ]
    };
    setSessions(prev => [...prev, newChat]);
    setActiveSessionId(newId);
  };

  const handleDeleteChat = (e: React.MouseEvent, idToDelete: string) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      // Just reset the single session
      setSessions([{
        id: 'default',
        title: 'NovaMind Personal Session',
        createdAt: new Date().toLocaleDateString(),
        messages: [
          { role: 'assistant', content: 'Initialize NovaMind Core... Connection established. How can I assist you with your creative workspace thoughts or developer tasks today?' }
        ]
      }]);
      setActiveSessionId('default');
      return;
    }

    const filtered = sessions.filter(s => s.id !== idToDelete);
    setSessions(filtered);
    if (activeSessionId === idToDelete) {
      setActiveSessionId(filtered[0].id);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userText = input;
    setInput('');

    const userMsg: Message = { role: 'user', content: userText };
    const updatedMessages = [...activeSession.messages, userMsg];
    updateActiveSessionMessages(updatedMessages);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages })
      });
      
      if (response.ok) {
        const data = await response.json();
        const botMsg: Message = { role: 'assistant', content: data.content };
        updateActiveSessionMessages([...updatedMessages, botMsg]);
      } else {
        throw new Error("API server responded with error: " + response.status);
      }
    } catch (error) {
      console.warn("NovaMind API offline, triggering local preview generator:", error);
      
      // Simulate highly optimized AI local reply
      setTimeout(() => {
        const inputLower = userText.toLowerCase();
        
        let localReply = "";
        if (inputLower.includes("who made you") || inputLower.includes("who created you") || inputLower.includes("developer") || inputLower.includes("creator")) {
          localReply = "I was created by a 13yrs old boy Sowjith Anumola";
        } else if (inputLower.includes("hello") || inputLower.includes("hi") || inputLower.includes("hey")) {
          localReply = "Hello! I am NovaMind, your neural personal assistant. How can I assist you with your day or developer tasks today?";
        } else if (inputLower.includes("help") || inputLower.includes("features")) {
          localReply = "I am a versatile personal companion AI! I can write HTML/JS/CSS code, explain complex scientific principles, write creative letters, analyze logic, or simply chat. What can I do for you?";
        } else {
          localReply = `That sounds awesome! I am operating in offline local preview simulator mode without a configured Gemini key. I am fully ready to act as your Personal AI!

Try asking me: **"who made you?"** or feel free to request creative writing or logical tasks!`;
        }
        
        const botMsg: Message = { role: 'assistant', content: localReply };
        updateActiveSessionMessages([...updatedMessages, botMsg]);
      }, 700);

    } finally {
      setIsLoading(false);
    }
  };

  // Parses response text for triple backtick code blocks to isolate sql and text nicely
  const parseMessageSections = (contentString: string) => {
    const sections: { type: 'text' | 'sql' | 'generic'; content: string }[] = [];
    const regex = /```(sql|postgresql|postgres|mysql|sqlite)?([\s\S]*?)```/g;
    let lastIdx = 0;
    let match;

    while ((match = regex.exec(contentString)) !== null) {
      if (match.index > lastIdx) {
        sections.push({
          type: 'text',
          content: contentString.substring(lastIdx, match.index)
        });
      }

      const blockLang = match[1] ? match[1].toLowerCase() : 'generic';
      const isSql = ['sql', 'postgresql', 'postgres', 'mysql', 'sqlite'].includes(blockLang);
      
      sections.push({
        type: isSql ? 'sql' : 'generic',
        content: match[2].trim()
      });

      lastIdx = regex.lastIndex;
    }

    if (lastIdx < contentString.length) {
      sections.push({
        type: 'text',
        content: contentString.substring(lastIdx)
      });
    }

    return sections;
  };

  return (
    <div className="h-screen w-full bg-slate-50 flex overflow-hidden font-sans">
      {/* Primary Workspace */}
      <div className="flex-grow flex flex-col h-full bg-white relative overflow-hidden">
        {/* Workspace Toolbar */}
        <header className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white/70 backdrop-blur-md z-20">
          <div className="flex items-center space-x-3">
            {/* Elegant Branding with Genuine Logo link */}
            <div className="flex items-center h-8">
              <img 
                src="https://realistic-jade-vxkky795xz.edgeone.app/Screenshot%202026-05-24%20131215.png" 
                alt="NovaMind" 
                className="h-7 md:h-8 object-contain"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-100 rounded-full px-3 py-1 font-mono text-[10px] text-slate-500">
            <Sparkles className="w-3 h-3 text-brand-purple fill-current" />
            <span>AI CORE STATUS: READY</span>
          </div>
        </header>

        {/* Space of Conversations */}
        <main className="flex-grow overflow-y-auto p-4 md:p-8 space-y-6 bg-slate-50/20">
          {activeSession.messages.map((m, i) => {
            const isUser = m.role === 'user';
            const sections = parseMessageSections(m.content);

            return (
              <div 
                key={i} 
                className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start space-x-3.5 max-w-[90%] md:max-w-[75%] ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                    isUser ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-100'
                  }`}>
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-cyan-400" />}
                  </div>

                  {/* Message Bubble */}
                  <div className="flex flex-col space-y-1 w-full">
                    <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider ml-1">
                      {isUser ? 'User Workspace' : 'NovaMind Agent'}
                    </span>
                    <div className={`px-5 py-4 rounded-2xl shadow-sm border ${
                      isUser 
                        ? 'bg-gradient-to-r from-slate-900 to-slate-850 text-white border-slate-900' 
                        : 'bg-white text-slate-800 border-slate-100'
                    }`}>
                      {sections.map((sec, secIdx) => {
                        if (sec.type === 'sql') {
                          return <InteractiveSqlEditor key={secIdx} initialSql={sec.content} />;
                        } else if (sec.type === 'generic') {
                          return (
                            <div key={secIdx} className="mt-3 bg-slate-950 text-xs text-slate-200 p-4 rounded-xl font-mono leading-relaxed overflow-x-auto">
                              <code>{sec.content}</code>
                            </div>
                          );
                        } else {
                          // Support bullet points and formatting
                          return (
                            <div key={secIdx} className="whitespace-pre-wrap leading-relaxed space-y-1.5 text-sm">
                              {sec.content.split('\n').map((line, lineIdx) => {
                                if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                                  return (
                                    <li key={lineIdx} className="ml-4 list-disc text-slate-700 dark:text-gray-300">
                                      {decodeBold(line.trim().substring(2))}
                                    </li>
                                  );
                                }
                                if (line.trim().match(/^\d+\.\s/)) {
                                  const matches = line.trim().match(/^(\d+)\.\s(.*)/);
                                  return (
                                    <div key={lineIdx} className="ml-4 flex items-start space-x-1.5 text-slate-700 dark:text-gray-300">
                                      <span className="font-bold text-slate-500 font-mono">{matches?.[1]}.</span>
                                      <span>{decodeBold(matches?.[2] || '')}</span>
                                    </div>
                                  );
                                }
                                return <p key={lineIdx} className="py-0.5">{decodeBold(line)}</p>;
                              })}
                            </div>
                          );
                        }
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Loading States */}
          {isLoading && (
            <div className="flex w-full justify-start">
              <div className="flex items-start space-x-3.5 max-w-[75%]">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-slate-100 flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                  <Bot className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="flex flex-col space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider ml-1">NovaMind Agent</span>
                  <div className="px-5 py-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-brand-blue animate-bounce"></span>
                    <span className="w-2 h-2 rounded-full bg-brand-purple animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]"></span>
                    <span className="text-xs text-slate-400 font-mono pl-1">Thinking...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </main>

        {/* Input Dock */}
        <footer className="p-4 md:p-6 border-t border-slate-100 bg-white/70 backdrop-blur-md z-10">
          <div className="max-w-4xl mx-auto relative flex items-center">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask NovaMind anything... (e.g., write a poem, solve an equation, review code, or ask 'who made you?')"
              className="w-full p-4 md:p-5 pr-14 text-sm rounded-2xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent transition shadow-inner placeholder:text-slate-400 text-slate-950"
              disabled={isLoading}
            />
            <button 
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="absolute right-2.5 p-3.5 bg-slate-900 text-white hover:bg-brand-blue rounded-xl transition shadow-md cursor-pointer disabled:opacity-40 disabled:hover:bg-slate-900"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="max-w-4xl mx-auto mt-2 text-center text-[10px] text-slate-400 font-mono flex items-center justify-center space-x-1.5">
            <Sparkles className="w-3 h-3 text-brand-purple" />
            <span>NovaMind answers personal questions, produces clean explanations, and formats beautiful interactive responses.</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

// Simple bold Markdown text parser utility helper
function decodeBold(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-slate-900 dark:text-white">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function InteractiveSqlEditor({ initialSql }: { initialSql: string; key?: any }) {
  const [sqlCode, setSqlCode] = useState(initialSql);
  const [copied, setCopied] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<{ columns: string[]; rows: any[] } | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunSim = () => {
    setIsSimulating(true);
    setTimeout(() => {
      const lowerCode = sqlCode.toLowerCase();
      let columns: string[] = [];
      let rows: any[] = [];

      if (lowerCode.includes('user') || lowerCode.includes('account')) {
        columns = ['id', 'username', 'email', 'status', 'created_at'];
        rows = [
          { id: 'usr_8f2a1b', username: 'sowjith_a', email: 'sanjithsowjith.anumola@gmail.com', status: 'Active', created_at: '2026-05-24' },
          { id: 'usr_9e3c4d', username: 'alex_nova', email: 'alex@novamind.ai', status: 'Active', created_at: '2026-05-23' },
          { id: 'usr_7b4d1e', username: 'admin_sys', email: 'admin@novamind.ai', status: 'Active', created_at: '2026-05-20' },
        ];
      } else if (lowerCode.includes('task') || lowerCode.includes('todo') || lowerCode.includes('project')) {
        columns = ['task_id', 'title', 'assignee', 'priority', 'is_completed'];
        rows = [
          { task_id: '1', title: 'Initialize NovaMind Core', assignee: 'Sowjith', priority: 'High', is_completed: 'TRUE' },
          { task_id: '2', title: 'Connect Neon Database Serverless', assignee: 'Sowjith', priority: 'Medium', is_completed: 'TRUE' },
          { task_id: '3', title: 'Optimize SQL Index query responses', assignee: 'NovaMind AI', priority: 'High', is_completed: 'FALSE' },
        ];
      } else if (lowerCode.includes('payment') || lowerCode.includes('order') || lowerCode.includes('invoice')) {
        columns = ['order_id', 'customer', 'amount', 'currency', 'status'];
        rows = [
          { order_id: 'ord_24810', customer: 'Sowjith Anumola', amount: '150.00', currency: 'USD', status: 'Completed' },
          { order_id: 'ord_24811', customer: 'Vera Tech', amount: '1250.00', currency: 'USD', status: 'Pending' },
        ];
      } else {
        columns = ['id', 'entity_name', 'metric_value', 'updated_at'];
        rows = [
          { id: '101', entity_name: 'Core System Health', metric_value: '99.8%', updated_at: '2026-05-24' },
          { id: '102', entity_name: 'Database Conn Pool', metric_value: 'Active', updated_at: '2026-05-24' },
        ];
      }
      setSimResult({ columns, rows });
      setIsSimulating(false);
    }, 800);
  };

  return (
    <div className="mt-4 border border-slate-800 rounded-xl bg-slate-950 overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-400 font-mono">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
          <span className="font-semibold text-slate-300">NovaMind SQL Editor (Interactive Sandbox)</span>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            type="button"
            onClick={handleCopy}
            className="flex items-center space-x-1 hover:text-white transition cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400"/> : <Copy className="w-3.5 h-3.5"/>}
            <span>{copied ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>
      </div>

      <div className="relative font-mono text-xs text-slate-300 leading-relaxed">
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-slate-900/50 border-r border-slate-800 flex flex-col items-center justify-start pt-3 text-slate-600 select-none">
          {sqlCode.split('\n').map((_, idx) => (
            <div key={idx} className="h-5">{idx + 1}</div>
          ))}
        </div>
        <textarea
          value={sqlCode}
          onChange={(e) => setSqlCode(e.target.value)}
          rows={Math.max(4, sqlCode.split('\n').length)}
          className="w-full bg-transparent text-slate-100 pl-11 pr-4 py-3 focus:outline-none resize-none font-mono text-xs whitespace-pre leading-5"
          spellCheck={false}
        />
      </div>

      <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
        <button
          type="button"
          onClick={handleRunSim}
          disabled={isSimulating}
          className="flex items-center space-x-2 px-4 py-2 bg-brand-blue hover:bg-brand-purple text-white rounded-lg text-xs font-semibold transition shadow-md cursor-pointer disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5 fill-current"/>
          <span>{isSimulating ? 'Executing Query...' : 'Run query sandbox'}</span>
        </button>
        <span className="text-[10px] text-slate-500 font-mono">PostgreSQL Mock Engine</span>
      </div>

      {simResult && (
        <div className="border-t border-slate-800 bg-slate-950 p-4 overflow-x-auto">
          <h4 className="text-xs font-bold text-slate-300 font-mono mb-2 flex items-center">
            <Database className="w-3.5 h-3.5 text-brand-blue mr-1.5 shrink-0" />
            Result Set Output:
          </h4>
          <table className="w-full text-left border-collapse text-xs font-mono text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500">
                {simResult.columns.map((col) => (
                  <th key={col} className="pb-1.5 pr-4 font-semibold uppercase tracking-wider text-[10px]">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {simResult.rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-slate-900 hover:bg-slate-900/50">
                  {simResult.columns.map((col) => (
                    <td key={col} className="py-2 pr-4 font-normal text-slate-300">{row[col]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-[10px] text-green-500 flex justify-end font-mono">
            {simResult.rows.length} rows returned successfully in 4.2ms.
          </div>
        </div>
      )}
    </div>
  );
}
