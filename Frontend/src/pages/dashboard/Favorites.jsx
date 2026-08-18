import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { ItemGrid } from '../../components/items/ItemGrid.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { endpoints } from '../../lib/api.js';

const Favorites = () => {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    endpoints.items
      .favorites({ limit: 40 })
      // The API returns favourite rows wrapping the item.
      .then(({ data }) => setItems(data.map((entry) => entry.item).filter(Boolean)))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="container-page py-8 lg:py-12">
      <h1 className="mb-6 text-title font-bold">Saved items</h1>
      <ItemGrid
        items={items}
        isLoading={isLoading}
        empty={
          <EmptyState
            icon={Heart}
            title="Nothing saved yet"
            description="Tap the heart on any listing to keep it here for later."
            action={<Button as={Link} to="/browse">Browse the marketplace</Button>}
          />
        }
      />
    </div>
  );
};

export default Favorites;
