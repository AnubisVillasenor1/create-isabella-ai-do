import React, { useEffect, useState } from "react";
import { BookOpen, FileText, ChevronRight, Lock, Hash } from "lucide-react";
import { useServerFn } from "../../lib/tanstack-polyfill";
import { getRegistrySnapshot } from "../../lib/atlas.functions";

export const CodexView: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  const fetchSnapshot = useServerFn(getRegistrySnapshot);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchSnapshot();
        setData(res);
        if (res.documents && res.documents.length > 0) {
          setSelectedDoc(res.documents[0]);
        }
      } catch (e: any) {
        setError(e.message);
      }
    };
    load();
  }, []);

  if (error) {
    return <div className="p-8 text-center text-red-400">Error loading Codex: {error}</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-slate-400 animate-pulse">Initializing Codex Connection...</div>;
  }

  const { documents, stats } = data;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-12 animate-fade-in text-slate-200">
      {/* Header */}
      <header className="flex flex-col items-center text-center space-y-6">
        <div className="inline-flex items-center justify-center p-2 rounded-xl bg-slate-900 border border-slate-800 text-blue-400">
          <BookOpen className="w-5 h-5" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-light text-slate-100 tracking-wide">Códice Canónico</h2>
          <p className="text-sm font-mono text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Documentos oficiales, arquitecturas y RFCs anclados en el registro inmutable de Atlas.
          </p>
        </div>
      </header>

      {/* Main Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 border-t border-slate-800/60 pt-12">
        
        {/* Left Column: Document List */}
        <div className="lg:col-span-4 space-y-6">
          <div className="flex items-center justify-between">
             <h3 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest">
               Registro Documental ({documents.length})
             </h3>
          </div>
          
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {documents.map((doc: any) => {
              const isSelected = selectedDoc?.document_uid === doc.document_uid;
              return (
                <div
                  key={doc.document_uid}
                  onClick={() => setSelectedDoc(doc)}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-300 ${
                    isSelected
                      ? "bg-slate-900 border-slate-700 shadow-sm"
                      : "bg-transparent border-slate-800/50 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[11px] font-bold text-slate-300">{doc.namespace}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${
                      doc.state === 'published' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {doc.state}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 font-medium line-clamp-2 leading-relaxed mb-1">
                    {doc.title}
                  </p>
                  <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {doc.document_uid.split("-").pop()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Detailed Document Viewer */}
        <div className="lg:col-span-8">
          {selectedDoc ? (
            <div className="space-y-8 animate-fade-in">
              <div className="space-y-4 border-b border-slate-800/50 pb-8">
                <h3 className="text-2xl font-light text-slate-100">
                  {selectedDoc.title}
                </h3>
                <div className="flex flex-wrap gap-4 text-xs font-mono text-slate-400">
                  <div className="flex items-center gap-1.5 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-800">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    ID: {selectedDoc.document_uid}
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-800">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    Federación: {selectedDoc.federation_id}
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500">Hash:</span> {selectedDoc.versions[selectedDoc.versions.length - 1].canonical_hash.substring(0, 16)}...
                  </div>
                </div>
              </div>

              {/* Content rendering */}
              <div className="prose prose-invert prose-slate max-w-none prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800">
                <div className="whitespace-pre-wrap font-sans text-sm text-slate-300 leading-loose">
                  {selectedDoc.versions[selectedDoc.versions.length - 1].content}
                </div>
              </div>

              {/* Cryptographic Ledger Info */}
              <div className="pt-8 border-t border-slate-800/50 space-y-4">
                <h4 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" />
                  Metadatos y Firmas
                </h4>
                <pre className="text-[11px] font-mono text-slate-400 break-all leading-relaxed p-4 bg-[#030712] border border-slate-800/60 rounded-xl shadow-inner overflow-x-auto">
                  {JSON.stringify({
                    metadata: selectedDoc.versions[selectedDoc.versions.length - 1].metadata,
                    signature: selectedDoc.versions[selectedDoc.versions.length - 1].signature,
                    anchors: selectedDoc.anchors,
                    created_by: selectedDoc.created_by,
                    created_at: selectedDoc.created_at
                  }, null, 2)}
                </pre>
              </div>

            </div>
          ) : (
             <div className="h-full flex items-center justify-center text-slate-500 font-mono text-xs p-12">
               Seleccione un documento del códice.
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
