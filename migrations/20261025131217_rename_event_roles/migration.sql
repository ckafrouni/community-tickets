UPDATE `event_members` SET `role` = CASE `role` WHEN 'host' THEN 'organizer' WHEN 'door' THEN 'volunteer' ELSE `role` END;
