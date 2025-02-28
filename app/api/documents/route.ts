import { NextResponse } from 'next/server';
import { getDocumentsByUserId, insertDocument, insertDocumentPage, deleteDocument } from '../../utils/neondb';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        const result = await getDocumentsByUserId(userId);

        if (!result.success) {
            throw new Error(result.error.message);
        }

        return NextResponse.json({ documents: result.data });
    } catch (error: any) {
        console.error('Error fetching documents:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch documents' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const { action, document, page } = await request.json();

        if (!action) {
            return NextResponse.json(
                { error: 'Action is required' },
                { status: 400 }
            );
        }

        let result;

        switch (action) {
            case 'insertDocument':
                if (!document) {
                    return NextResponse.json(
                        { error: 'Document data is required' },
                        { status: 400 }
                    );
                }
                result = await insertDocument(document);
                break;

            case 'insertPage':
                if (!page) {
                    return NextResponse.json(
                        { error: 'Page data is required' },
                        { status: 400 }
                    );
                }
                result = await insertDocumentPage(page);
                break;

            default:
                return NextResponse.json(
                    { error: 'Invalid action' },
                    { status: 400 }
                );
        }

        if (!result.success) {
            throw new Error(result.error.message);
        }

        return NextResponse.json({ success: true, id: result.id });
    } catch (error: any) {
        console.error('Error in document operation:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to process document operation' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const docId = searchParams.get('id');

        if (!docId) {
            return NextResponse.json(
                { error: 'Document ID is required' },
                { status: 400 }
            );
        }

        const result = await deleteDocument(parseInt(docId));

        if (!result.success) {
            throw new Error(result.error.message);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting document:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to delete document' },
            { status: 500 }
        );
    }
} 