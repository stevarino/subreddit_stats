-- relative active report by subreddit

SELECT subs.name, 
    Min(sub_info.subscribers) AS subscribers_min, 
    Max(sub_info.subscribers) AS subscribers_max, 
    100.0*Avg(sub_info.accounts_active)/Avg(sub_info.subscribers) AS active, 
    100.0*Min(sub_info.accounts_active)/Avg(sub_info.subscribers) AS active_min, 
    100.0*Max(sub_info.accounts_active)/Avg(sub_info.subscribers) AS active_max
 FROM subs 
INNER JOIN sub_info ON subs.id = sub_info.sub_id 
GROUP BY subs.name ORDER BY active DESC;