import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  LogIn,
  User,
  X,
} from 'lucide-react';
import {
  FIREBASE_PROJECT_ID,
  parseAuthError,
  signInWithGoogle,
  AuthErrorInfo,
} from '../firebase';
import { AppUser } from '../types';
import { syncUserProfile } from '../services/firestoreService';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AppUser) => void;
  initialError?: AuthErrorInfo | null;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  initialError = null,
}) => {
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(initialError);
  const [copied, setCopied] = useState(false);

  // Quick teacher name state
  const [customName, setCustomName] = useState('');

  if (!isOpen) return null;

  const currentHostname =
    typeof window !== 'undefined' ? window.location.hostname : '';
  const firebaseConsoleUrl = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/settings`;

  const handleCopyDomain = () => {
    if (!currentHostname) return;
    navigator.clipboard.writeText(currentHostname);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExecuteGoogleLogin = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const fbUser = await signInWithGoogle();
      const profile = await syncUserProfile(fbUser);
      onLoginSuccess(profile);
      onClose();
    } catch (err) {
      console.error('Google Login error in modal:', err);
      const parsed = parseAuthError(err);
      setAuthError(parsed);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLoginCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const name = customName.trim() || '신동초 선생님';

    const teacherUser: AppUser = {
      uid: `teacher_${Date.now()}`,
      email: null,
      displayName: name,
      photoURL: null,
      role: 'teacher',
      schoolId: 'jeonju-sindong',
    };

    try {
      localStorage.setItem('sindong_user', JSON.stringify(teacherUser));
      localStorage.setItem('sindong_teacher_name', name);
    } catch {}

    onLoginSuccess(teacherUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] dark:border-[#334155]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8055E8]" />
            <h3 className="text-base font-bold text-[#1E232A] dark:text-[#F8FAFC]">
              전주신동초 교직원 로그인
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#8A91A0] hover:text-[#1E232A] dark:hover:text-white hover:bg-[#F8FAFC] dark:hover:bg-[#2A374F] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Main Google Login Button */}
          <div>
            <button
              type="button"
              disabled={loading}
              onClick={handleExecuteGoogleLogin}
              className="w-full py-3 px-4 bg-white dark:bg-[#0F172A] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] border-2 border-[#CBD5E1] dark:border-[#475569] hover:border-[#8055E8] rounded-xl text-sm font-bold text-[#1E232A] dark:text-white flex items-center justify-center gap-3 transition-all shadow-xs cursor-pointer group"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{loading ? 'Google 로그인 창 연결 중...' : 'Google 계정으로 공식 로그인'}</span>
            </button>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] text-center mt-2">
              전북교육청(@ai.jbedu.kr) 또는 개인 Google 계정으로 로그인 가능합니다.
            </p>
          </div>

          {/* Diagnostic Error Notice (if error occurred) */}
          {authError && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    {authError.isDomainError
                      ? 'Firebase 승인 도메인 등록 안내 (auth/unauthorized-domain)'
                      : authError.friendlyMessage}
                  </div>
                  <div className="text-[11px] text-amber-800/90 dark:text-amber-300 leading-relaxed">
                    {authError.isDomainError ? (
                      <>
                        현재 Cloud Run 호스트 주소가 Firebase 콘솔의 <strong>Authorized Domains</strong>에 아직 등록되지 않았습니다.
                      </>
                    ) : (
                      authError.message
                    )}
                  </div>
                </div>
              </div>

              {authError.isDomainError && (
                <div className="pt-2 border-t border-amber-200/80 dark:border-amber-800/40 space-y-2.5">
                  <div className="text-xs font-semibold text-amber-950 dark:text-amber-100">
                    해결 방법 (30초 소요):
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-white dark:bg-[#0F172A] rounded-lg border border-amber-200 dark:border-amber-800 text-xs">
                    <span className="font-mono text-[11px] text-[#1E232A] dark:text-[#F8FAFC] truncate flex-1">
                      {currentHostname}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyDomain}
                      className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/60 hover:bg-amber-200 text-amber-900 dark:text-amber-200 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>복사됨!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>도메인 복사</span>
                        </>
                      )}
                    </button>
                  </div>

                  <a
                    href={firebaseConsoleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
                  >
                    <span>Firebase 콘솔 Authorized Domains 설정 바로가기</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <p className="text-[10px] text-amber-800/80 dark:text-amber-300">
                    💡 콘솔 이동 후 <strong>[도메인 추가]</strong>에 위 주소를 붙여넣고 저장하면 즉시 Google 로그인이 정상 작동합니다.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Quick Teacher Sign-in option without revealing any private email */}
          <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#334155] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">
                선생님 성함으로 간편 시작
              </span>
            </div>
            <form onSubmit={handleQuickLoginCustom} className="p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#1E232A] dark:text-[#F8FAFC] mb-1">
                  선생님 성함
                </label>
                <input
                  type="text"
                  required
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="예: 5학년 담당 선생님"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#1E293B] border border-[#CBD5E1] dark:border-[#475569] rounded-lg focus:outline-none focus:border-[#8055E8]"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-[#8055E8] hover:bg-[#6D42D4] text-white text-xs font-bold rounded-lg transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>성함으로 바로 이용하기</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
