import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, ShieldCheck, PackageOpen } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { ItemGrid } from '../components/items/ItemGrid.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { PageLoader } from '../components/ui/Spinner.jsx';
import { Button } from '../components/ui/Button.jsx';
import { SmartLink } from '../components/ui/SmartLink.jsx';
import { endpoints } from '../lib/api.js';
import { dateLong } from '../lib/format.js';

/**
 * Another member's public profile.
 *
 * Shows only what the API exposes publicly — name, photo, city, verified
 * status, join date, and live listings. Email, phone, full address, and
 * identity documents are never returned by this endpoint.
 */
const PublicProfile = () => {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    endpoints.users
      .public(id)
      .then((data) => active && setProfile(data))
      .catch(() => active && setProfile(null))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  if (isLoading) return <PageLoader label="Loading profile" />;

  if (!profile) {
    return (
      <div className="container-page py-20">
        <EmptyState
          title="Profile not available"
          description="This member may have closed their account."
          action={<Button as={SmartLink} to="/browse">Browse the marketplace</Button>}
        />
      </div>
    );
  }

  const location = [profile.city, profile.state, profile.country].filter(Boolean).join(', ');
  const listings = profile.items ?? [];

  return (
    <div className="container-page max-w-5xl py-8 lg:py-12">
      <header className="flex flex-col items-start gap-4 border-b border-line pb-8 sm:flex-row sm:items-center">
        <Avatar src={profile.avatar_url} name={profile.full_name} size="xl" verified={profile.is_verified} />
        <div className="min-w-0">
          <h1 className="text-title font-bold">{profile.full_name ?? 'LizExpress member'}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-muted">
            {profile.is_verified ? (
              <Badge tone="success" icon={ShieldCheck}>Identity verified</Badge>
            ) : (
              <Badge tone="muted">Not yet verified</Badge>
            )}
            {location && (
              <span className="flex items-center gap-1.5">
                <MapPin size={14} aria-hidden="true" />
                {location}
              </span>
            )}
            {profile.created_at && <span>Joined {dateLong(profile.created_at)}</span>}
          </div>
        </div>
      </header>

      <section className="mt-8">
        <h2 className="mb-5 font-display text-lg font-semibold">
          {listings.length > 0 ? `Available to swap (${listings.length})` : 'Available to swap'}
        </h2>
        <ItemGrid
          items={listings}
          empty={
            <EmptyState
              icon={PackageOpen}
              title="Nothing listed right now"
              description="This member has no live listings at the moment."
            />
          }
        />
      </section>
    </div>
  );
};

export default PublicProfile;
