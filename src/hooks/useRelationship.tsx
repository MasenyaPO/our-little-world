import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';

interface RelationshipContextType {
  relationshipId: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const RelationshipContext = createContext<RelationshipContextType>({
  relationshipId: null,
  loading: true,
  refresh: async () => {},
});

export const RelationshipProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [relationshipId, setRelationshipId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRelationship = async () => {
    if (!user) {
      setRelationshipId(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('relationship_members')
        .select('relationship_id')
        .eq('user_id', user.id)
        .maybeSingle(); // Returns 1 row or null without throwing an error

      if (error && error.code !== 'PGRST116') throw error;
      setRelationshipId(data?.relationship_id || null);
    } catch (err) {
      console.error('Error fetching relationship:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRelationship();
  }, [user]);

  return (
    <RelationshipContext.Provider value={{ relationshipId, loading, refresh: fetchRelationship }}>
      {children}
    </RelationshipContext.Provider>
  );
};

export const useRelationship = () => useContext(RelationshipContext);