import FileUploader from '@/components/FileUploader';

export default function UploadPage() {
  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6 text-center">
          Загрузка документов
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8 text-center">
          Загрузите текстовые или офисные файлы для добавления в базу знаний.
        </p>
        <FileUploader />
      </div>
    </div>
  );
}
