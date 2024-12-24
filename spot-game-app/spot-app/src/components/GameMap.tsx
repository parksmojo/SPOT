import React, { useEffect, useRef, useState } from "react";
// Importing OpenLayers tools/classes
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import { useGeographic } from "ol/proj";
import XYZ from 'ol/source/XYZ.js'
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import Point from "ol/geom/Point";
import Feature from "ol/Feature";
import GeoJSON from 'ol/format/GeoJSON'
import ImageLayer from "ol/layer/Image";
import { ImageWMS, TileWMS } from "ol/source";
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import "../components/GameMap.css"
import { ServerFacade } from "./ServerFacade";
import { PlayerStatusData, GameStatusData, GameCameras, gameInfo } from "./Interfaces";
import {bbox as bboxStrategy} from 'ol/loadingstrategy.js';
import TileSource from "ol/source/Tile";
import { GameVals as gv } from "./GameVals";

interface GameMapProps {
  playerStatusData: PlayerStatusData[],
  gameData: GameStatusData | undefined
}

const GameMap: React.FC<GameMapProps> = ({ playerStatusData, gameData }) => {
  const gameCameras = gameData?.cameras;
  const gameType = ServerFacade.getGameType();
  const [map, setMap] = useState<Map | null>(null);
  const sourceRef = useRef<VectorSource>(new VectorSource());
  const userSession = ServerFacade.getSession();
  let userState = '00000000';
  const camerasRef = useRef<VectorSource>(new VectorSource());
  const gameID = 'game_id:' + ServerFacade.getGameID();

  useEffect(() => {
    useGeographic(); // Using geographic projection
    const focusMap: Record<string, [number, number]> = {
      'reston-center': [-77.357, 38.9586],
      'office': [-77.3643, 38.9551],
      'dan-house': [-77.3556, 38.8910]
    };
    const gameInfo : gameInfo = ServerFacade.getGameInfo();
    if(!gameInfo){ return; }
    const initialCoordinates = focusMap[gameInfo.game_bounds]; // Reston Towne Center Coordinates

        // Map tiles
        const mapTile = new TileLayer({
            source: new XYZ({
                url: 'http://tiles.spot.focalpoint.tech/styles/basic-preview/512/{z}/{x}/{y}.png'
                }),
            });

        const points = new VectorLayer({
            source: sourceRef.current,
        });

        // Bounding Box
        const tint = new Style({
            stroke: new Stroke({
                color: 'rgba(255, 0, 0, 0.2)',
                width: 10
            })
        });

        const outline = new Style({
            stroke: new Stroke({
                color: '#FF0000'
            })
        });

        const wmsBoundingBox = new TileLayer ({
          source: new TileWMS({
              attributions: '@geoserver',
              //url: 'http://localhost:8080/geoserver/it.geosolutions/wms?',
              url: 'http://maps.spot.focalpoint.tech/geoserver/spot/wms?',
              params: {
                  //'LAYERS': 'it.geosolutions:reston-center',
                  'LAYERS': 'spot:bounding_box',
                  'viewparams': gameID,
                  'time': Date.now()
              },
              cacheSize: 0,
          }),
        })

        const wmsZones = new TileLayer ({
          source: new TileWMS({
            attributions: '@geoserver',
            url: 'http://maps.spot.focalpoint.tech/geoserver/spot/wms?',
            params: {
                'LAYERS': 'spot:zones',
                'viewparams': gameID
            },
            cacheSize: 0,
          }),
        })

        // Territory
        // console.log("Creating territory", gameID)
        // WMS Layer
        const territorySource = new TileWMS({
          attributions: '@geoserver',
          //url: 'http://localhost:8080/geoserver/it.geosolutions/wms?',
          url: 'http://maps.spot.focalpoint.tech/geoserver/spot/wms?',
          params: {
              'LAYERS': 'spot:territory',
              'viewparams': gameID,
              'time': Date.now()
          },
          cacheSize: 0,
        })
        territorySource.refresh();

        const wmsTerritory = new TileLayer ({
            source: territorySource,
        })
        wmsTerritory.getSource()?.refresh()

        // Clearing the territory layer when the game ends
        const gameState = parseInt(gameData?.game_state ?? '00000000', 2);
        const gameBin =  (gameState & 0b10000000);
        if (gameBin === 0b10000000) {
          console.log('Clearing territory');
          territorySource.clear();
        }

        // console.log("Making camera layer")
        const wmsCameras = new TileLayer ({
            source: new TileWMS({
                attributions: '@geoserver',
                url: 'http://maps.spot.focalpoint.tech/geoserver/spot/wms?',
                params: {
                    'LAYERS': 'spot:cameras',
                    'viewparams': gameID,
                    'time': Date.now()
                },
                cacheSize: 0,
            })
        })
        
        const mainMap = new Map({
        layers: [mapTile, wmsBoundingBox, wmsZones, wmsTerritory, wmsCameras],
        target: "map", // Set the target element where the map will be rendered
        view: new View({
            center: initialCoordinates,
            zoom: 16,
            rotation: Math.PI / 2,
            }),
        });
        /*
        if (((parseInt(gameData.game_state, 2) & 0b111) === 0b111) && gameType === 1) {
            console.log("Displaying territory");
            mainMap.addLayer(wmsTerritory);
        }
        if (((parseInt(gameData.game_state, 2) & 0b111) === 0b111) && gameType === 2) {
            console.log("Displaying camera layer");
            mainMap.addLayer(wmsCameras);
        }
            */
        // console.log("Displaying points");
        mainMap.addLayer(points);
        setMap(mainMap);

        // Updating the map size after a delay in milliseconds
        setTimeout(() => {
        mainMap.updateSize();
        }, 500);
    }, [playerStatusData]);

  useEffect(() => {
    if (map) {
      sourceRef.current.clear();
      displayPlayers();

      if(gameType === gv.DEAD_DROP){
        displayCameras();
        displayDrops();
      } else if(gameType === gv.CHASE_THE_RABBIT){
        displayItems();
      }
    }
  }, [map, playerStatusData, gameCameras]);

  function findUserCoords(players:PlayerStatusData[]){
    for(let player of players){
      if(player.session_id === userSession){
        return [player.long,player.lat];
      }
    }
    return [-77.357, 38.9586];
  }

  const displayPlayers = () => {
    for (let i = 0; i < playerStatusData.length; i++) {
      let fillColor = playerStatusData[i].team ?? '#000000';
      let strokeColor = '#ffffff';
      if(playerStatusData[i].session_id === userSession){
        userState = playerStatusData[i].player_state;
      }
      if(gameType === gv.CHASE_THE_RABBIT){
        const rabbitState = '00001111';
        if(playerStatusData[i].player_state === rabbitState){
          if(playerStatusData[i].session_id === userSession){
            strokeColor = '#964B00';
          } else {
            continue;
          }
        }
      }
      if(gameType === gv.CAPTURE_THE_FLAG) {
        // Changing the stroke color for the user in a game of Capture the Flag
        if (playerStatusData[i].session_id === ServerFacade.getSession()) {
          strokeColor = '#FFD700';
        }
      }
      
      const coords = [playerStatusData[i].long, playerStatusData[i].lat];
      if((parseInt(playerStatusData[i].player_state, 2) & 1) === 0){
        fillColor = '#808080';
      }
      const playerFeature = new Feature(new Point(coords));
      playerFeature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({
              color: fillColor // Fill with user selected color (default to black)
            }),
            stroke: new Stroke({
              color: strokeColor,
              width: 2,
            }),
          }),
        }),
      );
      // console.log("Adding point for", playerStatusData[i].username);
      sourceRef.current.addFeature(playerFeature);
    }
  };

  const displayItems = () => {
    if(!gameData?.placed_items){ return; }
    for(let item of gameData.placed_items){
      const itemFeature = new Feature(new Point([item.long,item.lat]));
      let fillColor = '#000000';

      if(item.object_type === 'Pellet'){
        fillColor = '#FFE135';
      } else if(item.object_type === 'Landmine'){
        if(userState === '00001111'){
          fillColor = '#454B1B';
        } else {
          continue;
        }
      } else if(item.object_type === 'Trap'){
        if(userState === '00001111'){
          continue;
        } else {
          fillColor = '#C0C0C0';
        }
      } else {
        continue;
      }

      itemFeature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 3,
            fill: new Fill({
              color: fillColor
            }),
          }),
        }),
      );
      sourceRef.current.addFeature(itemFeature);
    }
  }

  const displayDrops = () => {
    if(!gameData?.dropData){ return; }
    const drops = gameData.dropData;
    for (let i = 0; i < drops.length; i++) {
      const coords = [drops[i].long, drops[i].lat];
      let fillColor = '#964B00';
      let strokeColor = '#964B00';
      if (drops[i].status_config.Safe === userSession) { // Is my safe zone
        fillColor = '#00ffff';
        strokeColor = '#00ffff';
      } else { // Is normal drop
        if (drops[i].status_config.Collector === userSession){ // Is my collection
          fillColor = '#ff0000';
          strokeColor = '#ff0000';
        }
        if ((parseInt(drops[i].object_state, 2) & 2) > 0) { // Is picked up
          fillColor = '#ffffff';
        }
      }
      const dropFeature = new Feature(new Point(coords));
      dropFeature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 4,
            fill: new Fill({
              color: fillColor
            }),
            stroke: new Stroke({
              color: strokeColor,
              width: 2,
            }),
          }),
        }),
      );
      //console.log("Adding point for", playerStatusData[i].username);
      sourceRef.current.addFeature(dropFeature);
    }
  }

  /*
  display [{"camera_id":8,"camera_status":"0010","camera_diameter":48,"camera_duration":48,"log_time":"2024-07-23T22:50:59.467Z","lat":-77.36034701583455,"long":38.95997201047123},{"camera_id":9,"camera_status":"0010","camera_diameter":37,"camera_duration":48,"log_time":"2024-07-23T22:50:59.467Z","lat":-77.36038989905876,"long":38.95727098401812},{"camera_id":3,"camera_status":"0010","camera_diameter":36,"camera_duration":52,"log_time":"2024-07-23T22:51:12.094Z","lat":-77.35857808284631,"long":38.95875489401118},{"camera_id":5,"camera_status":"0010","camera_diameter":25,"camera_duration":51,"log_time":"2024-07-23T22:51:24.240Z","lat":-77.35685203308229,"long":38.95996367412829},{"camera_id":2,"camera_status":"0010","camera_diameter":26,"camera_duration":55,"log_time":"2024-07-23T22:51:26.219Z","lat":-77.36036845744685,"long":38.95875489401118},{"camera_id":6,"camera_status":"0010","camera_diameter":31,"camera_duration":35,"log_time":"2024-07-23T22:51:30.085Z","lat":-77.3585566412344,"long":38.96001369217137},{"camera_id":10,"camera_status":"0001","camera_diameter":34,"camera_duration":38,"log_time":"2024-07-23T22:51:35.983Z","lat":-77.36420759625902,"long":38.95485578816414},{"camera_id":1,"camera_status":"0010","camera_diameter":20,"camera_duration":53,"log_time":"2024-07-23T22:51:41.439Z","lat":-77.36167639577752,"long":38.958771566980545},{"camera_id":4,"camera_status":"0010","camera_diameter":20,"camera_duration":21,"log_time":"2024-07-23T22:51:41.439Z","lat":-77.35546904910957,"long":38.95872154806065}]
  */
  const displayCameras = () => {
    if(!gameCameras){ return; }
    
    //const cameras = gameConfig.config.cameras;
    // console.log('display', gameCameras)
    
    for (let i = 0; i < gameCameras.length; i++) {
      const coords = [gameCameras[i].lat, gameCameras[i].long];
      //console.log('coords', coords)
      const color = '#FF0000'
      const cameraFeature = new Feature(new Point(coords));
      //console.log(gameCameras[i].camera_status)
      const camStat = parseInt(gameCameras[i].camera_status, 2)

      //console.log(camStat)
      if (gameCameras[i].camera_status === '0010') {
        //console.log('fired up',camStat)

        cameraFeature.setStyle(
            new Style({
                image: new CircleStyle({
                    radius: 5,
                    fill: new Fill({
                        color: 'red' // Fill with user selected color (default to black)
                    }),
                    stroke: new Stroke({
                    color: '#000000',
                    width: 2,
                    }),
                }),
            }),
        );
      }
      else if (gameCameras[i].camera_status === '0001') {
        //console.log('warming up')
        cameraFeature.setStyle(
            new Style({
                image: new CircleStyle({
                    radius: 5,
                    fill: new Fill({
                        color: 'yellow' // Fill with user selected color (default to black)
                    }),
                    stroke: new Stroke({
                    color: '#000000',
                    width: 2,
                    }),
                }),
            }),
        );
        
        }
        else {
            //console.log('camera is offline??')
        }
      //console.log("Adding cameras")
      sourceRef.current.addFeature(cameraFeature);
    }
  }
  return (
    <div
      id="map"
      className="map"
      style={{ minHeight: "100px", height: "100%", width: "100%" }}>
    </div>
  );
};

export default GameMap;