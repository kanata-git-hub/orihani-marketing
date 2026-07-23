export const compressImage = (dataUrl: string, maxWidth = 512): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.6)); 
    };
    img.src = dataUrl;
  });
};

export const generateSecondImage = async (
  baseImage: string, 
  secondImageText: string, 
  logoImage: string | null
): Promise<string | null> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = baseImage;

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error("Failed to load base image for second slide"));
    setTimeout(() => reject(new Error("Base image load timeout")), 10000);
  });

  const targetWidth = 1024;
  const targetHeight = (img.height / img.width) * targetWidth;
  
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  // Ensure font is loaded before rendering on canvas
  try {
    await document.fonts.ready;
  } catch (e) {
    console.warn("Font loading wait failed", e);
  }

  const rawLines =  (secondImageText || '').split('\n');
  const lines = rawLines.slice(0, 8);
  
  ctx.fillStyle = '#1A1A1A';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const baseFontSize = canvas.width * 0.045;
  const fontSize = lines.length > 4 ? baseFontSize * 0.85 : baseFontSize;
  // Use the custom font
  ctx.font = `bold ${fontSize}px 'KyoboHandwriting2024_ParkSeoWoo', sans-serif`;
  
  const lineHeight = fontSize * 1.5;
  const totalHeight = (lines.length - 1) * lineHeight;
  const startY = (canvas.height / 2) - (totalHeight / 2) - (canvas.height * 0.05); 
  
  lines.forEach((line, i) => {
    if (line.trim() !== '') {
      ctx.fillText(line, canvas.width / 2, startY + (i * lineHeight));
    }
  });

  const legalFontSize = canvas.width * 0.014;
  ctx.font = `500 ${legalFontSize}px 'KyoboHandwriting2024_ParkSeoWoo', sans-serif`;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.textAlign = 'center';
  
  const disclaimer1 = "이 게시물은 의료법 제 56조, 57조, 시행령 제23조, 제24조를 준수하여 작성한 의료 정보성 게시물입니다.";
  const disclaimer2 = "모든 진단/검사/수술/시술은 개개인에 따라 결과 차이 및 부작용이 발생할 수 있으니 의료진과 충분한 상담을 진행하신 후에 결정하시길 바랍니다.";
  
  ctx.fillText(disclaimer1, canvas.width / 2, canvas.height - (legalFontSize * 12));
  ctx.fillText(disclaimer2, canvas.width / 2, canvas.height - (legalFontSize * 10));

  const logoImg = new Image();
  logoImg.crossOrigin = "anonymous";
  logoImg.src = logoImage || '/icon.png'; 

  await new Promise((resolve) => {
    logoImg.onload = () => resolve(true);
    logoImg.onerror = () => resolve(false);
    setTimeout(() => resolve(false), 5000);
  });

  const rightMargin = canvas.width * 0.05;
  const bottomMargin = legalFontSize * 4;
  
  if (logoImg.complete && logoImg.naturalWidth > 0) {
    const logoHeight = canvas.width * 0.05; 
    const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
    ctx.drawImage(logoImg, canvas.width - rightMargin - logoWidth, canvas.height - bottomMargin - logoHeight, logoWidth, logoHeight);
  } else {
    ctx.textAlign = 'right';
    const clinicName = "오리한의원";
    const clinicFontSize = legalFontSize * 2.2;
    ctx.font = `bold ${clinicFontSize}px 'KyoboHandwriting2024_ParkSeoWoo', sans-serif`;
    ctx.fillStyle = '#1A1A1A';
    ctx.fillText(clinicName, canvas.width - rightMargin, canvas.height - bottomMargin);
  }

  return canvas.toDataURL('image/png');
};
