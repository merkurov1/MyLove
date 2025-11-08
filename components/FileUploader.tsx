"use client";
import React, { useRef, useState } from "react";
import { FaCheckCircle, FaExclamationCircle, FaSpinner, FaCloudUploadAlt } from "react-icons/fa";

interface FileUploaderProps {
  sourceId?: string;
}

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

export default function FileUploader({ sourceId }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [details, setDetails] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setMessage(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0] || null;
    setFile(f);
    setMessage(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setStatus('uploading');
    setMessage('Загрузка файла...');
    setDetails(null);
    setUploadProgress(0);
    
    const formData = new FormData();
    formData.append("file", file);
    if (sourceId) {
      formData.append("sourceId", sourceId);
    }
    
    try {
      // Симуляция прогресса загрузки (0-50%)
      const uploadInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 50));
      }, 200);
      
      const res = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });
      
      clearInterval(uploadInterval);
      setUploadProgress(60);
      setStatus('processing');
      setMessage('Обработка файла...');
      
      // Симуляция прогресса обработки (60-90%)
      const processInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 5, 90));
      }, 300);
      
      const data = await res.json();
      clearInterval(processInterval);
      
      if (res.ok) {
        setUploadProgress(100);
        setStatus('success');
        setMessage(`✓ Файл успешно обработан!`);
        setDetails({
          documentId: data.document_id,
          chunks: data.totalChunks,
          model: data.embeddingModel,
          dimension: data.embeddingDimension
        });
        
        // Очищаем форму через 3 секунды
        setTimeout(() => {
          setFile(null);
          setStatus('idle');
          setMessage(null);
          setDetails(null);
          setUploadProgress(0);
          if (inputRef.current) inputRef.current.value = "";
        }, 3000);
      } else {
        setStatus('error');
        setMessage(`✗ Ошибка: ${data.error || 'Неизвестная ошибка'}`);
        setDetails(data);
        setUploadProgress(0);
        console.error("Upload error:", data);
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(`✗ Ошибка сети: ${err.message}`);
      setUploadProgress(0);
      console.error("Upload exception:", err);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <FaSpinner className="animate-spin text-blue-500 text-3xl" />;
      case 'success':
        return <FaCheckCircle className="text-green-500 text-3xl" />;
      case 'error':
        return <FaExclamationCircle className="text-red-500 text-3xl" />;
      default:
        return <FaCloudUploadAlt className="text-gray-400 text-5xl" />;
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white dark:bg-gray-900 rounded-xl shadow-2xl">
      <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
        <FaCloudUploadAlt className="text-blue-500" />
        Загрузка файлов
      </h3>
      
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          file 
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
            : "border-gray-300 dark:border-gray-700 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800"
        }`}
        onClick={() => status === 'idle' && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept=".txt,.pdf,.doc,.docx,.md,.rtf"
          disabled={status === 'uploading' || status === 'processing'}
        />
        
        <div className="flex flex-col items-center gap-4">
          {getStatusIcon()}
          
          {file ? (
            <div className="w-full">
              <div className="font-semibold text-blue-700 dark:text-blue-300 mb-1">{file.name}</div>
              <div className="text-xs text-gray-500 mb-4">{(file.size / 1024).toFixed(1)} KB</div>
              
              {status === 'idle' && (
                <button
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
                  onClick={(e) => { e.stopPropagation(); handleUpload(); }}
                >
                  Загрузить и обработать
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className="text-gray-600 dark:text-gray-300 font-medium mb-2">
                Перетащите файл сюда
              </div>
              <div className="text-sm text-gray-400">
                или кликните для выбора
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Поддерживаемые форматы: TXT, PDF, DOC, DOCX, MD, RTF
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Progress Bar */}
      {(status === 'uploading' || status === 'processing') && uploadProgress > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>{status === 'uploading' ? 'Загрузка...' : 'Обработка...'}</span>
            <span className="font-semibold">{uploadProgress}%</span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out rounded-full"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          {uploadProgress > 50 && details?.totalChunks && (
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Создание {details.totalChunks} фрагментов для векторного поиска...
            </div>
          )}
        </div>
      )}

      {message && (
        <div className={`mt-4 p-4 rounded-lg border ${
          status === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
            : status === 'error'
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
        }`}>
          <div className="font-medium">{message}</div>
          {details && status === 'success' && (
            <div className="text-xs mt-2 space-y-1">
              <div>Создано чанков: {details.chunks}</div>
              <div>Модель: {details.model}</div>
              <div>ID документа: {details.documentId?.substring(0, 8)}...</div>
            </div>
          )}
          {details && status === 'error' && (
            <details className="text-xs mt-2">
              <summary className="cursor-pointer">Подробности ошибки</summary>
              <pre className="mt-2 p-2 bg-white dark:bg-gray-900 rounded overflow-auto max-h-40">
                {JSON.stringify(details, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

