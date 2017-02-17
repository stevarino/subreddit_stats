-- subreddit active by timestamp (replace subs.name with subreddit)

SELECT 
  sub_info.id,
  DateTime(timestamp/1000,'unixepoch','localtime') AS dt, 
  100.0*sub_info.accounts_active/subscribers AS active 
FROM sub_info 
  INNER JOIN subs ON subs.id = sub_info.sub_id
WHERE subs.name = 'SquaredCircle'