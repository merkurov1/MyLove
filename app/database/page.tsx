import StatsPanel from '@/components/StatsPanel'
import SemanticSearch from '@/components/SemanticSearch'
import FileUploader from '@/components/FileUploader'
import DocumentsTable from '@/components/DocumentsTable'

export default function DatabasePanel() {
  return (
    <div className="max-w-5xl mx-auto p-4 space-y-8">
      <StatsPanel />
      <SemanticSearch />
      <FileUploader />
      <DocumentsTable />
    </div>
  )
}
