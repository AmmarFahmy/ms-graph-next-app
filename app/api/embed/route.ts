import { NextResponse } from 'next/server';
import { OpenAIEmbeddings } from '@langchain/openai';

export async function POST(request: Request) {
    try {
        const { text } = await request.json();

        if (!text) {
            return NextResponse.json(
                { error: 'Text is required' },
                { status: 400 }
            );
        }

        const embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
            modelName: 'text-embedding-3-small'
        });

        const embedding = await embeddings.embedQuery(text);

        return NextResponse.json({ embedding });
    } catch (error: any) {
        console.error('Error generating embeddings:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate embeddings' },
            { status: 500 }
        );
    }
} 