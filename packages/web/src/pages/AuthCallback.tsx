import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getSupabaseClient } from '../shared';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const sb = getSupabaseClient();

      // Check if there's an error in the URL
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (error) {
        console.error('OAuth error:', error, errorDescription);
        navigate(`/login?error=${encodeURIComponent(errorDescription || error)}`);
        return;
      }

      // Exchange the code for a session
      const code = searchParams.get('code');
      if (code) {
        const { error: sessionError } = await sb.auth.exchangeCodeForSession(code);
        if (sessionError) {
          console.error('Session exchange error:', sessionError);
          navigate(`/login?error=${encodeURIComponent(sessionError.message)}`);
          return;
        }
      }

      // Redirect to dashboard on success
      navigate('/dashboard');
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}