import { useEffect, useState } from 'react';
import { loadVideoFromDB, type VideoHistoryItem } from '../hooks/useVideoHistory';
import { shareFile } from './share';

export function LegacyVideos({visible}: {visible: boolean}) {
  const [items, setItems] = useState<VideoHistoryItem[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { if(visible)loadVideoFromDB('video_history').then(value => setItems(Array.isArray(value) ? value : [])).catch(() => setError('이전 영상 기록을 읽지 못했습니다.')); }, [visible]);
  if (!items.length && !error) return null;
  return <details><summary>이전에 만든 영상 기록 · {items.length}개</summary><p>이 브라우저에 저장된 기존 영상입니다.</p>{error && <p>{error}</p>}{items.map(item => <div className="ori-row" key={item.id}><span>{item.diseaseName || item.situationDescription || '이전 영상'} · {new Date(item.createdAt).toLocaleDateString('ko-KR')}</span><button onClick={() => shareFile(new File([item.videoBlob],(item.diseaseName || '이전 영상').replace(/[\\/:*?"<>|]/g,'').slice(0,80)+'.mp4',{type:'video/mp4'})).catch(()=>setError('영상 저장을 다시 시도해주세요.'))}>영상 저장</button></div>)}</details>;
}
