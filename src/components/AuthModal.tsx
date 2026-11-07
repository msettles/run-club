import React, { useState } from 'react';
import { X, Mail, Sparkles, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { loginWithGoogle, sendPasswordlessEmailLink } from '../services/authService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: (email: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
}) => {
  const [emailInput, setEmailInput] = useState<string>('');
  const [isSubmittingGoogle, setIsSubmittingGoogle] = useState<boolean>(false);
  const [isSubmittingEmail, setIsSubmittingEmail] = useState<boolean>(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setIsSubmittingGoogle(true);
    try {
      const user = await loginWithGoogle();
      if (user && user.email) {
        if (onAuthSuccess) onAuthSuccess(user.email);
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to sign in with Google.');
    } finally {
      setIsSubmittingGoogle(false);
    }
  };

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!emailInput.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    setIsSubmittingEmail(true);
    try {
      await sendPasswordlessEmailLink(emailInput);
      setEmailSentSuccess(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to send magic sign-in link.');
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] overflow-y-auto bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-woodland-950 via-woodland-900 to-[#13495d] px-6 py-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-stone-300 hover:text-white rounded-full hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-16 h-16 rounded-2xl bg-amber-400 text-stone-950 flex items-center justify-center font-bold text-3xl shadow-lg mx-auto mb-3">
            🦫
          </div>
          <h2 className="text-xl font-display font-extrabold tracking-wide uppercase">
            Sign In to Woodchuckers
          </h2>
          <p className="text-xs text-woodland-200 mt-1 max-w-xs mx-auto">
            Zero passwords to remember. One-tap sign in for quick check-ins and milestone shirt tracking!
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Option 1: Google 1-Tap */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSubmittingGoogle || isSubmittingEmail}
            className="w-full py-3 px-4 bg-white hover:bg-stone-50 text-stone-800 font-bold text-sm rounded-xl border border-stone-300 shadow-xs flex items-center justify-center gap-3 transition active:scale-98 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
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
            <span>{isSubmittingGoogle ? 'Signing In...' : 'Continue with Google'}</span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-stone-200 w-full" />
            <span className="bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-stone-400 shrink-0">
              or passwordless email link
            </span>
            <div className="border-t border-stone-200 w-full" />
          </div>

          {/* Option 2: Passwordless Magic Link */}
          {emailSentSuccess ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-center space-y-2 animate-in fade-in">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-sm">Check Your Email!</h4>
              <p className="text-xs text-emerald-800 leading-relaxed">
                We sent a secure sign-in link to <strong className="font-semibold text-emerald-950">{emailInput}</strong>.
              </p>
              <p className="text-[11px] text-emerald-700">
                Tap the link in your email on this phone to log in instantly. You won't need to enter a password!
              </p>
              <button
                type="button"
                onClick={() => setEmailSentSuccess(false)}
                className="mt-2 text-xs font-bold text-emerald-800 underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendMagicLink} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="runner@example.com"
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none transition"
                  />
                </div>
                <span className="text-[10px] text-stone-500 mt-1 block">
                  We will send a one-click magic link straight to your inbox.
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmittingEmail || isSubmittingGoogle}
                className="w-full py-3 bg-woodland-800 hover:bg-woodland-900 text-white font-bold text-sm rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-display uppercase tracking-wide"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>{isSubmittingEmail ? 'Sending Link...' : 'Send Magic Sign-In Link'}</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </form>
          )}

          <div className="text-center pt-2">
            <span className="text-[11px] text-stone-400">
              🔒 Powered by Google Firebase Spark Auth • 100% Free &amp; Secure
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
