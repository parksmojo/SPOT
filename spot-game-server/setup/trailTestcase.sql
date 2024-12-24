INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID1', -77.36034688896095, 38.957917329235954, ST_SetSRID(ST_MakePoint(-77.36034688896095, 38.957917329235954), 4326), NULL, NULL, NOW());

INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID1', -77.36033541712342, 38.957917329235954, ST_SetSRID(ST_MakePoint(-77.36033541712342, 38.957917329235954), 4326), NULL, NULL, NOW());

INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID1', -77.36033031019517, 38.95791399817551, ST_SetSRID(ST_MakePoint(-77.36033031019517, 38.95791399817551), 4326), NULL, NULL, NOW());

INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID1', -77.36032368900788, 38.957909493073316, ST_SetSRID(ST_MakePoint(-77.36032368900788, 38.957909493073316), 4326), NULL, NULL, NOW());

INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID1', -77.3603112742827, 38.9579043443851, ST_SetSRID(ST_MakePoint(-77.3603112742827, 38.9579043443851), 4326), NULL, NULL, NOW());

INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID1', -77.36028230659038, 38.957900697397264, ST_SetSRID(ST_MakePoint(-77.36028230659038, 38.957900697397264), 4326), NULL, NULL, NOW());

INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID1', -77.36025664949132, 38.9579148562903, ST_SetSRID(ST_MakePoint(-77.36025664949132, 38.9579148562903), 4326), NULL, NULL, NOW());

INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID1', -77.36016229757911, 38.95790026833953, ST_SetSRID(ST_MakePoint(-77.36016229757911, 38.95790026833953), 4326), NULL, NULL, NOW());

--pg dump later

INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID1', -77.37034688896095, 38.957917329235954, ST_SetSRID(ST_MakePoint(-77.36034688896095, 38.957917329235954), 4326), NULL, NULL, NOW());

INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID1', -77.36033541712342, 38.957917329235954, ST_SetSRID(ST_MakePoint(-77.36033541712342, 38.957917329235954), 4326), NULL, NULL, NOW());

INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID1', -77.36033031019517, 38.95791399817551, ST_SetSRID(ST_MakePoint(-77.36033031019517, 38.95791399817551), 4326), NULL, NULL, NOW());

INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID1', -77.36032368900788, 38.957909493073316, ST_SetSRID(ST_MakePoint(-77.36032368900788, 38.957909493073316), 4326), NULL, NULL, NOW());

INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID1', -77.3603112742827, 38.9579043443851, ST_SetSRID(ST_MakePoint(-77.3603112742827, 38.9579043443851), 4326), NULL, NULL, NOW());

INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID1', -77.36028230659038, 38.957900697397264, ST_SetSRID(ST_MakePoint(-77.36028230659038, 38.957900697397264), 4326), NULL, NULL, NOW());

INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID1', -77.36025664949132, 38.9579148562903, ST_SetSRID(ST_MakePoint(-77.36025664949132, 38.9579148562903), 4326), NULL, NULL, NOW());

INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID1', -77.36016229757911, 38.95790026833953, ST_SetSRID(ST_MakePoint(-77.36016229757911, 38.95790026833953), 4326), NULL, NULL, NOW());

-- Inserting 'testID3' entries with slightly shifted coordinates to ensure intersection
INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID3', -77.36034688896096, 38.957917329235954, ST_SetSRID(ST_MakePoint(-77.36034688896095, 38.957917329235954), 4326), NULL, NULL, NOW());

INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID3', -77.36033541712342, 38.957917329235954, ST_SetSRID(ST_MakePoint(-77.36033541712342, 38.957917329235954), 4326), NULL, NULL, NOW());

INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID3', -77.36033031019517, 38.95791399817551, ST_SetSRID(ST_MakePoint(-77.36033031019517, 38.95791399817551), 4326), NULL, NULL, NOW());

INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID3', -77.36032368900788, 38.957909493073316, ST_SetSRID(ST_MakePoint(-77.36032368900788, 38.957909493073316), 4326), NULL, NULL, NOW());

INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID3', -77.3603112742827, 38.9579043443851, ST_SetSRID(ST_MakePoint(-77.3603112742827, 38.9579043443851), 4326), NULL, NULL, NOW());

INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID3', -77.36028230659038, 38.957900697397264, ST_SetSRID(ST_MakePoint(-77.36028230659038, 38.957900697397264), 4326), NULL, NULL, NOW());

INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID3', -77.36025664949132, 38.9579148562903, ST_SetSRID(ST_MakePoint(-77.36025664949132, 38.9579148562903), 4326), NULL, NULL, NOW());

INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID3', -77.36016229757911, 38.95790026833953, ST_SetSRID(ST_MakePoint(-77.36016229757911, 38.95790026833953), 4326), NULL, NULL, NOW());
