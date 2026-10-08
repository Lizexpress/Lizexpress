import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { endpoints } from '../lib/api.js';
import { money } from '../lib/format.js';

/**
 * Payment step and result screen.
 *
 * Two things worth noting:
 *  1. The Flutterwave checkout is opened with the PUBLIC key returned by the
 *     server. The secret key never reaches the browser — that was a real hole
 *     in v1.
 *  2. "Successful" here is whatever the server says after verifying with
 *     Flutterwave directly. The widget's own callback is treated as a hint to
 *     go and check, never as proof of payment.
 */
const PaymentCallback = () => {
  const [params] = useSearchParams();
  const itemId = params.get('itemId');
  const txRef = params.get('tx_ref');
  const transactionId = params.get('transaction_id');
  const flwStatus = params.get('status');

  const [state, setState] = useState('working');
  // Advert payments use an LXAD- reference, so the kind is known even on a
  // cancelled checkout, where the server is never asked.
  const isAdvert = (txRef ?? '').toUpperCase().startsWith('LXAD-');
  const [advertId, setAdvertId] = useState(null);
  const [quote, setQuote] = useState(null);
  const [message, setMessage] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      // Returning from checkout — verify server-side.
      if (txRef && transactionId) {
        if (flwStatus === 'cancelled') {
          setState('cancelled');
          return;
        }
        try {
          const result = await endpoints.payments.confirm({ txRef, transactionId });
          if (result.advertId) setAdvertId(result.advertId);
          setState(result.status === 'successful' ? 'success' : 'failed');
        } catch (error) {
          setState('failed');
          setMessage(error.message);
        }
        return;
      }

      // Arriving from the listing form — fetch the quote and open checkout.
      if (!itemId) {
        setState('failed');
        setMessage('We could not find that listing.');
        return;
      }

      try {
        const [quoted, init] = await Promise.all([
          endpoints.payments.quote(itemId),
          endpoints.payments.initialise(itemId),
        ]);
        setQuote(quoted);

        if (typeof window.FlutterwaveCheckout !== 'function') {
          setState('failed');
          setMessage('The payment window could not load. Check your connection and try again.');
          return;
        }

        window.FlutterwaveCheckout({
          public_key: init.publicKey,
          tx_ref: init.txRef,
          amount: init.amount,
          currency: init.currency,
          payment_options: 'card,banktransfer,ussd',
          redirect_url: `${window.location.origin}/payment/callback`,
          customer: init.customer,
          customizations: init.customizations,
        });
        setState('checkout');
      } catch (error) {
        setState('failed');
        setMessage(error.message);
      }
    })();
  }, [itemId, txRef, transactionId, flwStatus]);

  const PANELS = {
    working: { icon: Loader2, spin: true, tone: 'text-purple-500', title: 'Setting up your payment', copy: 'One moment.' },
    checkout: { icon: Loader2, spin: true, tone: 'text-purple-500', title: 'Complete your payment', copy: 'Finish in the payment window. If it did not open, refresh this page.' },
    success: { icon: CheckCircle2, tone: 'text-success', title: 'Payment confirmed', copy: 'Your listing is now live. We have emailed your receipt.' },
    failed: { icon: XCircle, tone: 'text-danger', title: 'That payment did not complete', copy: message || 'You have not been charged. Your item is saved as a draft.' },
    cancelled: { icon: XCircle, tone: 'text-ink-muted', title: 'Payment cancelled', copy: 'Your item is saved as a draft. You can pay whenever you are ready.' },
  };

  if (isAdvert) {
    PANELS.success.copy = 'Your advert is live. Customers in your area can now find it.';
    PANELS.failed.copy = message || 'You have not been charged. Your advert is saved; you can pay from My adverts.';
    PANELS.cancelled.copy = 'Your advert is saved. You can pay whenever you are ready.';
  }

  const panel = PANELS[state];

  return (
    <div className="container-page flex min-h-[70vh] max-w-md flex-col items-center justify-center text-center">
      <panel.icon size={44} className={`${panel.tone} ${panel.spin ? 'animate-spin' : ''}`} aria-hidden="true" />
      <h1 className="mt-5 font-display text-2xl font-semibold">{panel.title}</h1>
      <p className="mt-2 leading-relaxed text-ink-soft">{panel.copy}</p>

      {quote && state === 'checkout' && (
        <p className="mt-4 rounded-xl bg-canvas-warm px-4 py-3 text-sm text-ink-soft">
          Listing fee for <span className="font-semibold text-ink">{quote.itemName}</span>:{' '}
          <span className="font-semibold text-ink">{money(quote.fee, quote.currency)}</span>
        </p>
      )}

      {isAdvert && ['success', 'failed', 'cancelled'].includes(state) && (
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {state === 'success' && advertId && (
            <Link to={`/adverts/${advertId}`} className="btn-primary">View your advert</Link>
          )}
          <Link to="/dashboard/adverts" className={state === 'success' ? 'btn-secondary' : 'btn-primary'}>
            {state === 'success' ? 'My adverts' : 'Back to my adverts'}
          </Link>
        </div>
      )}

      {!isAdvert && ['success', 'failed', 'cancelled'].includes(state) && (
        <div className="mt-7 flex gap-3">
          <Button as={Link} to="/dashboard/listings" variant={state === 'success' ? 'outline' : 'primary'}>
            {state === 'success' ? 'View my listings' : 'Try again'}
          </Button>
          {state === 'success' && <Button as={Link} to="/browse">Browse the marketplace</Button>}
        </div>
      )}
    </div>
  );
};

export default PaymentCallback;
