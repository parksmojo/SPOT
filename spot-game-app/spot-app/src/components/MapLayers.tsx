import { GameCameras, GameStatusData, PlayerStatusData } from "./Interfaces";
import { GameVals as gv } from "./GameVals";
import { ServerFacade } from "./ServerFacade";

// OpenLayers imports
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import { useRef } from "react";
import VectorSource from "ol/source/Vector";
import { Geometry } from "ol/geom";
import VectorLayer from "ol/layer/Vector";
import GeoJSON from "ol/format/GeoJSON";
import TileLayer from "ol/layer/Tile";
import { TileWMS } from "ol/source";

export class MapLayers {

  static userState = '00000000';

  static tint = new Style({
    stroke: new Stroke({
        color: 'rgba(255, 0, 0, 0.2)',
        width: 10
    })
  });

  static outline = new Style({
      stroke: new Stroke({
          color: '#FF0000'
      })
  });

  static getBoundingBox () {
    const gameID = ServerFacade.getGameID();
    console.log('Displaying Bounding Box for Game:', gameID); // This is defined in each function because if it was defined once at the top the gameID would stay as 0
    const url = `http://maps.spot.focalpoint.tech/geoserver/spot/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=spot%3Abounding_box&maxFeatures=50&outputFormat=application%2Fjson&viewparams=game_id:${gameID}`;
    return new VectorLayer({ 
      source: new VectorSource({
          url: url,
          format: new GeoJSON(),
          attributions: '@geoserver',
      }),
      style: function(feature) {
          return [MapLayers.tint, MapLayers.outline];
      }
  });
  }

  static getTerritory () {
    const gameID = 'game_id:' + ServerFacade.getGameID();
    console.log('Making territory layer for game', gameID)
    return new TileWMS({
      attributions: '@geoserver',
      //url: 'http://localhost:8080/geoserver/it.geosolutions/wms?',
      url: 'http://maps.spot.focalpoint.tech/geoserver/spot/wms?',
      params: {
          //'LAYERS': 'it.geosolutions:player-trails',
          'LAYERS': 'spot:territory',
          'viewparams': gameID,
          'time': Date.now()
      },
    })
  }

  static getZones () {
    const gameID = 'game_id:' + ServerFacade.getGameID();
    console.log('Making zone layer for game', gameID);
    return new TileLayer ({
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
  }

  static getCameras() {
    const gameID = ServerFacade.getGameID();
    console.log("Making camera layer for game", gameID);
    return new TileWMS({
            attributions: '@geoserver',
            url: 'http://maps.spot.focalpoint.tech/geoserver/spot/wms?',
            params: {
                'LAYERS': 'spot:cameras',
                'viewparams': gameID,
                'time': Date.now()
            },
            cacheSize: 0,
    })
  }

    static displayPlayers (playerStatusData:PlayerStatusData[] = []) {
        const gameType = ServerFacade.getGameType();
        let players:Feature<Point>[] = [];
        const userSession = ServerFacade.getSession();

        for (let i = 0; i < playerStatusData.length; i++) {
            let fillColor = playerStatusData[i].team ?? '#000000';
            let strokeColor = '#ffffff';
            if(playerStatusData[i].session_id === userSession){
              this.userState = playerStatusData[i].player_state;
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
            console.log("Adding point for", playerStatusData[i].username);
            players.push(playerFeature);
          }
          return players;
    }

    static displayItems (gameData:GameStatusData) {
        let items:Feature<Point>[] = [];
        const placedItems = gameData.placed_items;
        if (placedItems) {
          for(let item of placedItems){
            const itemFeature = new Feature(new Point([item.long,item.lat]));
            let fillColor = '#000000';

            if(item.object_type === 'Pellet'){
                console.log("There's a pellet");
                fillColor = '#FFE135';
            } else if(item.object_type === 'Landmine'){
                    if(this.userState === '00001111'){
                        fillColor = '#454B1B';
                    } else {
                        continue;
                    }
            } else if(item.object_type === 'Trap'){
                if(this.userState === '00001111'){
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
            items.push(itemFeature);
          }
        }
        return items;
    }

    static displayDrops (gameData:GameStatusData) {
        let drops:Feature<Point>[] = [];
        const dropData = gameData.dropData;
        const userSession = ServerFacade.getSession();

        if (dropData) {
          for (let i = 0; i < dropData.length; i++) {
            const coords = [dropData[i].long, dropData[i].lat];
            let fillColor = '#964B00';
            let strokeColor = '#964B00';
            if (dropData[i].status_config.Safe === userSession) { // Is my safe zone
              fillColor = '#00ffff';
              strokeColor = '#00ffff';
            } else { // Is normal drop
              if (dropData[i].status_config.Collector === userSession){ // Is my collection
                fillColor = '#ff0000';
                strokeColor = '#ff0000';
              }
              if ((parseInt(dropData[i].object_state, 2) & 2) > 0) { // Is picked up
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
            drops.push(dropFeature);
          }
        }
        return drops;
    }

    static displayCameras (gameCameras:GameCameras[]) {
        let cameras:Feature<Point>[] = [];
        //const cameras = gameConfig.config.cameras;
        console.log('display', gameCameras)
        
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
          console.log("Adding cameras")
          cameras.push(cameraFeature);
        }
        return cameras;
    }
}