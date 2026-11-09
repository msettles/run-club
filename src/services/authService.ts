import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  sendSignInLinkToEmail, 
  isSignInWithEmailLink, 
  signInWithEmailLink, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';

const EMAIL_STORAGE_KEY = 'woodchuckers_email_for_sign_in';

export interface AuthState {
  user: FirebaseUser | null;
  loading: boolean;
  error: string | null;
}

/**
 * Sign in with Google (Popup with redirect fallback)
 */
export async function loginWithGoogle(): Promise<FirebaseUser | null> {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase Authentication is not configured yet.');
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
      console.warn('Popup blocked, attempting redirect sign-in...');
      await signInWithRedirect(auth, provider);
      return null;
    }
    console.error('Google sign-in error:', error);
    throw error;
  }
}

/**
 * Send Passwordless Email Magic Link
 */
export async function sendPasswordlessEmailLink(email: string): Promise<void> {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase Authentication is not configured yet.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const actionCodeSettings = {
    // URL to redirect back to. Must be on the authorized domain list.
    url: window.location.origin,
    handleCodeInApp: true,
  };

  try {
    await sendSignInLinkToEmail(auth, cleanEmail, actionCodeSettings);
    // Save email locally so the user doesn't have to re-enter it on the same device
    window.localStorage.setItem(EMAIL_STORAGE_KEY, cleanEmail);
  } catch (error: any) {
    console.error('Error sending passwordless sign-in link:', error);
    throw error;
  }
}

/**
 * Plain-language message for a failed "email me a link" request.
 * Firebase's own text ("Firebase: Error (auth/quota-exceeded).") means nothing to runners.
 */
export function emailLinkErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code || '';
  switch (code) {
    case 'auth/quota-exceeded':
    case 'auth/too-many-requests':
      return "We can't send any more sign-in emails right now (the daily limit was reached). Please use “Continue with Google”, or try the email link again tomorrow.";
    case 'auth/invalid-email':
    case 'auth/missing-email':
      return "That doesn't look like a valid email address. Please check it and try again.";
    case 'auth/network-request-failed':
      return "Couldn't reach the sign-in service. Please check your connection and try again.";
    case 'auth/operation-not-allowed':
    case 'auth/unauthorized-continue-uri':
    case 'auth/invalid-continue-uri':
    case 'auth/unauthorized-domain':
      return "Email sign-in isn't available right now. Please use “Continue with Google”, and let a club organizer know.";
    default:
      return "Couldn't send the sign-in link. Please try again, or use “Continue with Google”.";
  }
}

/**
 * Check and complete passwordless email sign-in if the user opened a magic link
 */
export async function checkAndCompleteEmailLinkSignIn(): Promise<FirebaseUser | null> {
  if (!isFirebaseConfigured || !auth) return null;

  try {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem(EMAIL_STORAGE_KEY);
      
      // If the email isn't in local storage (e.g. user opened link on a different browser/device), prompt for it
      if (!email) {
        email = window.prompt('Please confirm your email address to complete sign in:');
      }

      if (!email) {
        throw new Error('Email is required to complete passwordless sign-in.');
      }

      const result = await signInWithEmailLink(auth, email.trim().toLowerCase(), window.location.href);
      window.localStorage.removeItem(EMAIL_STORAGE_KEY);
      
      // Clean up the URL query parameters
      window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
      return result.user;
    }
  } catch (error: any) {
    console.error('Error completing email link sign in:', error);
    throw error;
  }

  return null;
}

/**
 * Sign out the current user
 */
export async function logoutUser(): Promise<void> {
  if (!isFirebaseConfigured || !auth) return;
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Error signing out:', error);
    throw error;
  }
}

/**
 * Subscribe to auth state changes
 */
export function onAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
  if (!isFirebaseConfigured || !auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}
