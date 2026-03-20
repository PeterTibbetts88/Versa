export interface Message {
  role: 'user' | 'model';
  text: string;
  attachment?: Attachment;
}

export interface Attachment {
  data: string; // base64
  mimeType: string;
  name: string;
}

export interface AnalysisResponse {
  title: string;
  summary: string;
  content: string; // Markdown content
}

export async function startAnalysis(
  input: string, 
  attachment?: Attachment
): Promise<AnalysisResponse> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, attachment }),
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start analysis');
    } else {
      const text = await response.text();
      console.error('Non-JSON error response:', text);
      throw new Error(`Server error (${response.status}): ${text.slice(0, 100)}...`);
    }
  }

  return response.json();
}

export async function sendChatMessage(
  history: Message[],
  newMessage: string,
  attachment?: Attachment
): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history, newMessage, attachment }),
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send chat message');
    } else {
      const text = await response.text();
      console.error('Non-JSON error response:', text);
      throw new Error(`Server error (${response.status}): ${text.slice(0, 100)}...`);
    }
  }

  const data = await response.json();
  return data.text;
}
