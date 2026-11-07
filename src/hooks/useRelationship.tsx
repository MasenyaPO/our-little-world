import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';

export interface Relationship {
  id: string;
  name: string;
  start_date: string;
  invite_code: string | null;
}

interface RelationshipContextType {
  relationshipId: string | null;
  relationship: Relationship | null;
  memberIds: string[];
  /** true once both partners are in the space */
  isComplete: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  renameRelationship: (name: string) => Promise<string | null>;
  regenerateInviteCode: () => Promise<string | null>;
}

const RelationshipContext = createContext<RelationshipContextType>({
  relationshipId: null,
  relationship: null,
  memberIds: [],
  isComplete: false,
  loading: true,
  refresh: async () => {},
  renameRelationship: async () => null,
  regenerateInviteCode: async () => null,
});

export const RelationshipProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [relationshipId, setRelationshipId] = useState<string | null>(null);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setRelationshipId(null);
      setRelationship(null);
      setMemberIds([]);
      setLoading(false);
      return;
    }

    try {
      const { data: membership, error } = await supabase
        .from('relationship_members')
        .select('relationship_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;

      const rid = membership?.relationship_id ?? null;
      setRelationshipId(rid);

      if (rid) {
        const [{ data: rel }, { data: members }] = await Promise.all([
          supabase.from('relationships').select('id, name, start_date, invite_code').eq('id', rid).single(),
          supabase.from('relationship_members').select('user_id').eq('relationship_id', rid),
        ]);
        setRelationship((rel as Relationship) ?? null);
        setMemberIds((members ?? []).map((m: { user_id: string }) => m.user_id));
      } else {
        setRelationship(null);
        setMemberIds([]);
      }
    } catch (err) {
      console.error('Error fetching relationship:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const renameRelationship = async (name: string): Promise<string | null> => {
    const trimmed = name.trim();
    if (!relationshipId || !trimmed) return 'Please enter a name.';
    const { error } = await supabase.from('relationships').update({ name: trimmed }).eq('id', relationshipId);
    if (error) return error.message;
    setRelationship((r) => (r ? { ...r, name: trimmed } : r));
    return null;
  };

  const regenerateInviteCode = async (): Promise<string | null> => {
    const { data, error } = await supabase.rpc('regenerate_invite_code');
    if (error) return null;
    setRelationship((r) => (r ? { ...r, invite_code: data as string } : r));
    return data as string;
  };

  return (
    <RelationshipContext.Provider
      value={{
        relationshipId,
        relationship,
        memberIds,
        isComplete: memberIds.length >= 2,
        loading,
        refresh,
        renameRelationship,
        regenerateInviteCode,
      }}
    >
      {children}
    </RelationshipContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useRelationship = () => useContext(RelationshipContext);
