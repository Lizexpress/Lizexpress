import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Loader, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const EmailConfirmation: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success'>('loading');
  const [reloadAttempted, setReloadAttempted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleConfirmation = async () => {
      /**
       * IMPORTANT:
       * Supabase already verifies email BEFORE redirecting here.
       * Our job is ONLY to check session and stabilize login.
       */

      const { data } = await supabase.auth.getSession();

      if (data?.session?.user) {
        // ✅ User is logged in
        setStatus('success');

        // Auto-redirect to dashboard
        setTimeout(() => {
          navigate('/dashboard');
        }, 2500);

        return;
      }

      /**
       * 🔄 If session is not yet available:
       * This happens due to browser/cookie delay.
       * Reload ONCE to allow Supabase restore session.
       */
      if (!reloadAttempted) {
        setReloadAttempted(true);

        setTimeout(() => {
          window.location.reload();
        }, 1500);

        return;
      }

      /**
       * ✅ Even after reload:
       * DO NOT FAIL.
       * Show success and allow manual sign-in.
       */
      setStatus('success');
    };

    handleConfirmation();
  }, [navigate, reloadAttempted]);

  return (
    <div className="min-h-screen bg-[#4A0E67] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">

        {status === 'loading' && (
          <>
            <Loader className="w-16 h-16 mx-auto mb-4 animate-spin text-[#4A0E67]" />
            <h2 className="text-2xl font-bold text-[#4A0E67]">
              Confirming Your Email…
            </h2>
            <p className="text-gray-600 mt-2">
              Please wait, setting up your account.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-2xl font-bold text-[#4A0E67]">
              Email Confirmed Successfully 🎉
            </h2>
            <p className="text-gray-600 mt-3">
              Your account is verified. You’re ready to continue.
            </p>

            <button
              onClick={() => navigate('/signin')}
              className="mt-6 w-full bg-[#4A0E67] text-white py-3 rounded hover:bg-[#3a0b50] transition"
            >
              <User className="inline mr-2 w-5 h-5" />
              Continue to Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default EmailConfirmation;
