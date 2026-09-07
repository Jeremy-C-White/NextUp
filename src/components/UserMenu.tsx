import React, { useCallback, useId, useLayoutEffect, useState, useRef, useEffect } from 'react';
import { Settings, LogOut } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { isTvBackKey } from '../lib/webos';

let activeUserMenuDismiss: (() => void) | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (event) => {
    if (!activeUserMenuDismiss || (event.key !== 'Escape' && !isTvBackKey(event))) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    activeUserMenuDismiss();
  }, true);
}

interface UserMenuProps {
  user: FirebaseUser;
  onOpenSettings: () => void;
  onSignOut: () => void;
}

export function UserMenu({ user, onOpenSettings, onSignOut }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const dismissMenu = useCallback(() => {
    setIsOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    activeUserMenuDismiss = dismissMenu;
    const frame = window.requestAnimationFrame(() => firstActionRef.current?.focus({ preventScroll: true }));
    return () => {
      window.cancelAnimationFrame(frame);
      if (activeUserMenuDismiss === dismissMenu) activeUserMenuDismiss = null;
    };
  }, [dismissMenu, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const initial = user.displayName?.charAt(0) || user.email?.charAt(0) || "U";

  return (
    <div className="relative" ref={menuRef}>
      <button 
        ref={triggerRef}
        type="button"
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => isOpen ? dismissMenu() : setIsOpen(true)}
        className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-300 dark:hover:border-slate-700 flex items-center justify-center text-orange-500 font-bold uppercase transition-colors"
      >
        {initial}
      </button>

      {isOpen && (
        <div id={menuId} role="menu" className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800/60">
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user.displayName || "User"}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{user.email}</p>
          </div>
          <div className="p-1.5">
            <button
              ref={firstActionRef}
              type="button"
              role="menuitem"
              onClick={() => {
                triggerRef.current?.focus({ preventScroll: true });
                setIsOpen(false);
                onOpenSettings();
              }}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2"
            >
              <Settings className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              Settings
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onSignOut();
              }}
              className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2 mt-1"
            >
              <LogOut className="w-4 h-4 text-red-500/80" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
