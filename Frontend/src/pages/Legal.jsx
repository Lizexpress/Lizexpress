import { useLocation } from 'react-router-dom';

/**
 * Terms, privacy, and refund policy share one component — the layout is
 * identical and only the body differs, so three near-duplicate files would be
 * three places to forget to update.
 *
 * This is placeholder wording written to be honest about what the platform
 * actually does. Have a Nigerian lawyer review it before launch; it is not
 * legal advice and should not ship as-is without that review.
 */
const DOCUMENTS = {
  '/terms': {
    title: 'Terms of Service',
    updated: 'August 2026',
    sections: [
      ['Who we are', 'LizExpress Ltd is a company registered in Nigeria, operating a marketplace where members trade goods and services directly with one another.'],
      ['What LizExpress is', 'We provide the platform on which members list items and arrange swaps. We are not a party to any swap. We do not take custody of items, inspect them, or guarantee their condition, ownership, or fitness for any purpose.'],
      ['Your account', 'You must be at least 18 to hold an account. You are responsible for the accuracy of the information you provide and for keeping your password secure. Accounts are personal and may not be transferred.'],
      ['Identity verification', 'Listing items and messaging other members require a completed identity check. We may decline or revoke verification where a document cannot be validated.'],
      ['Listing fees', 'Publishing a listing incurs a fee calculated from the value you declare. The fee is charged once per listing and is not a commission on the swap. Fees are shown before payment.'],
      ['What you may not list', 'Stolen goods, counterfeits, weapons, controlled substances, live animals, human remains, and anything whose sale or transfer is restricted under Nigerian law. We remove such listings and may suspend the account.'],
      ['Swaps between members', 'Terms of any exchange are agreed between the members involved. We recommend meeting in a public place and inspecting an item before handing over your own. We cannot assist with disputes arising from arrangements made off the platform.'],
      ['Suspension', 'We may suspend or close an account that breaches these terms, and will tell you why.'],
      ['Liability', 'To the extent permitted by Nigerian law, our liability in connection with the service is limited to the fees you have paid us in the preceding twelve months.'],
    ],
  },
  '/privacy': {
    title: 'Privacy Policy',
    updated: 'August 2026',
    sections: [
      ['What we collect', 'Your name, email address, phone number, and location; the identity documents you submit for verification; your listings and messages; and payment records. We also record technical data such as IP address for security and fraud prevention.'],
      ['How we use it', 'To operate your account, verify your identity, process listing fees, deliver notifications, prevent fraud and abuse, and meet our legal obligations.'],
      ['Identity documents', 'Documents you upload for verification are stored in private storage. They are visible only to our verification team, and only while a review is in progress, through links that expire after a few minutes. They are never shown on your profile or shared with other members.'],
      ['What other members see', 'Your name, profile photo, city, verified status, and your listings. Your email address, phone number, full address, and identity documents are never shown to other members.'],
      ['Who we share it with', 'Our payment processor (Flutterwave) for transactions, our email provider (Resend) for messages we send you, and our hosting and database providers. We do not sell your data, and we do not run advertising.'],
      ['How long we keep it', 'Account data for as long as your account is open. Verification records and payment records are retained afterwards where law requires. You may ask us to delete data we are not required to keep.'],
      ['Your rights', 'Under the Nigeria Data Protection Act you may request access to your data, ask us to correct it, or ask us to delete it. Write to support@lizexpressltd.com and we will respond within 30 days.'],
      ['Security', 'Passwords are hashed and never stored in readable form. Verification documents sit in private storage. Access to member data is restricted to staff who need it, and every privileged action is recorded in an audit log.'],
    ],
  },
  '/refund-policy': {
    title: 'Refund Policy',
    updated: 'August 2026',
    sections: [
      ['What the fee covers', 'The listing fee pays for publishing your item on the marketplace. It is charged once, when the listing goes live, and is not a commission on any swap you subsequently agree.'],
      ['When we refund', 'In full, if a technical fault on our side prevented your listing from being published; if you were charged more than once for the same listing; or if we removed your listing for a reason that turns out to be our error.'],
      ['When we do not refund', 'If your listing was published correctly but did not attract an offer, or if you chose to delete it. Publication is the service the fee pays for, and a swap is never guaranteed.'],
      ['Failed payments', 'If a payment does not complete, no fee is taken and your item stays a draft. Where a bank shows a pending charge that never settles with us, it is released by your bank, normally within 5 to 10 working days.'],
      ['How to request one', 'Email support@lizexpressltd.com with the transaction reference from your receipt. We aim to respond within two working days, and approved refunds are returned to the original payment method.'],
    ],
  },
};

const Legal = () => {
  const { pathname } = useLocation();
  const doc = DOCUMENTS[pathname] ?? DOCUMENTS['/terms'];

  return (
    <div className="container-page max-w-3xl py-10 lg:py-16">
      <header className="border-b border-line pb-6">
        <h1 className="text-title font-bold">{doc.title}</h1>
        <p className="mt-2 text-sm text-ink-muted">Last updated {doc.updated}</p>
      </header>

      <div className="mt-8 space-y-8">
        {doc.sections.map(([heading, body]) => (
          <section key={heading}>
            <h2 className="font-display text-lg font-semibold">{heading}</h2>
            <p className="mt-2 leading-relaxed text-ink-soft">{body}</p>
          </section>
        ))}
      </div>

      <p className="mt-10 rounded-xl bg-canvas-sunken px-5 py-4 text-sm leading-relaxed text-ink-muted">
        Questions about this policy? Email{' '}
        <a href="mailto:support@lizexpressltd.com" className="font-medium text-purple-600 hover:underline">
          support@lizexpressltd.com
        </a>
        .
      </p>
    </div>
  );
};

export default Legal;
