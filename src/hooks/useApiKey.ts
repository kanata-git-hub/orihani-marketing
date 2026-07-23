import { useState, useEffect } from 'react';

export const useApiKey = () => {
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    try {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    } catch (err) {
      console.error('Error checking API key:', err);
    }
  };

  const handleOpenKeyDialog = async () => {
    try {
      if (window.aistudio) {
        await window.aistudio.openSelectKey();
        setHasApiKey(true);
      }
    } catch (err) {
      console.error('Error opening key dialog:', err);
    }
  };

  return { hasApiKey, setHasApiKey, handleOpenKeyDialog };
};
