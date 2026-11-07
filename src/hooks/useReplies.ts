import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';
import { useRelationship } from './useRelationship';

export interface Reply {
  id: string;
  created_by: string;
  content: string;
  created_at: string;
  updated_at: string;
  parentId: string;
}

type Config = { table: 'memory_replies' | 'note_replies'; parentColumn: 'memory_id' | 'note_id' };

/** Loads every reply for the space in ONE query and groups them by parent (memory or note). */
export function useReplies({ table, parentColumn }: Config) {
  const { user } = useAuth();
  const { relationshipId } = useRelationship();
  const [byParent, setByParent] = useState<Record<string, Reply[]>>({});

  const load = useCallback(async () => {
    if (!relationshipId) return;
    const { data } = await supabase
      .from(table)
      .select('*')
      .eq('relationship_id', relationshipId)
      .order('created_at', { ascending: true });

    const grouped: Record<string, Reply[]> = {};
    (data ?? []).forEach((row: any) => {
      const parentId = row[parentColumn] as string;
      (grouped[parentId] ||= []).push({ ...row, parentId });
    });
    setByParent(grouped);
  }, [relationshipId, table, parentColumn]);

  useEffect(() => { load(); }, [load]);

  const add = async (parentId: string, content: string): Promise<string | null> => {
    if (!relationshipId || !user || !content.trim()) return 'Write something first.';
    const { error } = await supabase.from(table).insert([
      { relationship_id: relationshipId, [parentColumn]: parentId, created_by: user.id, content: content.trim() },
    ]);
    if (error) return error.message;
    await load();
    return null;
  };

  const edit = async (replyId: string, content: string): Promise<string | null> => {
    if (!content.trim()) return 'A reply can\'t be empty.';
    const { error } = await supabase.from(table).update({ content: content.trim() }).eq('id', replyId);
    if (error) return error.message;
    await load();
    return null;
  };

  const remove = async (replyId: string): Promise<string | null> => {
    const { error } = await supabase.from(table).delete().eq('id', replyId);
    if (error) return error.message;
    await load();
    return null;
  };

  return { byParent, add, edit, remove, reload: load };
}
