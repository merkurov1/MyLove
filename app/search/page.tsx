import SearchPlayground from '@/components/SearchPlayground'
import AdminExtractButton from '@/components/AdminExtractButton'

export const metadata = {
  title: 'Search Playground',
}

export default function Page() {
  return (
    <div className="min-h-screen py-8">
      <h2 className="text-2xl font-bold text-center mb-6">Search Playground</h2>
      <div className="max-w-4xl mx-auto px-4">
        <AdminExtractButton />
        <SearchPlayground />
      </div>
    </div>
  )
}
