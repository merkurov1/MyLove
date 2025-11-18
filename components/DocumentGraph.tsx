"use client";
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

// Dynamically import to avoid SSR issues and reduce initial bundle
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

export default function DocumentGraph({ centerId }: { centerId: string }) {
  const [data, setData] = useState({ nodes: [], links: [] as any[] });
  const [method, setMethod] = useState<string>('cosine_avg_chunks');
  const [minWeight, setMinWeight] = useState<number>(0.5);
  const [limit, setLimit] = useState<number>(500);
  const [queryNode, setQueryNode] = useState<string>('');
  const fgRef = useRef<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!centerId) return;
    const fetchGraph = async () => {
      const params = new URLSearchParams();
      params.set('center', centerId);
      params.set('radius', '1');
      params.set('limit', String(limit));
      if (method) params.set('method', method);
      if (minWeight) params.set('min_weight', String(minWeight));

      const res = await fetch(`/api/graph/documents?${params.toString()}`);
      const json = await res.json();
      const nodes = (json.nodes || []).map((n: any) => ({ id: n.id, name: n.title || n.id, url: n.source_url || n.url, title: n.title, created_at: n.created_at }));
      const links = (json.edges || []).map((e: any) => ({ source: e.source, target: e.target, weight: e.weight }));
      setData({ nodes, links });
    };
    fetchGraph();
  }, [centerId]);

  // refetch when controls change
  useEffect(() => {
    if (!centerId) return;
    const fetchGraph = async () => {
      const params = new URLSearchParams();
      params.set('center', centerId);
      params.set('radius', '1');
      params.set('limit', String(limit));
      if (method) params.set('method', method);
      if (minWeight) params.set('min_weight', String(minWeight));

      const res = await fetch(`/api/graph/documents?${params.toString()}`);
      const json = await res.json();
      const nodes = (json.nodes || []).map((n: any) => ({ id: n.id, name: n.title || n.id, url: n.source_url || n.url, title: n.title, created_at: n.created_at }));
      const links = (json.edges || []).map((e: any) => ({ source: e.source, target: e.target, weight: e.weight }));
      setData({ nodes, links });
    };

    const t = setTimeout(fetchGraph, 300);
    return () => clearTimeout(t);
  }, [method, minWeight, limit, centerId]);

  useEffect(() => {
    if (fgRef.current && data.nodes.length > 0) {
      fgRef.current.d3Force('charge').strength(-120);
    }
  }, [data]);

  if (!ForceGraph2D) return <div>Loading graph...</div>;

  return (
    <div className="w-full rounded border p-2">
      <div className="flex gap-3 items-center mb-2">
        <label className="text-sm">Method:</label>
        <select value={method} onChange={e => setMethod(e.target.value)} className="border rounded px-2 py-1">
          <option value="cosine_avg_chunks">cosine_avg_chunks</option>
          <option value="pgvector_knn">pgvector_knn</option>
          <option value="text_overlap">text_overlap</option>
        </select>

        <label className="text-sm">Min weight:</label>
        <input type="range" min="0" max="1" step="0.01" value={minWeight} onChange={e => setMinWeight(Number(e.target.value))} />
        <span className="w-12 text-sm">{minWeight.toFixed(2)}</span>

        <label className="text-sm">Limit:</label>
        <input type="number" value={limit} onChange={e => setLimit(Number(e.target.value || 0))} className="w-20 border rounded px-2 py-1" />

        <input placeholder="Find node by id/title" value={queryNode} onChange={e => setQueryNode(e.target.value)} className="ml-2 border rounded px-2 py-1" />
        <button className="ml-1 btn" onClick={() => {
          if (!queryNode || !fgRef.current) return;
          const target = data.nodes.find((n: any) => (n.id === queryNode) || (n.name && n.name.toLowerCase().includes(queryNode.toLowerCase())));
          if (target && typeof target.x === 'number' && typeof target.y === 'number') {
            fgRef.current.centerAt(target.x, target.y, 400);
            fgRef.current.zoom(6, 400);
          } else if (target) {
            // try to slightly delay centering until layout stabilizes
            setTimeout(() => {
              if (target && fgRef.current && typeof target.x === 'number' && typeof target.y === 'number') {
                fgRef.current.centerAt(target.x, target.y, 400);
                fgRef.current.zoom(6, 400);
              }
            }, 500);
          }
        }}>Go</button>
      </div>

      <div className="w-full h-[600px]">
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        nodeLabel={(n: any) => n.name}
        nodeAutoColorBy={(n: any) => n.url || n.name}
        linkWidth={(l: any) => Math.max(0.5, (l.weight || 0) * 2)}
        linkDirectionalParticles={1}
        onNodeClick={async (node: any) => {
          // open preview panel
          try {
            setPreviewLoading(true);
            setSelected({ id: node.id, title: node.title, url: node.url, created_at: node.created_at });
            const res = await fetch(`/api/documents/${encodeURIComponent(node.id)}`);
            if (res.ok) {
              const { doc } = await res.json();
              const chunks = (doc.document_chunks || []).map((c: any) => c.content || '').join('\n\n');
              setSelected((s: any) => ({ ...s, description: doc.description || '', snippet: chunks.substring(0, 2000), raw: doc }));
            } else {
              setSelected((s: any) => ({ ...s, snippet: null }));
            }
          } catch (e) {
            console.warn('Failed to fetch preview', e);
            setSelected((s: any) => ({ ...s, snippet: null }));
          } finally {
            setPreviewLoading(false);
          }
        }}
      />
      </div>

      {/* Preview panel */}
      <div className="mt-3">
        {selected ? (
          <div className="border rounded p-3 bg-white shadow-sm max-w-full">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{selected.title || selected.id}</h3>
                <a href={selected.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 break-all">{selected.url}</a>
                <div className="text-xs text-gray-500">{selected.created_at}</div>
              </div>
              <div>
                <button className="btn" onClick={() => { setSelected(null); }}>Close</button>
              </div>
            </div>

            <div className="mt-2 text-sm">
              {previewLoading ? <div>Loading preview…</div> : (
                selected.snippet ? <pre className="whitespace-pre-wrap text-sm max-h-60 overflow-auto">{selected.snippet}</pre> : <div className="text-xs text-gray-500">No preview available</div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">Click a node to preview document.</div>
        )}
      </div>
    </div>
  );
}
