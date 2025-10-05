import axios from 'axios';

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
if (!VOYAGE_API_KEY) {
  throw new Error('VOYAGE_API_KEY is not set in environment variables');
}
const VOYAGE_EMBED_URL = 'https://api.voyageai.com/v1/embeddings';

export async function getVoyageEmbedding(text: string): Promise<number[]> {
  try {
    const response = await axios.post(
      VOYAGE_EMBED_URL,
      {
        model: 'voyage-2',
        input: text,
      },
      {
        headers: {
          'Authorization': `Bearer ${VOYAGE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('Voyage API embedding response:', JSON.stringify(response.data, null, 2));
    if (!response.data?.data?.[0]?.embedding) {
      throw new Error('No embedding returned from Voyage API');
    }
    return response.data.data[0].embedding;
  } catch (error: any) {
    if (error?.response) {
      console.error('Voyage embedding error response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Voyage embedding error:', error.message || error);
    }
    throw new Error('Ошибка получения эмбеддинга от Voyage AI: ' + (error?.response?.data ? JSON.stringify(error.response.data) : error.message));
  }
}

export async function getVoyageEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const response = await axios.post(
      VOYAGE_EMBED_URL,
      {
        model: 'voyage-2',
        input: texts,
      },
      {
        headers: {
          'Authorization': `Bearer ${VOYAGE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('Voyage API batch embedding response:', JSON.stringify(response.data, null, 2));
    if (!response.data?.data || !Array.isArray(response.data.data)) {
      throw new Error('No embeddings returned from Voyage API');
    }
    return response.data.data.map((item: any) => item.embedding);
  } catch (error: any) {
    if (error?.response) {
      console.error('Voyage batch embedding error response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Voyage batch embedding error:', error.message || error);
    }
    throw new Error('Ошибка batch-эмбеддинга от Voyage AI: ' + (error?.response?.data ? JSON.stringify(error.response.data) : error.message));
  }
}
