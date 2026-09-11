export const clipLengths = (duration:5) => { if(duration!==5)throw Error('마케팅 영상은 5초 영상 한 개를 사용합니다.');return [5]; };
export function validateMediaSizes(videos:({size:number}|null)[], duration:5, voiceSize=0) {
  if(videos.length!==clipLengths(duration).length||videos.some(f=>!f))throw Error('각 칸에 Kling 영상 파일을 넣어주세요.');
  if(videos.some(f=>f!.size<=0||f!.size>26*1024*1024))throw Error('영상 한 파일은 26MB 이하여야 합니다. Kling에서 1080p로 다운로드해주세요.');
  if(videos.reduce((n,f)=>n+f!.size,voiceSize)>27.8*1024*1024)throw Error('영상과 음성 합계는 28MB 이하여야 합니다. Kling에서 1080p로 다운로드해주세요.');
}
export function validateMediaDuration(actual:number, expected:number, index:number) {
  if(!Number.isFinite(actual)||actual<expected-0.15||actual>expected+0.5)throw Error(`${index+1}번 영상은 ${expected}초여야 합니다. 선택한 파일은 ${Number.isFinite(actual)?actual.toFixed(1)+'초':'길이 확인 불가'}입니다. 음성 분석을 시작하지 않았습니다.`);
}
export function mediaDuration(blob:Blob, kind:'video'|'audio'):Promise<number> {
  return new Promise((resolve,reject)=>{
    const element=document.createElement(kind),url=URL.createObjectURL(blob);
    const done=(error?:Error)=>{clearTimeout(timer);const duration=element.duration;element.onloadedmetadata=null;element.onerror=null;element.removeAttribute('src');element.load();URL.revokeObjectURL(url);error?reject(error):resolve(duration);};
    const timer=setTimeout(()=>done(Error('파일 정보를 읽지 못했습니다. MP4 영상 파일인지 확인해주세요.')),15000);
    element.preload='metadata';element.onloadedmetadata=()=>done();element.onerror=()=>done(Error('이 브라우저에서 파일을 읽지 못했습니다. MP4 영상 파일인지 확인해주세요.'));element.src=url;
  });
}
