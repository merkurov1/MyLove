import DocumentGraph from '@/components/DocumentGraph';

export const revalidate = 0;

export default function Page() {
  // For MVP: allow user to paste a center document id
  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">Document Graph Explorer</h2>
      <div className="mb-4">
        <GraphStarter />
      </div>
    </div>
  );
}

function GraphStarter() {
  const [center, setCenter] = (globalThis as any).React?.useState?.('') || (function(){ let s=''; return [s, (v:any)=>{s=v}]; })();

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input className="flex-1 p-2 border rounded" placeholder="Paste center document id" value={center} onChange={(e: any) => setCenter(e.target.value)} />
      </div>
      {center ? <DocumentGraph centerId={center} /> : (
        <div className="p-4 border rounded text-sm text-gray-600">Введите id документа и нажмите Enter</div>
      )}
    </div>
  );
}
