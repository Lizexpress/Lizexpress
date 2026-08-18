import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Lock, ShieldCheck, Check } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import { Card, CardHeader, CardBody } from '../../components/ui/Card.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { endpoints, ApiError } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { usePush } from '../../hooks/usePush.js';

const Toggle = ({ label, description, checked, onChange, disabled }) => (
  <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
    <span className="min-w-0">
      <span className="block text-sm font-medium text-ink">{label}</span>
      {description && <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{description}</span>}
    </span>
    <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="peer sr-only" />
    <span
      aria-hidden="true"
      className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-line-strong transition peer-checked:bg-purple-600 peer-focus-visible:ring-2 peer-focus-visible:ring-orange-500 peer-focus-visible:ring-offset-2 peer-disabled:opacity-50 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5"
    />
  </label>
);

const Settings = () => {
  const { user, patchUser, refreshUser } = useAuth();
  const toast = useToast();
  const avatarRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [prefs, setPrefs] = useState({});
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const push = usePush({ enabled: true });

  useEffect(() => {
    endpoints.users.me().then((data) => {
      setProfile({
        fullName: data.full_name ?? '',
        phone: data.phone ?? '',
        residentialAddress: data.residential_address ?? '',
        dateOfBirth: data.date_of_birth ?? '',
        gender: data.gender ?? '',
        country: data.country ?? '',
        state: data.state ?? '',
        city: data.city ?? '',
        nationality: data.nationality ?? '',
        avatarUrl: data.avatar_url ?? '',
      });
      setPrefs(data.notification_preferences ?? {});
    });
  }, []);

  const setField = (field) => (event) => {
    setProfile((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const uploadAvatar = async (file) => {
    if (!file) return;
    try {
      const { url } = await endpoints.items.uploadAvatar(file);
      setProfile((current) => ({ ...current, avatarUrl: url }));
      await endpoints.users.update({ avatarUrl: url });
      patchUser({ avatar_url: url });
      toast.success('Photo updated.');
    } catch (error) {
      toast.error(error.message ?? 'Could not upload that photo.');
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setErrors({});
    try {
      await endpoints.users.update(profile);
      await refreshUser();
      toast.success('Profile saved.');
    } catch (caught) {
      if (caught instanceof ApiError) setErrors(caught.fieldErrors);
      toast.error('Some fields need your attention.');
    } finally {
      setIsSaving(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setIsChangingPassword(true);
    try {
      await endpoints.auth.changePassword(passwords);
      setPasswords({ currentPassword: '', newPassword: '' });
      toast.success('Password changed. We have emailed you a confirmation.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not change your password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const savePrefs = async (next) => {
    setPrefs(next);
    await endpoints.users.preferences(next).catch(() => toast.error('Could not save that preference.'));
  };

  if (!profile) return <PageLoader label="Loading your settings" />;

  return (
    <div className="container-page max-w-2xl space-y-6 py-8 lg:py-12">
      <h1 className="text-title font-bold">Profile & settings</h1>

      <Card>
        <CardBody className="flex items-center gap-4">
          <Avatar src={profile.avatarUrl} name={profile.fullName} size="xl" verified={user?.is_verified} />
          <div>
            <Button variant="outline" size="sm" icon={Camera} onClick={() => avatarRef.current?.click()}>
              Change photo
            </Button>
            <p className="mt-1.5 text-xs text-ink-muted">JPG, PNG or WebP, up to 8MB.</p>
            <input
              ref={avatarRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => uploadAvatar(event.target.files?.[0])}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Identity verification"
          action={
            user?.is_verified ? (
              <Badge tone="success" icon={Check}>Verified</Badge>
            ) : (
              <Button as={Link} to="/id-verification" size="sm" icon={ShieldCheck}>Verify now</Button>
            )
          }
        />
        <CardBody>
          <p className="text-sm leading-relaxed text-ink-soft">
            {user?.is_verified
              ? 'Your identity has been confirmed. Your profile shows a verified badge to other members.'
              : 'Verify your identity to unlock listing and messaging, and to show a verified badge on your profile.'}
          </p>
        </CardBody>
      </Card>

      <Card as="form" onSubmit={saveProfile}>
        <CardHeader title="Your details" description="Only your name, photo, and city are shown publicly." />
        <CardBody className="space-y-4">
          <Input label="Full name" value={profile.fullName} onChange={setField('fullName')} error={errors.fullName} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Phone number" value={profile.phone} onChange={setField('phone')} error={errors.phone} placeholder="+234…" />
            <Input label="Date of birth" type="date" value={profile.dateOfBirth} onChange={setField('dateOfBirth')} error={errors.dateOfBirth} />
          </div>
          <Input label="Residential address" value={profile.residentialAddress} onChange={setField('residentialAddress')} error={errors.residentialAddress} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Country" value={profile.country} onChange={setField('country')} error={errors.country} />
            <Input label="State" value={profile.state} onChange={setField('state')} error={errors.state} />
            <Input label="City" value={profile.city} onChange={setField('city')} error={errors.city} />
          </div>
          <Select label="Gender" value={profile.gender} onChange={setField('gender')} error={errors.gender}>
            <option value="">Prefer not to say</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </Select>
          <Button type="submit" isLoading={isSaving} loadingText="Saving">Save changes</Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Notifications" description="Choose how we reach you." />
        <CardBody className="divide-y divide-line py-0">
          <Toggle
            label="Email notifications"
            description="Swap offers, messages, and account updates."
            checked={prefs.email !== false}
            onChange={(event) => savePrefs({ ...prefs, email: event.target.checked })}
          />
          <Toggle
            label="Browser notifications"
            description={
              push.isSupported
                ? 'Get alerted even when LizExpress is closed. Free — no app required.'
                : 'Your browser does not support these.'
            }
            checked={push.isSubscribed}
            disabled={!push.isSupported || push.isBusy}
            onChange={async (event) => {
              if (event.target.checked) {
                const result = await push.subscribe();
                if (!result.ok) {
                  toast.error(
                    result.reason === 'denied'
                      ? 'Your browser blocked notifications. Enable them in site settings to turn this on.'
                      : 'Could not enable browser notifications.',
                  );
                }
              } else {
                await push.unsubscribe();
              }
            }}
          />
          <Toggle
            label="Message emails"
            description="Email me when someone messages me about a listing."
            checked={prefs.email_message !== false}
            onChange={(event) => savePrefs({ ...prefs, email_message: event.target.checked })}
          />
        </CardBody>
      </Card>

      <Card as="form" onSubmit={changePassword}>
        <CardHeader title="Password" description="We will email you whenever it changes." />
        <CardBody className="space-y-4">
          <Input
            label="Current password"
            type="password"
            icon={Lock}
            value={passwords.currentPassword}
            onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))}
            autoComplete="current-password"
            required
          />
          <Input
            label="New password"
            type="password"
            icon={Lock}
            value={passwords.newPassword}
            onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))}
            hint="At least 8 characters, with upper and lowercase letters and a number."
            autoComplete="new-password"
            required
          />
          <Button type="submit" variant="outline" isLoading={isChangingPassword} loadingText="Updating">
            Change password
          </Button>
        </CardBody>
      </Card>
    </div>
  );
};

export default Settings;
