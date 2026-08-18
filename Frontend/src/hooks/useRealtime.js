import { useEffect, useRef } from 'react';
import { openChannel } from '../lib/supabase.js';

/**
 * Subscribes to one Realtime channel and tears it down on unmount.
 *
 * Handlers live in a ref and are read at dispatch time, so passing an inline
 * arrow function does not rebuild the subscription on every render — a mistake
 * that silently drops messages during the reconnect gap.
 */
export const useRealtimeChannel = (channelName, handlers, { enabled = true } = {}) => {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled || !channelName) return undefined;
    return openChannel(channelName, () => handlersRef.current);
  }, [channelName, enabled]);
};

export default useRealtimeChannel;
