import { useState, useRef } from 'react';
import { Upload, X, File, Image, FileText, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadsAPI } from '../services/api';
import clsx from 'clsx';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv'
];

function FileUpload({ ticketId, commentId, onUploadComplete, maxFiles = 5 }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);

    // Validation
    const validFiles = selectedFiles.filter(file => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`Type non autorisé: ${file.name}`);
        return false;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`Fichier trop volumineux: ${file.name} (max 10MB)`);
        return false;
      }
      return true;
    });

    if (files.length + validFiles.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} fichiers`);
      return;
    }

    setFiles(prev => [...prev, ...validFiles]);
    e.target.value = ''; // Reset input
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));

      if (ticketId) formData.append('ticket_id', ticketId);
      if (commentId) formData.append('comment_id', commentId);

      const response = await uploadsAPI.upload(formData, {
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        }
      });

      toast.success(`${response.data.attachments.length} fichier(s) uploadé(s)`);
      setFiles([]);

      if (onUploadComplete) {
        onUploadComplete(response.data.attachments);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) return Image;
    if (file.type === 'application/pdf') return FileText;
    return File;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Zone de drop */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className={clsx(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
          'hover:border-primary-400 hover:bg-primary-50',
          files.length >= maxFiles ? 'opacity-50 pointer-events-none' : 'border-gray-300'
        )}
      >
        <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-600">
          Cliquez ou glissez des fichiers ici
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Max {maxFiles} fichiers, 10MB chacun
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          accept={ALLOWED_TYPES.join(',')}
          className="hidden"
          disabled={files.length >= maxFiles}
        />
      </div>

      {/* Liste des fichiers sélectionnés */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => {
            const Icon = getFileIcon(file);

            return (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                {file.type.startsWith('image/') ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-10 h-10 object-cover rounded"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                    <Icon className="w-5 h-5 text-gray-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  disabled={uploading}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            );
          })}

          {/* Barre de progression */}
          {uploading && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}

          {/* Bouton upload */}
          <button
            onClick={uploadFiles}
            disabled={uploading || files.length === 0}
            className="btn btn-primary w-full flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Upload en cours... {uploadProgress}%
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Uploader {files.length} fichier(s)
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default FileUpload;
