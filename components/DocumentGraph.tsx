"use client";
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

// Dynamically import to avoid SSR issues and reduce initial bundle
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

export default function DocumentGraph({ centerId }: { centerId: string }) {
  const [data, setData] = useState({ nodes: [], links: [] as any[] });
  const fgRef = useRef<any>(null);

  useEffect(() => {
    if (!centerId) return;
    const fetchGraph = async () => {
      const res = await fetch(`/api/graph/documents?center=${encodeURIComponent(centerId)}&radius=1&limit=500`);
      const json = await res.json();
      const nodes = (json.nodes || []).map((n: any) => ({ id: n.id, name: n.title || n.id, url: n.url }));
      const links = (json.edges || []).map((e: any) => ({ source: e.source, target: e.target, weight: e.weight }));
      setData({ nodes, links });
    };
    fetchGraph();
  }, [centerId]);

  useEffect(() => {
    if (fgRef.current && data.nodes.length > 0) {
      fgRef.current.d3Force('charge').strength(-120);
    }
  }, [data]);

  if (!ForceGraph2D) return <div>Loading graph...</div>;

  return (
    <div className="w-full h-[600px] rounded border p-2">
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        nodeLabel={(n: any) => n.name}
        nodeAutoColorBy={(n: any) => n.url || n.name}
        linkWidth={(l: any) => Math.max(0.5, (l.weight || 0) * 2)}
        linkDirectionalParticles={1}
        onNodeClick={(node: any) => window.open(node.url || `/documents/${node.id}`, '_blank')}
      />
    </div>
  );
}
