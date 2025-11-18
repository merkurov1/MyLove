import GraphStarter from '@/components/GraphStarter';

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
