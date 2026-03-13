import { useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { Upload, Download, Trash2, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

const FileUploadPanel = ({ teamId, isMentor, userId }) => {
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)

  const { data: filesData } = useQuery({
    queryKey: ['team-files', teamId],
    queryFn: async () => {
      const res = await api.get(`/teams/${teamId}/files`)
      return res.data.files || []
    },
    enabled: !!teamId
  })

  const uploadMutation = useMutation({
    mutationFn: (formData) =>
      api.post(`/teams/${teamId}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-files', teamId] })
      toast.success('File uploaded')
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Upload failed')
  })

  const deleteMutation = useMutation({
    mutationFn: (fileId) => api.delete(`/teams/${teamId}/files/${fileId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-files', teamId] })
      toast.success('File deleted')
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Delete failed')
  })

  const files = filesData || []

  const handleUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    uploadMutation.mutate(formData)
  }

  const handleDownload = async (fileId, fileName) => {
    try {
      const token = localStorage.getItem('token')
      const base = import.meta.env.VITE_API_URL || '/api'
      const res = await fetch(`${base}/teams/${teamId}/files/${fileId}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName || 'download'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      toast.error('Download failed')
    }
  }

  const formatSize = (bytes) => {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary-600" />
          Files
        </h3>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.py,.js,.ts,.zip,.png,.jpg,.jpeg,.gif"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg divide-y">
        {files.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-sm">No files yet. Upload to share with the team.</div>
        ) : (
          files.map((f) => (
            <div key={f.id} className="flex items-center justify-between p-3 hover:bg-gray-950">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white truncate">{f.file_name}</p>
                <p className="text-xs text-gray-400">
                  {f.uploader_name} · {new Date(f.uploaded_at).toLocaleDateString()} · {formatSize(f.file_size)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleDownload(f.id, f.file_name)}
                  className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
                {(isMentor || f.uploader_id === userId) && (
                  <button
                    onClick={() => deleteMutation.mutate(f.id)}
                    disabled={deleteMutation.isPending}
                    className="p-2 text-red-600 hover:bg-red-900/10 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default FileUploadPanel
