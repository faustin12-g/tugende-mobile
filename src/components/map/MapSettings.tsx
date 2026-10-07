import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, ChevronRight, LogOut, MapPin, Settings, ShieldCheck, UserRound, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { signOut } from '../../services/supabase';

export default function MapSettings() {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !signingOut) setIsOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, signingOut]);

  const handleSignOut = async () => {
    setSigningOut(true);
    setError(null);
    try {
      await signOut();
      logout();
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Could not sign out. Please try again.');
      setSigningOut(false);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Open settings"
        aria-haspopup="dialog"
        onClick={() => {
          setIsOpen(true);
          setError(null);
          setConfirmingSignOut(false);
        }}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/95 text-gray-600 shadow-lg backdrop-blur transition hover:bg-white hover:text-black focus:outline-none focus:ring-2 focus:ring-sunset"
      >
        <Settings aria-hidden="true" className="h-5 w-5" />
      </button>

      {isOpen && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !signingOut) setIsOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="map-settings-title"
            className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-6 py-5 backdrop-blur">
              <div>
                <h2 id="map-settings-title" className="text-xl font-bold text-gray-900">Settings</h2>
                <p className="mt-1 text-sm text-gray-500">Your account and app preferences</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close settings"
                onClick={() => setIsOpen(false)}
                disabled={signingOut}
                className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-sunset disabled:opacity-50"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <div>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Account</h3>
                <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sunset/10 text-sunset">
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <UserRound aria-hidden="true" className="h-6 w-6" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">{user?.name || 'Tugende user'}</p>
                    <p className="truncate text-sm text-gray-500">{user?.email || user?.phone || 'Account details unavailable'}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold capitalize text-gray-600 shadow-sm">
                    {user?.role || 'member'}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Privacy & location</h3>
                <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
                  <div className="flex items-start gap-3 p-4">
                    <MapPin aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-sunset" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Location access</p>
                      <p className="mt-1 text-sm leading-5 text-gray-500">
                        Used to show your position and find nearby rides. Manage permission in your device or browser settings.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4">
                    <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-sunset" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Account security</p>
                      <p className="mt-1 text-sm leading-5 text-gray-500">
                        Your sign-in is protected by a one-time code sent to your email.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-5">
                {!confirmingSignOut ? (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingSignOut(true);
                      setError(null);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300"
                  >
                    <LogOut aria-hidden="true" className="h-5 w-5" />
                    <span className="flex-1">Sign out</span>
                    <ChevronRight aria-hidden="true" className="h-4 w-4 text-red-300" />
                  </button>
                ) : (
                  <div className="rounded-2xl border border-red-100 bg-red-50/70 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                      <div>
                        <p className="font-semibold text-gray-900">Sign out of Tugende?</p>
                        <p className="mt-1 text-sm text-gray-600">Are you sure you want to sign out?</p>
                      </div>
                    </div>
                    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setConfirmingSignOut(false)}
                        disabled={signingOut}
                        className="flex-1 rounded-xl border border-gray-300 bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-200 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSignOut()}
                        disabled={signingOut}
                        className="flex-1 rounded-xl bg-red px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red/90 disabled:opacity-50"
                      >
                        {signingOut ? 'Signing out…' : 'Confirm sign out'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-center text-xs text-gray-400">Tugende · Secure ride access</p>
            </div>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}
