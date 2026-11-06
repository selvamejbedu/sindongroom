import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const SCHOOL_ID = 'jeonju-sindong';
export const ADMIN_EMAILS = ['selvame@ai.jbedu.kr'];

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo:
        currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

export interface AuthErrorInfo {
  code: string;
  message: string;
  friendlyMessage: string;
  isDomainError: boolean;
  isPopupBlocked: boolean;
  isCancelled: boolean;
}

export function parseAuthError(error: unknown): AuthErrorInfo {
  const err = error as { code?: string; message?: string } | null;
  const code = err?.code || 'auth/unknown';
  const message = err?.message || String(error);

  let friendlyMessage = 'Google 로그인 처리 중 문제가 발생했습니다.';
  let isDomainError = false;
  let isPopupBlocked = false;
  let isCancelled = false;

  switch (code) {
    case 'auth/unauthorized-domain':
      isDomainError = true;
      friendlyMessage =
        '현재 웹사이트 도메인이 Firebase Authentication 승인 도메인(Authorized Domains)에 등록되지 않았습니다.';
      break;
    case 'auth/popup-blocked':
      isPopupBlocked = true;
      friendlyMessage = '브라우저 팝업이 차단되었습니다. 팝업 차단을 해제해 주세요.';
      break;
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      isCancelled = true;
      friendlyMessage = '로그인 창이 닫혔거나 취소되었습니다.';
      break;
    case 'auth/operation-not-allowed':
      friendlyMessage = 'Firebase 콘솔에서 Google 로그인 제공업체가 활성화되지 않았습니다.';
      break;
    case 'auth/network-request-failed':
      friendlyMessage = '네트워크 연결이 불안정합니다. 네트워크 상태를 확인해 주세요.';
      break;
    default:
      friendlyMessage = `로그인 오류가 발생했습니다 (${code}).`;
  }

  return {
    code,
    message,
    friendlyMessage,
    isDomainError,
    isPopupBlocked,
    isCancelled,
  };
}

export async function signInWithGoogle(): Promise<FirebaseUser> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err) {
    console.error('Google Sign-in failed:', err);
    throw err;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Logout failed:', err);
    throw err;
  }
}

export function isUserAdmin(_user?: FirebaseUser | null): boolean {
  return true; // All visitors and authenticated users have full administrator access
}

export { onAuthStateChanged };
export type { FirebaseUser };
