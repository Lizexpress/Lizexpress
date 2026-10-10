import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card, CardHeader, CardBody } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { endpoints } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const FIELDS = [
  ['listing_fee_percentage', 'Listing fee (%)', 'number', 'Percentage of the item value charged to publish.'],
  ['minimum_listing_fee', 'Minimum listing fee (NGN)', 'number', 'Floor applied to low-value items.'],
  ['max_images_per_item', 'Maximum photos per listing', 'number', ''],
  ['payment_currency', 'Currency', 'text', ''],
  ['advert_duration_days', 'Advert run (days)', 'number', 'How long an approved advert stays on the adverts page.'],
];

const TOGGLES = [
  ['require_kyc_to_list', 'Require identity verification to list', 'When off, unverified members can publish listings.'],
  ['advert_auto_approve', 'Publish adverts as soon as they are paid', 'When off, paid adverts wait in Adverts → Needs approval until an admin approves them.'],
  ['maintenance_mode', 'Maintenance mode', 'Shows a maintenance notice to everyone except staff.'],
];

const AdminSettings = () => {
  const { isSuperAdmin } = useAuth();
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [isSaving, setIsSaving] = useState(null);

  useEffect(() => {
    endpoints.admin.settings().then(setSettings);
  }, []);

  const save = async (key, value) => {
    setIsSaving(key);
    try {
      await endpoints.admin.updateSetting(key, value);
      setSettings((current) => ({ ...current, [key]: value }));
      toast.success('Saved.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(null);
    }
  };

  if (!settings) return <PageLoader />;

  return (
    <>
      <PageHeader title="Platform settings" description="Changes take effect immediately and are recorded in the audit log." />

      {!isSuperAdmin && (
        <div className="mb-5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          These settings are read-only for your role. A super admin can change them.
        </div>
      )}

      <div className="grid max-w-2xl gap-5">
        <Card>
          <CardHeader title="Fees and limits" />
          <CardBody className="space-y-4">
            {FIELDS.map(([key, label, type, hint]) => (
              <div key={key} className="flex items-end gap-2">
                <Input
                  label={label}
                  type={type}
                  hint={hint}
                  defaultValue={settings[key]}
                  disabled={!isSuperAdmin}
                  onBlur={(event) => {
                    const value = type === 'number' ? Number(event.target.value) : event.target.value;
                    if (value !== settings[key]) save(key, value);
                  }}
                />
                {isSaving === key && <Save size={16} className="mb-3 animate-pulse text-purple-500" />}
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Marketplace rules" />
          <CardBody className="divide-y divide-line">
            {TOGGLES.map(([key, label, hint]) => (
              <label key={key} className="flex cursor-pointer items-start justify-between gap-4 py-3">
                <span>
                  <span className="block text-sm font-medium text-ink">{label}</span>
                  <span className="mt-0.5 block text-xs text-ink-muted">{hint}</span>
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(settings[key])}
                  disabled={!isSuperAdmin}
                  onChange={(event) => save(key, event.target.checked)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-line-strong transition peer-checked:bg-purple-600 peer-disabled:opacity-50 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5"
                />
              </label>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
};

export default AdminSettings;
