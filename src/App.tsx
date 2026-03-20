import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Table as TableIcon, 
  Zap, 
  ArrowRight, 
  Loader2,
  BrainCircuit,
  History,
  Trash2,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  Upload,
  Send,
  User,
  Bot,
  Download,
  FileDown,
  Briefcase,
  Camera,
  Utensils,
  Compass
} from 'lucide-react';
import Markdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import { startAnalysis, sendChatMessage, AnalysisResponse, Attachment, Message } from './services/geminiService';
import { cn } from './lib/utils';

interface SavedSession {
  id: string;
  title: string;
  summary: string;
  timestamp: number;
  input: string;
  messages: Message[];
  attachmentName?: string;
}

export default function App() {
  const [decision, setDecision] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionInfo, setSessionInfo] = useState<{ title: string; summary: string } | null>(null);
  const [history, setHistory] = useState<SavedSession[]>([]);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [chatInput, setChatInput] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      const data = base64.split(',')[1];
      setAttachment({
        data,
        mimeType: file.type,
        name: file.name
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleStartAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const analysis = await startAnalysis(decision, attachment || undefined);
      
      const initialMessages: Message[] = [
        { role: 'user', text: decision, attachment: attachment || undefined },
        { role: 'model', text: analysis.content }
      ];
      
      setMessages(initialMessages);
      setSessionInfo({ title: analysis.title, summary: analysis.summary });
      
      const newSaved: SavedSession = {
        id: crypto.randomUUID(),
        title: analysis.title,
        summary: analysis.summary,
        timestamp: Date.now(),
        input: decision,
        messages: initialMessages,
        attachmentName: attachment?.name
      };
      setHistory(prev => [newSaved, ...prev].slice(0, 10));
      setAttachment(null);
      setDecision('');
    } catch (err: any) {
      console.error('Analysis failed:', err);
      setError(err.message || 'Something went wrong. Please check your API key and connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || loading) return;

    const userMsg: Message = { role: 'user', text: chatInput, attachment: attachment || undefined };
    const updatedMessages = [...messages, userMsg];
    
    setMessages(updatedMessages);
    setChatInput('');
    setAttachment(null);
    setLoading(true);
    setError(null);

    try {
      const response = await sendChatMessage(updatedMessages, chatInput, attachment || undefined);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (err: any) {
      console.error('Chat failed:', err);
      setError(err.message || 'Something went wrong. Please check your API key and connection.');
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => setHistory([]);

  const getButtonText = () => {
    const input = decision.toLowerCase();
    const hasImage = attachment?.mimeType.startsWith('image/');
    const hasDoc = attachment?.mimeType.includes('pdf') || attachment?.mimeType.includes('word') || attachment?.mimeType.includes('text');

    if (hasDoc || input.includes('cv') || input.includes('resume') || input.includes('career') || input.includes('job')) {
      return "Check my path";
    }
    
    if (hasImage) {
      if (input.includes('fridge') || input.includes('cook') || input.includes('food') || input.includes('eat') || input.includes('recipe')) {
        return "What's cooking?";
      }
      if (input.includes('hair') || input.includes('face') || input.includes('selfie') || input.includes('look') || input.includes('style') || input.includes('wear')) {
        return "Style me";
      }
    }

    // Fallback based on text only if no attachment or attachment didn't match specific image/doc logic
    if (input.includes('fridge') || input.includes('cook') || input.includes('food') || input.includes('eat') || input.includes('recipe')) {
      return "What's cooking?";
    }
    if (input.includes('hair') || input.includes('face') || input.includes('selfie') || input.includes('look') || input.includes('style') || input.includes('wear')) {
      return "Style me";
    }

    return "Go";
  };

  const downloadAsMarkdown = () => {
    if (!sessionInfo || messages.length === 0) return;
    
    const content = messages.map(msg => {
      const role = msg.role === 'user' ? 'User' : 'Versa';
      return `### ${role}\n\n${msg.text}\n\n---\n\n`;
    }).join('\n');
    
    const fullText = `# ${sessionInfo.title}\n\n${sessionInfo.summary}\n\n${content}`;
    const blob = new Blob([fullText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sessionInfo.title.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAsPDF = () => {
    if (!sessionInfo || messages.length === 0) return;
    
    const doc = new jsPDF();
    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxLineWidth = pageWidth - margin * 2;
    let y = 20;

    doc.setFontSize(18);
    doc.text(sessionInfo.title, margin, y);
    y += 10;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'italic');
    const summaryLines = doc.splitTextToSize(sessionInfo.summary, maxLineWidth);
    doc.text(summaryLines, margin, y);
    y += summaryLines.length * 7 + 5;

    messages.forEach((msg) => {
      const role = msg.role === 'user' ? 'User' : 'Versa';
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${role}:`, margin, y);
      y += 5;
      
      doc.setFont('helvetica', 'normal');
      const textLines = doc.splitTextToSize(msg.text, maxLineWidth);
      
      if (y + textLines.length * 5 > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = 20;
      }
      
      doc.text(textLines, margin, y);
      y += textLines.length * 5 + 10;
      
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = 20;
      }
    });

    doc.save(`${sessionInfo.title.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#F7F8FC] text-zinc-900 font-sans selection:bg-emerald-100 flex flex-col">
      {/* Header */}
      <header className="bg-[#F7F8FC] sticky top-0 z-20 py-4">
        <div className="max-w-6xl mx-auto px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F7F8FC] rounded-xl flex items-center justify-center shadow-[var(--shadow-neumorphic-sm)]">
              <Sparkles className="text-emerald-600 w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-800">Versa</h1>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-zinc-400">
            <span className="hidden sm:inline">Human Driven. Versa Guided</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-12 flex-1 w-full overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
          
          {/* Left Column: Input & History (Scrollable) */}
          <div className="lg:col-span-4 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
            {/* Tips Section */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { 
                  icon: <Briefcase className="w-4 h-4 text-emerald-600" />, 
                  title: "Career Moves", 
                  sub: "Drop your CV for a fresh look." 
                },
                { 
                  icon: <Camera className="w-4 h-4 text-emerald-600" />, 
                  title: "Style Swap", 
                  sub: "Let's pick an outfit or hair style." 
                },
                { 
                  icon: <Utensils className="w-4 h-4 text-emerald-600" />, 
                  title: "Fridge Raid", 
                  sub: "Tell me what's in there, I'll find a meal." 
                },
                { 
                  icon: <Compass className="w-4 h-4 text-emerald-600" />, 
                  title: "Decision Lab", 
                  sub: "Flip a coin or chat it through." 
                }
              ].map((tip, i) => (
                <div key={i} className="bg-[#F7F8FC] p-4 rounded-2xl shadow-[var(--shadow-neumorphic-sm)] flex flex-col gap-2 items-start group hover:shadow-[var(--shadow-neumorphic)] transition-all cursor-default border border-white/40">
                  <div className="p-2 bg-emerald-50 rounded-xl group-hover:scale-110 transition-transform mb-1">
                    {tip.icon}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest leading-tight">{tip.title}</p>
                    <p className="text-[9px] text-zinc-400 leading-tight font-medium">{tip.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <section className="bg-[#F7F8FC] p-8 rounded-[2rem] shadow-[var(--shadow-neumorphic)]">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-6">New Collab</h2>
              <form onSubmit={handleStartAnalysis} className="space-y-6">
                <div 
                  className={cn(
                    "relative group transition-all duration-300",
                    isDragging && "scale-[1.02]"
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <textarea
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                    placeholder="Let’s figure this out together"
                    className={cn(
                      "w-full min-h-[160px] p-6 bg-[#F7F8FC] border-none rounded-2xl shadow-[var(--shadow-neumorphic-inset)] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all resize-none text-sm leading-relaxed",
                      isDragging ? "bg-emerald-50/30" : ""
                    )}
                  />
                  {isDragging && (
                    <div className="absolute inset-0 flex items-center justify-center bg-emerald-50/40 rounded-2xl pointer-events-none border-2 border-dashed border-emerald-300">
                      <Upload className="w-8 h-8 text-emerald-600 animate-bounce" />
                    </div>
                  )}
                </div>

                {/* File Upload Section */}
                <div className="space-y-3">
                  <AnimatePresence mode="wait">
                    {attachment ? (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-center justify-between p-3 bg-[#F7F8FC] shadow-[var(--shadow-neumorphic-sm)] rounded-xl"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                            {attachment.mimeType.startsWith('image/') ? (
                              <ImageIcon className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <FileText className="w-4 h-4 text-emerald-600" />
                            )}
                          </div>
                          <p className="text-xs font-semibold text-zinc-700 truncate">{attachment.name}</p>
                        </div>
                        <button type="button" onClick={() => setAttachment(null)} className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors text-zinc-400">
                          <X className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full p-4 bg-[#F7F8FC] shadow-[var(--shadow-neumorphic-sm)] rounded-xl hover:shadow-[var(--shadow-neumorphic)] transition-all text-zinc-400 hover:text-emerald-600 flex items-center justify-center gap-3 group"
                      >
                        <Paperclip className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Give Context</span>
                      </button>
                    )}
                  </AnimatePresence>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,.pdf,.doc,.docx,.txt" />
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-xs font-medium"
                  >
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    <p>{error}</p>
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading || !decision.trim()}
                  className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-200 disabled:opacity-50 transition-all"
                >
                  {loading && messages.length === 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{getButtonText()} <ArrowRight className="w-3 h-3" /></>}
                </button>
              </form>
            </section>

            {/* History */}
            {history.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                    <History className="w-3 h-3" /> Recent Sessions
                  </h2>
                  <button onClick={clearHistory} className="text-[10px] text-zinc-400 hover:text-red-500 uppercase font-bold tracking-widest">Clear</button>
                </div>
                <div className="space-y-2">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setMessages(item.messages);
                        setSessionInfo({ title: item.title, summary: item.summary });
                        setDecision(item.input);
                      }}
                      className="w-full text-left p-4 bg-[#F7F8FC] shadow-[var(--shadow-neumorphic-sm)] rounded-2xl hover:shadow-[var(--shadow-neumorphic)] transition-all group"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold text-zinc-700 truncate group-hover:text-emerald-600 transition-colors">{item.title}</p>
                        {item.attachmentName && <Paperclip className="w-3 h-3 text-zinc-300" />}
                      </div>
                      <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mt-2">
                        {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right Column: Chat Interface */}
          <div className="lg:col-span-8 flex flex-col bg-[#F7F8FC] rounded-[2.5rem] shadow-[var(--shadow-neumorphic)] overflow-hidden h-[calc(100vh-14rem)]">
            {sessionInfo ? (
              <>
                {/* Chat Header */}
                <div className="p-8 border-b border-zinc-100/50 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h2 className="text-2xl font-bold tracking-tight text-zinc-800">{sessionInfo.title}</h2>
                      <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide">{sessionInfo.summary}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center bg-[#F7F8FC] rounded-xl shadow-[var(--shadow-neumorphic-sm)] p-1.5">
                        <button 
                          onClick={downloadAsMarkdown}
                          title="Download as Markdown"
                          className="p-2 hover:bg-white rounded-lg text-zinc-400 hover:text-emerald-600 transition-all"
                        >
                          <FileDown className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={downloadAsPDF}
                          title="Download as PDF"
                          className="p-2 hover:bg-white rounded-lg text-zinc-400 hover:text-emerald-600 transition-all"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                      </div>
                      <button 
                        onClick={() => {
                          setMessages([]);
                          setSessionInfo(null);
                          setDecision('');
                        }}
                        className="p-3 bg-[#F7F8FC] shadow-[var(--shadow-neumorphic-sm)] rounded-xl text-zinc-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={cn("flex gap-6", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                      <div className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-[var(--shadow-neumorphic-sm)]",
                        msg.role === 'user' ? "bg-zinc-800 text-white" : "bg-[#F7F8FC] text-emerald-600"
                      )}>
                        {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                      </div>
                      <div className={cn(
                        "max-w-[80%] space-y-3",
                        msg.role === 'user' ? "text-right" : "text-left"
                      )}>
                        {msg.attachment && (
                          <div className={cn("inline-block p-3 rounded-xl bg-[#F7F8FC] shadow-[var(--shadow-neumorphic-sm)] mb-2", msg.role === 'user' ? "text-right" : "text-left")}>
                            <div className="flex items-center gap-2">
                              <Paperclip className="w-3 h-3 text-emerald-600" />
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{msg.attachment.name}</span>
                            </div>
                          </div>
                        )}
                        <div className={cn(
                          "p-6 rounded-[2rem] text-sm leading-relaxed shadow-[var(--shadow-neumorphic-sm)]",
                          msg.role === 'user' 
                            ? "bg-zinc-800 text-zinc-100 rounded-tr-none" 
                            : "bg-[#F7F8FC] text-zinc-700 rounded-tl-none prose prose-zinc prose-sm max-w-none prose-headings:text-zinc-900 prose-strong:text-zinc-900 prose-table:border prose-table:rounded-xl"
                        )}>
                          {msg.role === 'model' ? (
                            <Markdown>{msg.text}</Markdown>
                          ) : (
                            <p>{msg.text}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {loading && messages.length > 0 && (
                    <div className="flex gap-6">
                      <div className="w-10 h-10 rounded-2xl bg-[#F7F8FC] shadow-[var(--shadow-neumorphic-sm)] text-emerald-600 flex items-center justify-center animate-pulse">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div className="bg-[#F7F8FC] shadow-[var(--shadow-neumorphic-sm)] p-6 rounded-[2rem] flex items-center gap-3">
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.2em]">Thinking</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Input */}
                <div className="p-6 bg-[#F7F8FC] border-t border-zinc-100/50">
                  <form onSubmit={handleSendMessage} className="relative flex items-end gap-4">
                    <div className="flex-1 relative">
                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage(e);
                          }
                        }}
                        placeholder="Ask a follow-up question..."
                        className="w-full p-5 pr-14 bg-[#F7F8FC] shadow-[var(--shadow-neumorphic-inset)] rounded-2xl outline-none transition-all resize-none text-sm leading-relaxed max-h-32"
                        rows={1}
                      />
                      <div className="absolute right-4 bottom-4 flex items-center gap-2">
                        <button 
                          type="button" 
                          onClick={() => fileInputRef.current?.click()}
                          className={cn("p-2 rounded-xl transition-all", attachment ? "text-emerald-600 bg-emerald-50 shadow-inner" : "text-zinc-400 hover:text-emerald-600")}
                        >
                          <Paperclip className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading || !chatInput.trim()}
                      className="p-5 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-200"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                  {attachment && (
                    <div className="mt-4 flex items-center gap-3 px-4">
                      <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Context Attached:</span>
                      <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 shadow-sm">
                        <span className="text-[10px] font-bold text-emerald-700 truncate max-w-[150px]">{attachment.name}</span>
                        <button onClick={() => setAttachment(null)} className="text-emerald-700 hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-16">
                <div className="w-24 h-24 bg-[#F7F8FC] shadow-[var(--shadow-neumorphic)] rounded-[2rem] flex items-center justify-center mb-8">
                  <BrainCircuit className="text-emerald-600/20 w-12 h-12" />
                </div>
                <h3 className="text-2xl font-bold text-zinc-300 tracking-tight">How can I help you today?</h3>
                <p className="text-zinc-400 mt-4 max-w-sm text-sm leading-relaxed">
                  Start a new session on the left. Upload photos or documents for expert guidance on anything.
                </p>
                <div className="mt-12 grid grid-cols-2 gap-6 w-full max-w-md">
                  <div className="p-6 rounded-3xl bg-[#F7F8FC] shadow-[var(--shadow-neumorphic-sm)] text-left">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">Step 1</p>
                    <p className="text-xs text-zinc-500 font-bold leading-relaxed">Describe your dilemma or upload context</p>
                  </div>
                  <div className="p-6 rounded-3xl bg-[#F7F8FC] shadow-[var(--shadow-neumorphic-sm)] text-left">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">Step 2</p>
                    <p className="text-xs text-zinc-500 font-bold leading-relaxed">Chat with Versa to refine your choices</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e4e4e7;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d4d4d8;
        }
      `}</style>
    </div>
  );
}
