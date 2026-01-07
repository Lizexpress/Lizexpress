import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, XCircle, Loader, AlertTriangle, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const EmailConfirmation: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already_confirmed'>('loading');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        const queryParams = new URLSearchParams(location.search);
        const hashParams = new URLSearchParams(location.hash.replace('#', ''));

        const code = queryParams.get('code');
        const type = queryParams.get('type');

        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');

        // Handle Supabase errors
        if (error) {
          if (error === 'access_denied' && errorDescription?.includes('already_confirmed')) {
            setStatus('already_confirmed');
            setMessage('Your email is already confirmed. Please sign in.');
            return;
          }
          throw new Error(errorDescription || 'Email confirmation failed.');
        }

        // 🔹 Case 1: Code-based confirmation (NEW Supabase default)
        if (code && type === 'signup') {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: code,
            type: 'signup',
          });

          if (error) throw error;

          if (data?.user) {
            await supabase.from('users').upsert(
              {
                id: data.user.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                profile_completed: false,
                verification_submitted: false,
              },
              { onConflict: 'id' }
            );

            setStatus('success');
            setMessage('Email confirmed successfully. You can now sign in.');

            setTimeout(() => navigate('/signin'), 3000);
            return;
          }
        }

        // 🔹 Case 2: Token-based confirmation (older / hash redirect)
        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) throw error;

          if (data?.user) {
            await supabase.from('users').upsert(
              {
                id: data.user.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                profile_completed: false,
                verification_submitted: false,
              },
              { onConflict: 'id' }
            );

            setStatus('success');
            setMessage('Email confirmed successfully. Redirecting...');

            setTimeout(() => navigate('/signin'), 3000);
            return;
          }
        }

        throw new Error('Invalid or expired confirmation link.');
      } catch (err: any) {
        console.error('Email confirmation error:', err);
        setStatus('error');
        setMessage(
          err.message ||
            'Verification failed. The link may be expired. Please sign up again.'
        );
      }
    };

    if (location.search || location.hash) {
      confirmEmail();
    } else {
      setStatus('error');
      setMessage('Invalid confirmation link.');
    }
  }, [location, navigate]);

  return (
    <div className="min-h-screen bg-[#4A0E67] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <Loader className="w-16 h-16 mx-auto mb-4 animate-spin text-[#4A0E67]" />
            <h2 className="text-2xl font-bold text-[#4A0E67]">Confirming Email…</h2>
            <p className="text-gray-600 mt-2">Please wait</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-2xl font-bold text-[#4A0E67]">Email Confirmed 🎉</h2>
            <p className="text-gray-600 mt-2">{message}</p>

            <button
              onClick={() => navigate('/signin')}
              className="mt-6 w-full bg-[#4A0E67] text-white py-3 rounded hover:bg-[#3a0b50]"
            >
              <User className="inline mr-2 w-5 h-5" />
              Sign In
            </button>
          </>
        )}

        {status === 'already_confirmed' && (
          <>
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-2xl font-bold text-[#4A0E67]">Already Confirmed</h2>
            <p className="text-gray-600 mt-2">{message}</p>

            <button
              onClick={() => navigate('/signin')}
              className="mt-6 w-full bg-[#4A0E67] text-white py-3 rounded"
            >
              Sign In
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-[#4A0E67]">Confirmation Failed</h2>
            <p className="text-gray-600 mt-2">{message}</p>

            <div className="bg-red-50 border border-red-200 rounded p-4 mt-4 text-sm text-red-700">
              <AlertTriangle className="inline w-4 h-4 mr-1" />
              Check your spam folder or request a new signup link.
            </div>

            <button
              onClick={() => navigate('/signup')}
              className="mt-6 w-full bg-[#F7941D] text-white py-3 rounded"
            >
              Sign Up Again
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default EmailConfirmation;
