import { redirect } from 'next/navigation';

// This page handles the root locale path (e.g., /en, /de, /es)
// It should never be reached due to middleware redirects, but serves as a fallback
export default function LocaleHomePage() {
  // Redirect authenticated users to chat, non-authenticated to login
  // Note: This page is a fallback - middleware handles the actual smart redirect
  redirect('/login');
}
