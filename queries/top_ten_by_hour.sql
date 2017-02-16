-- top ten by relative activity:

SELECT 
  timestamp/3600000*3600 as dt_hour, 
  DateTime(timestamp/3600000*3600,'unixepoch','localtime') AS dt, 
  the_donald.active as The_Donald,
  squared_circle.active as SquaredCircle,
  nba.active as nba,
  GlobalOffensive.active as GlobalOffensive,
  leagueoflegends.active as leagueoflegends,
  soccer.active as soccer,
  DotA2.active as DotA2,
  MMA.active as MMA,
  hearthstone.active as hearthstone,
  dankmemes.active as dankmemes

FROM sub_info 
LEFT JOIN (
  SELECT sub_info.timestamp/3600000*3600 as hour, 
    100.0*Avg(sub_info.accounts_active)/Avg(sub_info.subscribers) as active
  FROM sub_info JOIN subs ON subs.id = sub_info.sub_id
  WHERE subs.name = "The_Donald" 
  GROUP BY hour) as the_donald ON the_donald.hour = dt_hour
LEFT JOIN (
  SELECT sub_info.timestamp/3600000*3600 as hour, 
    100.0*Avg(sub_info.accounts_active)/Avg(sub_info.subscribers) as active
  FROM sub_info JOIN subs ON subs.id = sub_info.sub_id
  WHERE subs.name = "SquaredCircle" 
  GROUP BY hour) as squared_circle ON squared_circle.hour = dt_hour
LEFT JOIN (
  SELECT sub_info.timestamp/3600000*3600 as hour, 
    100.0*Avg(sub_info.accounts_active)/Avg(sub_info.subscribers) as active
  FROM sub_info JOIN subs ON subs.id = sub_info.sub_id
  WHERE subs.name = "nba" 
  GROUP BY hour) as nba ON nba.hour = dt_hour
LEFT JOIN (
  SELECT sub_info.timestamp/3600000*3600 as hour, 
    100.0*Avg(sub_info.accounts_active)/Avg(sub_info.subscribers) as active
  FROM sub_info JOIN subs ON subs.id = sub_info.sub_id
  WHERE subs.name = "GlobalOffensive" 
  GROUP BY hour) as GlobalOffensive ON GlobalOffensive.hour = dt_hour
LEFT JOIN (
  SELECT sub_info.timestamp/3600000*3600 as hour, 
    100.0*Avg(sub_info.accounts_active)/Avg(sub_info.subscribers) as active
  FROM sub_info JOIN subs ON subs.id = sub_info.sub_id
  WHERE subs.name = "leagueoflegends" 
  GROUP BY hour) as leagueoflegends ON leagueoflegends.hour = dt_hour
LEFT JOIN (
  SELECT sub_info.timestamp/3600000*3600 as hour, 
    100.0*Avg(sub_info.accounts_active)/Avg(sub_info.subscribers) as active
  FROM sub_info JOIN subs ON subs.id = sub_info.sub_id
  WHERE subs.name = "soccer" 
  GROUP BY hour) as soccer ON soccer.hour = dt_hour
LEFT JOIN (
  SELECT sub_info.timestamp/3600000*3600 as hour, 
    100.0*Avg(sub_info.accounts_active)/Avg(sub_info.subscribers) as active
  FROM sub_info JOIN subs ON subs.id = sub_info.sub_id
  WHERE subs.name = "DotA2" 
  GROUP BY hour) as DotA2 ON DotA2.hour = dt_hour
LEFT JOIN (
  SELECT sub_info.timestamp/3600000*3600 as hour, 
    100.0*Avg(sub_info.accounts_active)/Avg(sub_info.subscribers) as active
  FROM sub_info JOIN subs ON subs.id = sub_info.sub_id
  WHERE subs.name = "MMA" 
  GROUP BY hour) as MMA ON MMA.hour = dt_hour
LEFT JOIN (
  SELECT sub_info.timestamp/3600000*3600 as hour, 
    100.0*Avg(sub_info.accounts_active)/Avg(sub_info.subscribers) as active
  FROM sub_info JOIN subs ON subs.id = sub_info.sub_id
  WHERE subs.name = "hearthstone" 
  GROUP BY hour) as hearthstone ON hearthstone.hour = dt_hour
LEFT JOIN (
  SELECT sub_info.timestamp/3600000*3600 as hour, 
    100.0*Avg(sub_info.accounts_active)/Avg(sub_info.subscribers) as active
  FROM sub_info JOIN subs ON subs.id = sub_info.sub_id
  WHERE subs.name = "dankmemes" 
  GROUP BY hour) as dankmemes ON dankmemes.hour = dt_hour
WHERE dt_hour >= 1487073600
GROUP BY dt_hour