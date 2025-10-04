import DocumentsTable from '@/components/DocumentsTable'

export default function DocumentsPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Документы</h1>
        <DocumentsTable />
      </div>
    </main>
  )
}
