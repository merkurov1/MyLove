import FileUploader from '@/components/FileUploader'
import LinkProcessor from '@/components/LinkProcessor'
import SourceSelector from '@/components/SourceSelector'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Панель управления AI-ассистентом
          </h1>
          <p className="text-lg text-gray-600">
            Загрузка и обработка данных в векторную базу данных
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">
            Выбор источника данных
          </h2>
          <SourceSelector />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">
              Загрузка файлов
            </h2>
            <FileUploader />
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">
              Обработка ссылок
            </h2>
            <LinkProcessor />
          </div>
        </div>
      </div>
    </main>
  )
}