"use client";
import React, { useRef, useState } from "react";

interface FileUploaderProps {
  sourceId?: string;
}

export default function FileUploader({ sourceId }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
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
    setUploading(true);
    setProgress(0);
    setMessage(null);
    const formData = new FormData();
    formData.append("file", file);
    if (sourceId) {
      formData.append("sourceId", sourceId);
    }
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Файл успешно загружен и обработан!");
        console.log("Upload success:", data);
      } else {
        setMessage(data.error || "Ошибка загрузки файла");
        console.error("Upload error:", data);
      }
    } catch (err) {
      setMessage("Ошибка загрузки файла");
      console.error("Upload exception:", err);
    } finally {
      setUploading(false);
      setProgress(0);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-lg mt-8">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${file ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-300 dark:border-gray-700 hover:border-blue-400"}`}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept=".txt,.pdf,.doc,.docx,.md,.rtf"
          disabled={uploading}
        />
        {file ? (
          <div>
            <div className="font-semibold text-blue-700 dark:text-blue-300 mb-2">{file.name}</div>
            <div className="text-xs text-gray-500 mb-2">{(file.size / 1024).toFixed(1)} KB</div>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? "Загрузка..." : "Загрузить"}
            </button>
          </div>
        ) : (
          <div className="text-gray-400">Перетащите файл сюда или кликните для выбора</div>
        )}
      </div>
      {progress > 0 && (
        <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {message && (
        <div className={`mt-4 text-center ${message.includes("успешно") ? "text-green-600" : "text-red-600"}`}>{message}</div>
      )}
    </div>
  );
}

