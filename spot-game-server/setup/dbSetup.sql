DROP SCHEMA if exists app_data cascade;

CREATE SCHEMA app_data;

CREATE TABLE app_data.session_data (
    session_id SERIAL PRIMARY KEY,
    username VARCHAR(18) NOT NULL,
    device_id VARCHAR(32) NOT NULL,
    log_in_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    log_out_time TIMESTAMPTZ
);

CREATE TABLE app_data.game_data (
    game_id SERIAL PRIMARY KEY,
    game_name VARCHAR(64) NOT NULL,
    game_type INT NOT NULL,
    game_duration INT NOT NULL,
    game_bounds VARCHAR(64) NOT NULL DEFAULT 'reston-center',
    game_config JSONB NOT NULL DEFAULT '{}',
    created_by INT DEFAULT 0,
    time_created TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    time_started TIMESTAMPTZ
);

CREATE TABLE app_data.game_status_log (
    game_state_id SERIAL PRIMARY KEY,
    game_id INT NOT NULL,
    game_state BIT(8) NOT NULL DEFAULT B'00000000',
    status_config JSONB NOT NULL DEFAULT '{}',
    log_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_data.player_state_data (
    player_state_id SERIAL PRIMARY KEY,
    game_id INT REFERENCES app_data.game_data,
    session_id INT REFERENCES app_data.session_data,
    team VARCHAR(16),
    player_state BIT(8) NOT NULL DEFAULT B'00000000',
    score NUMERIC NOT NULL DEFAULT 0,
    config JSONB NOT NULL DEFAULT '{}',
    log_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_data.object_data (
    object_id SERIAL PRIMARY KEY,
    game_id INT REFERENCES app_data.game_data,
    object_type VARCHAR(32) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE app_data.object_status (
    pos_id SERIAL PRIMARY KEY,
    session_id INT REFERENCES app_data.session_data,
    object_id INT REFERENCES app_data.object_data,
    object_position GEOMETRY(Geometry, 4326), -- This is null when it gets put in a player's inventory
    object_state BIT(8) NOT NULL DEFAULT B'00000000',
    status_config JSONB NOT NULL DEFAULT '{}',
    log_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_data.geo_data (
    geo_id SERIAL PRIMARY KEY,
    device_id VARCHAR(32) NOT NULL,
    long FLOAT NOT NULL,
    lat FLOAT NOT NULL,
    geom GEOMETRY(Geometry, 4326) NOT NULL,
    accuracy FLOAT,
    speed FLOAT,
    log_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_data.comms_log (
    comm_id SERIAL PRIMARY KEY,
    game_id INT REFERENCES app_data.game_data,
    session_id INT REFERENCES app_data.session_data,
    log_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_data.rules_data (
    rule_id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    game_type INT NOT NULL,
    geom GEOMETRY(Geometry, 4326),
    buffer_geom GEOMETRY(Geometry, 4326),
    config JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT uc_rule_name UNIQUE (rule_name)
);

CREATE TABLE app_data.zone_data (
    zone_id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100),
    zoneA GEOMETRY(Geometry, 4326),
    zoneB GEOMETRY(Geometry, 4326),
    CONSTRAINT fk_rule_name FOREIGN KEY (rule_name) 
    REFERENCES app_data.rules_data(rule_name)
);

CREATE TABLE app_data.camera_data (
    camera_id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100),
    lat FLOAT NOT NULL,
    long FLOAT NOT NULL,
    CONSTRAINT fk_rule_name FOREIGN KEY (rule_name) 
    REFERENCES app_data.rules_data(rule_name)
);


CREATE TABLE app_data.camera_status (
    status_id SERIAL PRIMARY KEY,
    game_id INT, --REFERENCES app_data.game_data,
    camera_id INT REFERENCES app_data.camera_data(camera_id),
    camera_status BIT(4) NOT NULL DEFAULT B'0000',
    camera_diameter INT,
    camera_range GEOMETRY(Geometry, 4326),
    camera_duration INT,
    log_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_data.inventory (
    inv_id SERIAL PRIMARY KEY,
    session_id INT NOT NULL,
    game_id INT NOT NULL,
    object_id INT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE app_data.flag_location_data (
    loc_id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100),
    team VARCHAR(32),
    geom GEOMETRY(Geometry, 4326),
    config JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT fk_rule_name FOREIGN KEY (rule_name) 
    REFERENCES app_data.rules_data(rule_name)
);


-- Rule Data --
INSERT INTO app_data.rules_data (rule_name, game_type, geom, buffer_geom, config) 
VALUES ('reston-center', 0, 
        ST_GeomFromGeoJSON('
        {
            "type": "Polygon",
            "coordinates": [
                [
                    [-77.3627387352907, 38.95724318049824],
                    [-77.35864905522935, 38.95721804058803],
                    [-77.35698408666735, 38.95749457911077],
                    [-77.3555292597684, 38.957507149017914],
                    [-77.3549833634331, 38.95740687003013],
                    [-77.35473, 38.95898687003013],
                    [-77.35460757282104, 38.96006181487874],
                    [-77.35674147100248, 38.960394659538935],
                    [-77.35933918035562, 38.96049352875673],
                    [-77.36168748064131, 38.960413206692124],
                    [-77.36299781494932, 38.96039825170163],
                    [-77.36315904184957, 38.95926293899245],
                    [-77.36315240797023, 38.95847163516811],
                    [-77.36288049092167, 38.95767902915284],
                    [-77.3627387352907, 38.95724318049824]
                ]
            ]
        }
        '), 
        '{"type":"Polygon","coordinates":[[[-77.362850542,38.957221012],[-77.362992113,38.957656292],[-77.363263837,38.958448331],[-77.363267763,38.958471046],[-77.363274398,38.959262349],[-77.363273698,38.959272864],[-77.363112473,38.960408177],[-77.363107429,38.960426324],[-77.363097726,38.960443277],[-77.363083776,38.960458317],[-77.363066173,38.960470804],[-77.363045664,38.960480206],[-77.363023121,38.960486126],[-77.362999502,38.96048831],[-77.361690849,38.960503246],[-77.359344228,38.96058351],[-77.359333565,38.96058349],[-77.356735852,38.960484621],[-77.356718872,38.960482982],[-77.354584971,38.960150137],[-77.354562002,38.960144558],[-77.354541015,38.96013538],[-77.354522922,38.960123004],[-77.354508509,38.960107968],[-77.354498404,38.960090925],[-77.354493045,38.960072616],[-77.354492666,38.960053837],[-77.354615095,38.958978892],[-77.354615535,38.958975681],[-77.354868901,38.957395681],[-77.354873538,38.957379315],[-77.354881979,38.957363903],[-77.354893932,38.95734998],[-77.354908981,38.957338027],[-77.354926607,38.957328458],[-77.354946198,38.957321605],[-77.354967076,38.957317704],[-77.354988519,38.957316892],[-77.355009782,38.957319196],[-77.355542017,38.957416965],[-77.356971322,38.957404616],[-77.358625052,38.957129944],[-77.358649966,38.957127976],[-77.362739641,38.957153116],[-77.362761155,38.95715483],[-77.362781882,38.95715965],[-77.362801092,38.957167406],[-77.36281811,38.957177825],[-77.362832339,38.957190541],[-77.362843278,38.957205108],[-77.362850542,38.957221012]]]}',
        '{"area":247879}');

INSERT INTO app_data.rules_data (rule_name, game_type, geom, buffer_geom, config) 
VALUES ('office', 0, 
        ST_GeomFromGeoJSON('
        {
            "type": "Polygon",
            "coordinates": [
            [
                [-77.36564365918399,38.9561029824296],
                [-77.36563833864867,38.95408390409665],
                [-77.36308448167664,38.95405907900516],
                [-77.36286633972688,38.95609884503284],
                [-77.36564365918399,38.9561029824296]
            ]
        ]
        }
        '), 
        '{"type":"Polygon","coordinates":[[[-77.365643441,38.95619305],[-77.362866118,38.956188913],[-77.362842468,38.956186963],[-77.362819834,38.956181269],[-77.362799175,38.956172071],[-77.362781371,38.956159761],[-77.362767179,38.956144863],[-77.3627572,38.956128008],[-77.362751861,38.956109914],[-77.362751386,38.95609135],[-77.362969531,38.954051584],[-77.362973335,38.954034985],[-77.362981035,38.954019231],[-77.36299236,38.954004873],[-77.363006915,38.953992416],[-77.363024188,38.953982295],[-77.363043574,38.953974865],[-77.363064395,38.953970387],[-77.363085919,38.953969018],[-77.365639773,38.953993843],[-77.365662043,38.953995759],[-77.365683419,38.954000999],[-77.365703094,38.954009368],[-77.365720326,38.954020548],[-77.365734465,38.954034118],[-77.365744977,38.954049567],[-77.365751467,38.954066311],[-77.365753689,38.954083719],[-77.365759012,38.956102797],[-77.365756831,38.956120415],[-77.365750279,38.956137361],[-77.365739609,38.956152978],[-77.365725233,38.956166665],[-77.365707707,38.956177891],[-77.365687707,38.956186225],[-77.365666005,38.956191344],[-77.365643441,38.95619305]]]}',
        '{"area":47076}');       

INSERT INTO app_data.rules_data (rule_name, game_type, geom, buffer_geom, config) 
VALUES ('dan-house', 0, 
        ST_GeomFromGeoJSON('
        {
            "type": "Polygon",
            "coordinates": [
          [
            [-77.35516168719197,38.89084461187531],
            [-77.35516826876182,38.89113331387557],
            [-77.3552610423893,38.89139015412107],
            [-77.35623605075386,38.89097009406504],
            [-77.35593703597004,38.89066483559779],
            [-77.35554899934424,38.89081123312883],
            [-77.35540559629706,38.89083077043591],
            [-77.35516168719197,38.89084461187531]
          ]
        ]
        }
        '), 
        '{"type":"Polygon","coordinates":[[[-77.355157514,38.890799696],[-77.355398544,38.890786018],[-77.355531186,38.890767946],[-77.355911984,38.89062428],[-77.355922532,38.890621251],[-77.355933631,38.89061988],[-77.355944859,38.890620218],[-77.35595579,38.890622253],[-77.355966008,38.890625907],[-77.355975124,38.890631041],[-77.355982792,38.890637461],[-77.356281807,38.890942719],[-77.356287628,38.890950011],[-77.356291571,38.890958035],[-77.356293491,38.890966499],[-77.356293319,38.890975093],[-77.356291061,38.890983505],[-77.356286799,38.890991428],[-77.356280688,38.890998575],[-77.356272951,38.891004684],[-77.35626387,38.891009533],[-77.355288862,38.891429593],[-77.355278285,38.891433125],[-77.35526702,38.891434946],[-77.355255518,38.891434981],[-77.355244236,38.891433231],[-77.355233623,38.891429764],[-77.355224103,38.891424719],[-77.355216055,38.891418297],[-77.355209799,38.891410753],[-77.355205585,38.891402389],[-77.355112812,38.891145549],[-77.355110654,38.891134116],[-77.355104072,38.890845414],[-77.35510491,38.890836917],[-77.355107782,38.890828696],[-77.355112583,38.890821045],[-77.355119143,38.890814237],[-77.355127227,38.890808518],[-77.355136544,38.89080409],[-77.355146762,38.890801114],[-77.355157514,38.890799696]]]}',
        '{"area":3897}'); 

-- Flag Data --

-- Zone A --
INSERT INTO app_data.flag_location_data (rule_name, team, geom)
VALUES 
('reston-center', 'zoneA', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.36095126154933,38.95844091754924]}')),
('reston-center', 'zoneA', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.3605806172482,38.958629184955896]}')),
('reston-center', 'zoneA', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.36053212043758,38.95886488673818]}')),
('reston-center', 'zoneA', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.36181033442729,38.9586694076998]}')),
('reston-center', 'zoneA', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.36050619263084,38.96039694508269]}')),
('reston-center', 'zoneA', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.3618048164672,38.958862358930986]}')),
('reston-center', 'zoneA', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.36160514885759,38.957292394585465]}')),
('reston-center', 'zoneA', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.36056378899465,38.95727068250133]}')),
('reston-center', 'zoneA', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.36054366772487,38.958303350785854]}')),
('reston-center', 'zoneA', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.36156482220031,38.95864757020374]}')),
('reston-center', 'zoneA', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.36151451902371,38.960376465166775]}')),
('reston-center', 'zoneA', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.36307894780234,38.958909645229284]}')),
('reston-center', 'zoneA', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.36288779573289,38.96038819960427]}')),
('reston-center', 'zoneA', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.3627471614069,38.9573026144333]}')),
('reston-center', 'zoneA', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.36050469324942,38.95948997698565]}'));

INSERT INTO app_data.flag_location_data (rule_name, team, geom)
VALUES 
('reston-center', 'zoneB', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.35506790959758,38.959311343073324]}')),
('reston-center', 'zoneB', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.35513909312814,38.957893609144094]}')),
('reston-center', 'zoneB', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.35691373982858,38.95842442681507]}')),
('reston-center', 'zoneB', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.35669770705111,38.9596098388964]}')),
('reston-center', 'zoneB', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.3584456541269,38.95952033757476]}')),
('reston-center', 'zoneB', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.35873476896982,38.9578251434115]}')),
('reston-center', 'zoneB', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.35558131203284, 38.95861628532455]}')),
('reston-center', 'zoneB', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.35676005189204,38.95752125243507]}')),
('reston-center', 'zoneB', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.35669978184599,38.960353120452595]}')),
('reston-center', 'zoneB', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.35839278426516,38.96043830363931]}')),
('reston-center', 'zoneB', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.35845214147295,38.95729969439128]}')),
('reston-center', 'zoneB', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.3546977980749,38.95998252158677]}')),
('reston-center', 'zoneB', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.35706466673847,38.95963635604315]}')),
('reston-center', 'zoneB', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.35710260847465,38.95860841888248]}')),
('reston-center', 'zoneB', ST_GeomFromGeoJSON('{"type": "Point","coordinates": [-77.35553349730466,38.95802752077432]}'));


INSERT INTO app_data.zone_data(rule_name, zoneA, zoneB) 
VALUES
('reston-center', 
ST_GeomFromGEOJSON('{"type":"Polygon","coordinates":[[[-77.362738735,38.95724318],[-77.358601356,38.957215116],[-77.358584262,38.960496844],[-77.35933918,38.960493529],[-77.361687481,38.960413207],[-77.362997815,38.960398252],[-77.363159042,38.959262939],[-77.363152408,38.958471635],[-77.362880491,38.957679029],[-77.362738735,38.95724318]]]}'),
ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-77.358584429,38.960464803],[-77.356741471,38.96039466],[-77.354607573,38.960061815],[-77.35473,38.95898687],[-77.354983363,38.95740687],[-77.35552926,38.957507149],[-77.356984087,38.957494579],[-77.358601299,38.957225973],[-77.358584429,38.960464803]]]}')
),
('office',
  '{"type":"Polygon","coordinates":[[[-77.365643659,38.956102982],[-77.365638339,38.954083904],[-77.363084482,38.954059079],[-77.365643659,38.956102982]]]}',
  '{"type":"Polygon","coordinates":[[[-77.365643659,38.956102982],[-77.363084482,38.954059079],[-77.36286634,38.956098845],[-77.365643659,38.956102982]]]}'
);
-- Session Test Data --
INSERT INTO app_data.session_data (username, device_id, log_in_time, log_out_time)
VALUES
('sam','testID4','2024-05-31 11:06:02.26915','2024-05-31 12:46:02.26915'),
('adam','testID0','2024-05-31 12:46:02.26915','2024-05-31 14:46:02.26915'),
('jack','testID1','2024-05-31 12:48:02.26915','2024-05-31 14:50:02.26915'),
('peter','testID2','2024-05-31 13:06:02.26915','2024-05-31 14:56:02.26915'),
('jeff','testID3','2024-05-31 13:00:02.26915','2024-05-31 15:26:02.26915');
INSERT INTO app_data.session_data (username, device_id, log_in_time)
VALUES
('caleb','caleb',NOW()-INTERVAL'8 minutes'),
('simon','testID0',NOW()-INTERVAL'10 minutes'), 
('brudda','test',NOW()),
('jim','testID1',NOW()-INTERVAL'8 minutes'),
('pam','testID3',NOW()-INTERVAL'8 minutes'), 
('mike','testID2',NOW());

-- Game Test Data --
INSERT INTO app_data.game_data (game_name, game_type, game_duration, game_bounds, time_created)
VALUES 
('Game One', 1, 30, 'reston-center', '2024-05-31 10:00:00'),
('Game Two', 2, 12, 'office', '2024-05-31 18:00:00'),
('Game Three', 1, 9, 'reston-center', '2024-05-31 18:00:00'),
('Game Four', 3, 30, 'office', '2024-06-18 14:40:00'),
('Game Five', 2, 15, 'reston-center', '2024-05-31 18:00:00');

INSERT INTO app_data.game_status_log (game_id, game_state, log_time)
VALUES
(1,'00000001','2024-05-31 10:00:00'),
(1,'00000011','2024-05-31 10:01:00'),
(1,'10000011','2024-05-31 10:05:00'),
(2,'00000001','2024-05-31 18:00:00'),
(2,'00000011',NOW()-INTERVAL'8 minutes'),
(3,'00000001','2024-05-31 18:00:00'),
(3,'00000011',NOW()-INTERVAL'7 minutes'),
(4,'00000001','2024-05-31 18:00:00'),
(5,'00000001','2024-05-31 18:00:00');

-- Player Status Test Data --
INSERT INTO app_data.player_state_data (game_id, session_id, team, player_state, score, log_time)
VALUES
(1,2,'blue','00000001',0,'2024-05-31 10:00:30'),
(1,1,'red','00000001',0,'2024-05-31 10:00:35'),
(1,2,'blue','00000011',0,'2024-05-31 10:00:40'),
(1,1,'red','00000011',0,'2024-05-31 10:00:42'),
(3,7,'blue','00000011',8,'2024-05-31 10:02:30'),
(1,2,'blue','00000011',7,'2024-05-31 10:02:30'),
(1,1,'red','00000011',15,'2024-05-31 10:03:35');
INSERT INTO app_data.player_state_data (game_id, session_id, player_state, score, log_time)
VALUES
(2,6,'00000011',0,NOW()-INTERVAL'8 minutes');
INSERT INTO app_data.player_state_data (game_id, session_id, team, player_state, score, log_time)
VALUES
(3,8,'#00FFFF','00000001',0,NOW()-INTERVAL'4 minutes'),
(3,9,'#FF0000','00000001',0,NOW()-INTERVAL'3 minutes'),
(3,8,'#00FFFF','00000011',1,NOW()-INTERVAL'2 minutes'),
(3,9,'#FF0000','00000011',2,NOW()-INTERVAL'2 minutes'),
(3,8,'#00FFFF','00000111',5,NOW()-INTERVAL'1 minutes'),
(3,9,'#FF0000','00000111',7,NOW());

-- Connection Status Test Data --
INSERT INTO app_data.comms_log (session_id, game_id, log_time) VALUES
(8,3,NOW()-INTERVAL'4 minutes'),
(8,3,NOW()-INTERVAL'3.5 minutes'),
(9,3,NOW()-INTERVAL'2.9 minutes'),
(8,3,NOW()-INTERVAL'3 minutes'),
(9,3,NOW()-INTERVAL'2.725 minutes'),
(9,3,NOW()-INTERVAL'2.132 minutes'),
(8,3,NOW()-INTERVAL'2 minutes'),
(8,3,NOW()-INTERVAL'1.5 minutes'),
(9,3,NOW()-INTERVAL'1.3 minutes'),
(8,3,NOW()-INTERVAL'0.5 minutes'),
(9,3,NOW()),
(8,3,NOW());

-- Geo Data --
INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('testID2', -77.357, 38.9586, ST_SetSRID(ST_MakePoint(-77.357, 38.9586), 4326), 13, 2, NOW() - INTERVAL '8 minutes'),
('testID1', -77.357, 38.9586, ST_SetSRID(ST_MakePoint(-77.357, 38.9586), 4326), 13, 2, NOW() - INTERVAL '7.9 minutes'),
('testID1', -77.357, 38.9586, ST_SetSRID(ST_MakePoint(-77.357, 38.9586), 4326), 13, 2, NOW() - INTERVAL '7.8 minutes'),
('testID1', -77.357, 38.9586, ST_SetSRID(ST_MakePoint(-77.357, 38.9586), 4326), 13, 2, NOW() - INTERVAL '7.7 minutes'),
('testID1', -77.357, 38.9586, ST_SetSRID(ST_MakePoint(-77.357, 38.9586), 4326), 13, 2, NOW() - INTERVAL '7.6 minutes'),
('testID1', -77.357, 38.9586, ST_SetSRID(ST_MakePoint(-77.357, 38.9586), 4326), 13, 2, NOW() - INTERVAL '7.5 minutes'),
('testID3', -77.357, 38.9586, ST_SetSRID(ST_MakePoint(-77.357, 38.9586), 4326), 13, 2, NOW() - INTERVAL '7.8325 minutes'),
('testID3', -77.357, 38.9586, ST_SetSRID(ST_MakePoint(-77.357, 38.9586), 4326), 13, 2, NOW() - INTERVAL '7.7325 minutes'),
('testID3', -77.357, 38.9586, ST_SetSRID(ST_MakePoint(-77.357, 38.9586), 4326), 13, 2, NOW() - INTERVAL '7.6325 minutes'),
('testID3', -77.357, 38.9586, ST_SetSRID(ST_MakePoint(-77.357, 38.9586), 4326), 13, 2, NOW() - INTERVAL '7.5325 minutes'),
('testID3', -77.357, 38.9586, ST_SetSRID(ST_MakePoint(-77.357, 38.9586), 4326), 13, 2, NOW() - INTERVAL '7.4325 minutes'),
('testID3', -77.357, 38.9586, ST_SetSRID(ST_MakePoint(-77.357, 38.9586), 4326), 13, 2, NOW() - INTERVAL '7.3325 minutes');

INSERT INTO app_data.geo_data (device_id, long, lat, geom, accuracy, speed, log_time)
VALUES
('dev1', -77.3571, 38.9586, ST_SetSRID(ST_MakePoint(-77.3571, 38.9586), 4326), 13, 2, NOW() - INTERVAL '8 minutes'),
('dev2', -77.3572, 38.9586, ST_SetSRID(ST_MakePoint(-77.3572, 38.9586), 4326), 13, 2, NOW() - INTERVAL '7.9 minutes'),
('dev3', -77.3573, 38.9586, ST_SetSRID(ST_MakePoint(-77.3573, 38.9586), 4326), 13, 2, NOW() - INTERVAL '7.8 minutes'),
('dev4', -77.3574, 38.9586, ST_SetSRID(ST_MakePoint(-77.3574, 38.9586), 4326), 13, 2, NOW() - INTERVAL '7.7 minutes'),
('dev5', -77.3575, 38.9586, ST_SetSRID(ST_MakePoint(-77.3575, 38.9586), 4326), 13, 2, NOW() - INTERVAL '7.6 minutes'),
('dev6', -77.3576, 38.9586, ST_SetSRID(ST_MakePoint(-77.3576, 38.9586), 4326), 13, 2, NOW() - INTERVAL '7.5 minutes'),
('dev7', -77.3577, 38.9586, ST_SetSRID(ST_MakePoint(-77.3577, 38.9586), 4326), 13, 2, NOW() - INTERVAL '7.8325 minutes'),
('dev8', -77.3578, 38.9586, ST_SetSRID(ST_MakePoint(-77.3578, 38.9586), 4326), 13, 2, NOW() - INTERVAL '7.7325 minutes'),
('dev9', -77.3579, 38.9586, ST_SetSRID(ST_MakePoint(-77.3579, 38.9586), 4326), 13, 2, NOW() - INTERVAL '7.6325 minutes'),
('dev10', -77.3580, 38.9586, ST_SetSRID(ST_MakePoint(-77.358, 38.9586), 4326), 13, 2, NOW() - INTERVAL '7.5325 minutes'),
('dev11', -77.3581, 38.9586, ST_SetSRID(ST_MakePoint(-77.3581, 38.9586), 4326), 13, 2, NOW() - INTERVAL '7.4325 minutes'),
('dev12', -77.3582, 38.9586, ST_SetSRID(ST_MakePoint(-77.3582, 38.9586), 4326), 13, 2, NOW() - INTERVAL '7.3325 minutes');


-- Object Data --
-- Insert records into app_data.object_data
INSERT INTO app_data.object_data (game_id, object_type, config)
VALUES 
(3, 'Player Trail', '{"key": "value"}'),          -- Test Case 1
(3, 'Player Trail', '{}'),                        -- Test Case 2
(1, 'Player Trail', '{}'),                        -- Test Case 3
(1, 'Player Trail', '{"another_key": "another_value"}'), -- Test Case 10
(1, 'Player Trail', '{"key1": "value1"}'),        -- Test Case 12
(1, 'Player Trail', '{"key2": "value2"}'),        -- Test Case 12
(1, 'Player Trail', '{"key3": "value3"}');        -- Test Case 12

-- Insert records into app_data.object_status
-- Insert the test cases for session ID 8
INSERT INTO app_data.object_status (session_id, object_id, object_position, log_time)
VALUES 
(8, 1, ST_Buffer(ST_GeomFromText('POINT(30 10)'), 1), '2024-06-19 12:00:00'),  -- Test Case 4
(8, 1, NULL, '2024-06-19 12:00:01'),  -- Test Case 6 (next second after Test Case 4)
(8, 1, ST_Buffer(ST_GeomFromText('POINT(70 50)'), 1), '2024-06-19 12:00:02'),  -- Test Case 11 (next second after Test Case 6)
(8, 1, ST_Buffer(ST_GeomFromText('POINT(90 70)'), 1), '2024-06-19 12:00:03');  -- Test Case 12 (next second after Test Case 11)

-- Insert the test cases for session ID 9
INSERT INTO app_data.object_status (session_id, object_id, object_position, log_time)
VALUES 
(9, 2, NULL, '2024-06-19 12:00:00'),  -- Test Case 5 (same time as Test Case 4 for session ID 8)
(9, 2, ST_Buffer(ST_GeomFromText('POINT(40 20)'), 1), '2024-06-19 12:00:01'),  -- Test Case 7 (next second after Test Case 5)
(9, 2, ST_Buffer(ST_GeomFromText('POINT(80 60)'), 1), '2024-06-19 12:00:02'),  -- Test Case 12 (next second after Test Case 7)
(9, 2, ST_Buffer(ST_GeomFromText('POINT(100 80)'), 1), DEFAULT);  -- Test Case 13 (uses DEFAULT for current timestamp)

-- Insert the additional test cases for session ID 8 and 9 as previously provided
INSERT INTO app_data.object_status (session_id, object_id, object_position, log_time)
VALUES
(8, 1, ST_Buffer(ST_GeomFromText('POINT(30 10)'), 1), DEFAULT), -- Test Case 4
(9, 2, ST_Buffer(ST_GeomFromText('POINT(30.9 10)'), 1), DEFAULT); -- Test Case 5

INSERT INTO app_data.camera_data (rule_name, lat, long)
VALUES ('reston-center', -77.36167639577752, 38.958771566980545),
       ('reston-center', -77.36036845744685, 38.95875489401118),
       ('reston-center', -77.35857808284631, 38.95875489401118),
       ('reston-center', -77.35546904910957,
          38.95872154806065),
       ('reston-center', -77.35685203308229,
          38.95996367412829),
       ('reston-center', -77.3585566412344,
          38.96001369217137),
       ('reston-center', -77.35859952445863,
          38.95788789419353),
       ('reston-center', -77.36034701583455,
          38.95997201047123),
       ('reston-center', -77.36038989905876,
          38.95727098401812),
       ('reston-center', -77.36420759625902,
          38.95485578816414);
-- Assuming game_id = 3 for testing purposes
INSERT INTO app_data.camera_status (game_id, camera_id, camera_status, camera_range)
SELECT 
    3,
    cd.camera_id,
    B'0000', -- Initial camera_status
    ST_SetSRID(ST_MakePoint(cd.lat, cd.long), 4326) AS camera_range
FROM 
    app_data.camera_data cd
WHERE 
    cd.rule_name = 'reston-center';


-- Create a spatial index for rules table
CREATE INDEX idx_rules_data_geom ON app_data.rules_data USING GIST (geom);
CREATE INDEX idx_rules_data_buffer_geom ON app_data.rules_data USING GIST (buffer_geom);
