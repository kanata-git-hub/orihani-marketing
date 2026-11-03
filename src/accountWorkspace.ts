// A page is bound to one verified account so pending editor writes cannot cross a sign-in.
let workspaceUid: string | null | undefined;

export function openWorkspace(uid: string) {
  if (!uid || (workspaceUid !== undefined && workspaceUid !== uid)) throw Error('로그인을 다시 확인해주세요.');
  workspaceUid = uid;
}

export function closeWorkspaceIfChanged(uid: string | null) {
  if (workspaceUid === undefined || workspaceUid === uid) return false;
  workspaceUid = null;
  return true;
}

export function accountKey(name: string) {
  if (!workspaceUid) throw Error('로그인 후 사용해주세요.');
  return 'ori-marketing:' + encodeURIComponent(workspaceUid) + ':' + name;
}

export const accountStorage = {
  getItem: (name: string) => window.localStorage.getItem(accountKey(name)),
  setItem: (name: string, value: string) => window.localStorage.setItem(accountKey(name), value),
  removeItem: (name: string) => window.localStorage.removeItem(accountKey(name)),
};
