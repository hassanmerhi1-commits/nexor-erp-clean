ALTER TABLE public.chart_of_accounts
ADD COLUMN IF NOT EXISTS children_count INTEGER NOT NULL DEFAULT 0;

UPDATE public.chart_of_accounts parent
SET children_count = child_counts.count
FROM (
  SELECT parent_id, COUNT(*)::INTEGER AS count
  FROM public.chart_of_accounts
  WHERE parent_id IS NOT NULL
  GROUP BY parent_id
) AS child_counts
WHERE parent.id = child_counts.parent_id;

UPDATE public.chart_of_accounts
SET children_count = 0
WHERE children_count IS NULL;