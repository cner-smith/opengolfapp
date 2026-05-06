-- Custom bag — duplicate wedge slots + atomic reorder.
--
-- Issue #151: a player carrying two lob wedges (58° + 60°) or two
-- chippers stored as the same `club_type` couldn't both exist under
-- the original UNIQUE(user_id, club_type). Loosen the constraint so
-- (user_id, club_type, loft) is the slot key. NULLS NOT DISTINCT
-- treats two unspecified-loft entries of the same type as a duplicate
-- so a slot without a loft still can't be added twice silently.
--
-- Issue #155: updateClubOrder fanned out N individual UPDATE round
-- trips via Promise.all — a network drop mid-sequence left
-- sort_order in a half-applied state. Replace the per-row updates
-- with a single SECURITY DEFINER RPC that loops in one transaction.

ALTER TABLE public.user_clubs
  DROP CONSTRAINT IF EXISTS user_clubs_user_club_unique;

CREATE UNIQUE INDEX user_clubs_user_type_loft_unique
  ON public.user_clubs (user_id, club_type, loft) NULLS NOT DISTINCT;

CREATE OR REPLACE FUNCTION public.update_club_order(
  p_user_id uuid,
  p_club_ids uuid[],
  p_orders integer[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ids_len integer := coalesce(array_length(p_club_ids, 1), 0);
  orders_len integer := coalesce(array_length(p_orders, 1), 0);
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF ids_len <> orders_len THEN
    RAISE EXCEPTION 'club_ids and orders length mismatch (% vs %)', ids_len, orders_len;
  END IF;
  IF ids_len = 0 THEN
    RETURN;
  END IF;
  FOR i IN 1..ids_len LOOP
    UPDATE public.user_clubs
       SET sort_order = p_orders[i]
     WHERE id = p_club_ids[i]
       AND user_id = p_user_id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.update_club_order(uuid, uuid[], integer[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_club_order(uuid, uuid[], integer[]) TO authenticated;
