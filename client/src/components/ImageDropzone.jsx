import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Image, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ImageDropzone({ onFileAccepted, isLoading, preview, onClear }) {
  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length > 0) {
      toast.error('Only JPG, PNG, and WebP images are accepted (max 10 MB)');
      return;
    }
    if (accepted.length > 0) onFileAccepted(accepted[0]);
  }, [onFileAccepted]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    disabled: isLoading,
  });

  if (preview) {
    return (
      <div className="relative rounded-xl overflow-hidden border-2 border-primary-200">
        <img src={preview} alt="Preview" className="w-full h-56 object-cover" />
        <button
          onClick={onClear}
          className="absolute top-2 right-2 bg-white rounded-full p-1 shadow text-gray-600 hover:text-red-600"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all
        ${isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-gray-50 hover:border-primary-400 hover:bg-primary-50'}
        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <input {...getInputProps()} />
      <div className="p-3 bg-primary-100 rounded-full">
        {isDragActive ? <Image size={28} className="text-primary-600" /> : <Upload size={28} className="text-primary-500" />}
      </div>
      <div className="text-center">
        <p className="font-semibold text-gray-700">
          {isDragActive ? 'Drop image here' : 'Drag & drop or click to upload'}
        </p>
        <p className="text-sm text-gray-400 mt-1">JPG, PNG, WebP — max 10 MB</p>
      </div>
    </div>
  );
}
