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
            Тестовая версия
          </h2>
          <p className="text-gray-600">
            Если вы видите этот текст, то базовая страница работает корректно.
          </p>
        </div>
      </div>
    </main>
  )
}