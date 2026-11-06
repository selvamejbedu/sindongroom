import React, { useState } from 'react';
import { AppUser } from '../types';
import { saveUserProfileInfo } from '../services/firestoreService';
import { Edit3, Save, X } from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser;
  onUpdateUser: (updated: AppUser) => void;
  onShowToast: (msg: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
  onShowToast,
}) => {
  const [name, setName] = useState(() => {
    return (
      currentUser.displayName ||
      localStorage.getItem('sindong_teacher_name') ||
      '신동초 선생님'
    );
  });
  const [classLabel, setClassLabel] = useState(() => {
    return (
      currentUser.defaultClassLabel ||
      localStorage.getItem('sindong_class_label') ||
      '5학년 2반'
    );
  });
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim() || '신동초 선생님';
    const cleanClass = classLabel.trim() || '5학년 2반';
    setSaving(true);

    try {
      localStorage.setItem('sindong_teacher_name', cleanName);
      localStorage.setItem('sindong_class_label', cleanClass);

      const updatedUser: AppUser = {
        ...currentUser,
        displayName: cleanName,
        defaultClassLabel: cleanClass,
      };

      try {
        localStorage.setItem('sindong_user', JSON.stringify(updatedUser));
      } catch {}

      if (currentUser.uid && !currentUser.uid.startsWith('teacher_') && currentUser.uid !== 'sindong_admin_default') {
        await saveUserProfileInfo(currentUser.uid, {
          displayName: cleanName,
          defaultClassLabel: cleanClass,
        });
      }

      onUpdateUser(updatedUser);
      onShowToast(`학년/반(${cleanClass}) 및 성함이 저장되었습니다.`);
      onClose();
    } catch (err) {
      console.error('Failed to save user profile:', err);
      onShowToast('프로필 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] dark:border-[#334155]">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4.5 h-4.5 text-[#8055E8]" />
            <h3 className="text-base font-bold text-[#1E232A] dark:text-[#F8FAFC]">
              교직원 프로필 및 학년/반 설정
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

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Google Account Tag if logged in via Google */}
          {currentUser.email && (
            <div className="p-3.5 rounded-xl bg-[#F0F7FF] dark:bg-blue-950/40 border border-[#B9DAFE] dark:border-blue-800/60 flex items-center gap-3">
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
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-[#1D5BD6] dark:text-blue-300">
                  Google 계정 연동 완료
                </div>
                <div className="text-xs font-semibold text-[#1E232A] dark:text-[#F8FAFC] truncate">
                  {currentUser.email}
                </div>
              </div>
            </div>
          )}

          {/* Teacher Name Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#1E232A] dark:text-[#F8FAFC]">
              선생님 성함 (예약자 자동 표시)
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 김민수 선생님"
              className="w-full px-3.5 py-2 text-sm bg-white dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#475569] rounded-xl focus:outline-none focus:border-[#8055E8] text-[#1E232A] dark:text-white"
            />
          </div>

          {/* Grade & Class Label Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#1E232A] dark:text-[#F8FAFC]">
              담당 학급 / 예약 대상 (자동 입력)
            </label>
            <input
              type="text"
              required
              value={classLabel}
              onChange={(e) => setClassLabel(e.target.value)}
              placeholder="예: 5학년 2반, 6학년 1반, 과학동아리"
              className="w-full px-3.5 py-2 text-sm bg-white dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#475569] rounded-xl focus:outline-none focus:border-[#8055E8] text-[#1E232A] dark:text-white"
            />
          </div>

          <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#334155] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[#64748B] hover:bg-[#F4F6F8] dark:hover:bg-[#2A374F] rounded-xl transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-bold text-white bg-[#8055E8] hover:bg-[#6D42D4] rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? '저장 중...' : '학년/반 저장하기'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
