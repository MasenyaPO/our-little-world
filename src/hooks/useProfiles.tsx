import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';
import { useRelationship } from './useRelationship';

export interface Profile {
  id: string;
  display_name: string | null;
  status: string | null;
  status_updated_at: string | null;
  partner_nickname: string | null; // what THIS person calls their partner
}

interface ProfilesContextType {
  me: Profile | null;
  partner: Profile | null;
  /** What I call my partner (my custom nickname, else "Partner") */
  partnerName: string;
  /** "You" for me, the nickname for my partner. Use for author labels. */
  nameFor: (userId: string | null | undefined) => string;
  setMyStatus: (text: string) => Promise<string | null>;
  setPartnerNickname: (name: string) => Promise<string | null>;
  refresh: () => Promise<void>;
}

const noop = async () => null;
const ProfilesContext = createContext<ProfilesContextType>({
  me: null, partner: null, partnerName: 'Partner', nameFor: () => 'Partner',
  setMyStatus: noop, setPartnerNickname: noop, refresh: async () => {},
});

export const ProfilesProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { memberIds } = useRelationship();
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const refresh = useCallback(async () => {
    if (memberIds.length === 0) { setProfiles([]); return; }
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, status, status_updated_at, partner_nickname')
      .in('id', memberIds);
    setProfiles((data as Profile[]) ?? []);
  }, [memberIds]);

  useEffect(() => { refresh(); }, [refresh]);

  const me = profiles.find((p) => p.id === user?.id) ?? null;
  const partner = profiles.find((p) => p.id !== user?.id) ?? null;
  const partnerName = me?.partner_nickname?.trim() || 'Partner';

  const nameFor = useCallback(
    (id: string | null | undefined) => (id && id === user?.id ? 'You' : partnerName),
    [user?.id, partnerName],
  );

  const patchMe = async (patch: Partial<Profile>): Promise<string | null> => {
    if (!user) return 'Not signed in';
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
    if (error) return error.message;
    setProfiles((ps) => ps.map((p) => (p.id === user.id ? { ...p, ...patch } : p)));
    return null;
  };

  const setMyStatus = (text: string) =>
    patchMe({ status: text.trim() || null, status_updated_at: new Date().toISOString() });

  const setPartnerNickname = (name: string) => patchMe({ partner_nickname: name.trim() || null });

  const value = useMemo(
    () => ({ me, partner, partnerName, nameFor, setMyStatus, setPartnerNickname, refresh }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profiles, user?.id, partnerName, nameFor, refresh],
  );

  return <ProfilesContext.Provider value={value}>{children}</ProfilesContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useProfiles = () => useContext(ProfilesContext);
