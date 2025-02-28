'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import * as pdfjsLib from 'pdfjs-dist';
import { toast } from 'sonner';

// Initialize PDF.js worker
if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

interface UploadStatus {
    fileName: string;
    status: 'uploading' | 'processing' | 'completed' | 'error';
    progress?: number;
    error?: string;
}

interface Document {
    id: string;
    title: string;
    file_name: string;
    file_size: number;
    created_at: string;
}

export default function KnowledgeBase({ userId }: { userId: string }) {
    const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchDocuments = async () => {
        try {
            const response = await fetch(`/api/documents?userId=${encodeURIComponent(userId)}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error);
            }
            
            const data = await response.json();
            setDocuments(data.documents || []);
        } catch (error: any) {
            toast.error('Failed to fetch documents');
            console.error('Error fetching documents:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, [userId]);

    const deleteDocumentHandler = async (docId: string, fileName: string) => {
        try {
            const response = await fetch(`/api/documents?id=${encodeURIComponent(docId)}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error);
            }

            // Update local state
            setDocuments(prev => prev.filter(doc => doc.id !== docId));
            toast.success(`${fileName} deleted successfully`);
        } catch (error: any) {
            toast.error(`Failed to delete ${fileName}`);
            console.error('Error deleting document:', error);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const processFile = async (file: File) => {
        try {
            setUploadStatuses(prev => [...prev, { fileName: file.name, status: 'uploading' }]);

            // Load the PDF file
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            // Insert document metadata
            const docResponse = await fetch('/api/documents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'insertDocument',
                    document: {
                        user_id: userId,
                        title: file.name.replace('.pdf', ''),
                        file_name: file.name,
                        file_size: file.size,
                        file_type: file.type,
                    }
                }),
            });

            if (!docResponse.ok) {
                const errorData = await docResponse.json();
                throw new Error(errorData.error);
            }

            const docData = await docResponse.json();
            const documentId = docData.id;

            setUploadStatuses(prev => 
                prev.map(status => 
                    status.fileName === file.name 
                        ? { ...status, status: 'processing' }
                        : status
                )
            );

            // Process each page
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                    .map((item: any) => item.str)
                    .join(' ')
                    .trim();

                if (pageText.length === 0) continue;

                // Get embeddings from OpenAI
                const embedResponse = await fetch('/api/embed', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: pageText }),
                });

                if (!embedResponse.ok) {
                    throw new Error('Failed to generate embeddings');
                }

                const { embedding } = await embedResponse.json();

                // Store page content and embeddings
                const pageResponse = await fetch('/api/documents', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'insertPage',
                        page: {
                            document_id: documentId,
                            user_id: userId,
                            page_number: pageNum,
                            page_content: pageText,
                            page_embeddings: embedding,
                        }
                    }),
                });

                if (!pageResponse.ok) {
                    const errorData = await pageResponse.json();
                    throw new Error(errorData.error);
                }

                // Update progress
                setUploadStatuses(prev => 
                    prev.map(status => 
                        status.fileName === file.name 
                            ? { ...status, progress: Math.round((pageNum / pdf.numPages) * 100) }
                            : status
                    )
                );
            }

            setUploadStatuses(prev => 
                prev.map(status => 
                    status.fileName === file.name 
                        ? { ...status, status: 'completed' }
                        : status
                )
            );

            // Refresh documents list
            fetchDocuments();
            toast.success(`Successfully processed ${file.name}`);
        } catch (error: any) {
            console.error('Error processing file:', error);
            setUploadStatuses(prev => 
                prev.map(status => 
                    status.fileName === file.name 
                        ? { ...status, status: 'error', error: error.message }
                        : status
                )
            );
            toast.error(`Error processing ${file.name}: ${error.message}`);
        }
    };

    const onDrop = useCallback((acceptedFiles: File[]) => {
        acceptedFiles.forEach(file => {
            if (file.type !== 'application/pdf') {
                toast.error(`${file.name} is not a PDF file`);
                return;
            }
            processFile(file);
        });
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf']
        },
        multiple: true
    });

    return (
        <div className="w-full space-y-8">
            {/* Upload Section */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                <div className="p-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">Upload Documents</h2>
                    <p className="text-gray-600 mb-8">Add PDF documents to your knowledge base for easy access and search</p>
                    
                    <div
                        {...getRootProps()}
                        className={`
                            border-3 border-dashed rounded-xl p-12 text-center cursor-pointer
                            transition-all duration-300 ease-in-out transform
                            ${isDragActive 
                                ? 'border-primary bg-white shadow-inner scale-[0.98]' 
                                : 'border-gray-300 hover:border-primary/50 hover:bg-white/80 hover:scale-[0.99]'
                            }
                        `}
                    >
                        <input {...getInputProps()} />
                        <div className="space-y-4">
                            <div className={`
                                text-6xl mb-6 transition-transform duration-300
                                ${isDragActive ? 'scale-110' : 'hover:scale-110'}
                            `}>
                                {isDragActive ? '📂' : '📄'}
                            </div>
                            {isDragActive ? (
                                <p className="text-xl font-medium text-primary animate-pulse">
                                    Drop your PDF files here...
                                </p>
                            ) : (
                                <>
                                    <p className="text-xl font-medium text-gray-700">
                                        Drag and drop PDF files here
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        or click to select files from your computer
                                    </p>
                                    <div className="text-xs text-gray-400 mt-4 py-2 px-4 bg-gray-50 rounded-full inline-block">
                                        Only PDF files are accepted
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Upload Status */}
                {uploadStatuses.length > 0 && (
                    <div className="border-t border-gray-100">
                        <div className="p-8">
                            <h3 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                                <span className="mr-2">Upload Status</span>
                                <span className="text-sm font-normal text-gray-500">
                                    ({uploadStatuses.length} {uploadStatuses.length === 1 ? 'file' : 'files'})
                                </span>
                            </h3>
                            <div className="space-y-4">
                                {uploadStatuses.map((status, index) => (
                                    <div 
                                        key={index} 
                                        className={`
                                            p-6 rounded-xl border transition-all duration-300 transform
                                            ${status.status === 'completed' 
                                                ? 'bg-green-50 border-green-200 shadow-sm hover:scale-[0.995]' 
                                                : status.status === 'error'
                                                ? 'bg-red-50 border-red-200 shadow-sm hover:scale-[0.995]'
                                                : 'bg-blue-50 border-blue-200 shadow-sm'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center space-x-4">
                                                <span className="text-2xl">
                                                    {status.status === 'completed' ? '✅' : 
                                                     status.status === 'error' ? '❌' : '📝'}
                                                </span>
                                                <div>
                                                    <span className="font-medium text-gray-700">{status.fileName}</span>
                                                    <span className="text-sm text-gray-500 ml-2">
                                                        ({formatFileSize(new File([], status.fileName).size)})
                                                    </span>
                                                </div>
                                            </div>
                                            <span className={`
                                                px-4 py-1.5 rounded-full text-sm font-medium
                                                ${status.status === 'completed' 
                                                    ? 'bg-green-100 text-green-800' 
                                                    : status.status === 'error'
                                                    ? 'bg-red-100 text-red-800'
                                                    : 'bg-blue-100 text-blue-800'
                                                }
                                            `}>
                                                {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
                                            </span>
                                        </div>
                                        {status.status === 'processing' && status.progress !== undefined && (
                                            <div className="mt-4">
                                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                                                        style={{ width: `${status.progress}%` }}
                                                    />
                                                </div>
                                                <div className="flex justify-between mt-2">
                                                    <span className="text-sm text-gray-600">Processing pages...</span>
                                                    <span className="text-sm font-medium text-primary">
                                                        {status.progress}%
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        {status.error && (
                                            <p className="mt-3 text-sm text-red-600 bg-red-50/50 p-3 rounded-lg">
                                                ⚠️ Error: {status.error}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Documents List */}
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-800">Your Documents</h2>
                        <p className="text-gray-500 mt-1">Manage and access your uploaded documents</p>
                    </div>
                    <div className="bg-gray-100 px-4 py-2 rounded-full">
                        <span className="text-sm font-medium text-gray-600">
                            {documents.length} {documents.length === 1 ? 'document' : 'documents'}
                        </span>
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center py-16">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-6"></div>
                        <p className="text-gray-500 text-lg">Loading your documents...</p>
                    </div>
                ) : documents.length === 0 ? (
                    <div className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                        <div className="text-6xl mb-6 opacity-75">📚</div>
                        <p className="text-gray-500 text-xl mb-3">No documents yet</p>
                        <p className="text-gray-400">Upload PDF files to get started with your knowledge base</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {documents.map((doc) => (
                            <div 
                                key={doc.id}
                                className="flex items-center justify-between p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all duration-300 transform hover:scale-[0.995] border border-gray-200"
                            >
                                <div className="flex items-center space-x-6">
                                    <div className="text-3xl opacity-75">📄</div>
                                    <div>
                                        <h3 className="text-lg font-medium text-gray-800 mb-1">{doc.title}</h3>
                                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                                            <span className="flex items-center">
                                                <span className="mr-2">📁</span>
                                                {formatFileSize(doc.file_size)}
                                            </span>
                                            <span>•</span>
                                            <span className="flex items-center">
                                                <span className="mr-2">🕒</span>
                                                {formatDate(doc.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex space-x-3">
                                    <button
                                        onClick={() => {
                                            if (confirm('Are you sure you want to delete this document?')) {
                                                deleteDocumentHandler(doc.id, doc.file_name);
                                            }
                                        }}
                                        className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors duration-200 group"
                                        title="Delete"
                                    >
                                        <span className="text-xl group-hover:scale-110 transition-transform duration-200 inline-block">
                                            🗑️
                                        </span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
} 