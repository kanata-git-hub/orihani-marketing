// Replace client SDK with API proxy call
export const getGeminiClient = (apiKey?: string) => {
  return {
    models: {
      generateContent: async (params: any) => {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });
        if (!response.ok) {
          throw new Error('API Error: ' + await response.text());
        }
        return await response.json();
      },
      generateVideos: async (params: any) => {
        const response = await fetch('/api/generateVideos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });
        if (!response.ok) {
          throw new Error('API Error: ' + await response.text());
        }
        return await response.json();
      }
    },
    operations: {
      getVideosOperation: async (params: any) => {
        const response = await fetch('/api/getVideosOperation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });
        if (!response.ok) {
          throw new Error('API Error: ' + await response.text());
        }
        return await response.json();
      }
    }
  };
};
