import { useEffect, useRef, useState } from "react";
import { ServerFacade } from "../components/ServerFacade";
import { useHistory } from "react-router-dom";
import { GameStatusData, PlayerStatusData, cameraInfo, inventoryItem, GameCameras, gameInfo} from "../components/Interfaces";
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
import {bbox as bboxStrategy} from 'ol/loadingstrategy.js';
import TileSource from "ol/source/Tile";
import { Tile } from "ol";
import { useIonViewDidEnter, useIonViewWillEnter, useIonViewWillLeave } from "@ionic/react";
import { MapLayers } from "./MapLayers";
import { GameVals as gv } from "./GameVals";

const TestMap: React.FC = () => {
    const gameLoopRef = useRef<NodeJS.Timeout | null>(null);

    // Map layers
    const playerRef = useRef<VectorSource>(new VectorSource());
    const itemsRef = useRef<VectorSource>(new VectorSource());
    const dropsRef = useRef<VectorSource>(new VectorSource());
    const cameraPointsRef = useRef<VectorSource>(new VectorSource());
    const cameraZonesRef = useRef<TileWMS>(new TileWMS());
    const territoryRef = useRef<TileWMS>(new TileWMS());

    // Start Game Comms
    useIonViewWillEnter(() => {
        gameLoopRef.current = setInterval(async () => {
            //if ((parseInt(ServerFacade.getGameState(), 2) & 0b1000000) !== 0b1000000) {
            console.log('Game loop running another iteration');
            await gameLoop();
            console.log('New Comms:\t', ServerFacade.currGameComm);
            //}
        }, 5000)
    });

    useIonViewDidEnter(() => {
        console.log('Adding Bounding Box');
        mainMap.addLayer(MapLayers.getBoundingBox());
        mainMap.getView().setCenter(focusMap[ServerFacade.getGameInfo().game_bounds]);
    })

    // End Game Comms
    useIonViewWillLeave(() => {
        if (gameLoopRef.current) {
            console.log('Ending Game Loop');
            clearInterval(gameLoopRef.current);
            gameLoopRef.current = null;
            ServerFacade.resetCurrGameComm();

            console.log('Removing layers');
            mainMap.setLayers([mapTile, points]);

            itemsRef.current.clear();
            dropsRef.current.clear();
            cameraPointsRef.current.clear();
        }
    })

    const mapTile = new TileLayer({
        source: new XYZ({
            url: 'http://tiles.spot.focalpoint.tech/styles/basic-preview/512/{z}/{x}/{y}.png'
            }),
    });

    const focusMap: Record<string, [number, number]> = {
        'reston-center': [-77.357, 38.9586],
        'office': [-77.3643, 38.9551],
        'dan-house': [-77.3556, 38.8910]
    };

    const points = new VectorLayer({
        source: playerRef.current,
    });

    const items = new VectorLayer({
        source: itemsRef.current,
    })

    const drops = new VectorLayer({
        source: dropsRef.current,
    })

    const cameras = new VectorLayer({
        source: cameraPointsRef.current,
    })

    let mainMap = new Map({});
    // Map would initially be created here
    const map = () => {
        // Map tiles
        useGeographic(); // Using geographic projection
        mainMap = new Map({
            layers: [mapTile],
            target: "map", // Set the target element where the map will be rendered
            view: new View({
                zoom: 16,
                rotation: Math.PI / 2,
                }),
            });

        if (ServerFacade.getGameType() === gv.CAPTURE_THE_FLAG) {
            mainMap.addLayer(MapLayers.getZones());
        }

        // Updating the map size after a delay in milliseconds
        setTimeout(() => {
            mainMap.updateSize();
            }, 500);
    }

    // Main game loop
    async function gameLoop() {
        try {
            await ServerFacade.gameComms();
        } catch (err:any) {
          console.error('Error encountered in game loop.', err);
        } 
      }

    // Mounts the Map
    useEffect(() => {
        console.log('Mounting map');
        map();
    }, [ServerFacade.gameInfo]);

    // Drops
    useEffect(() => {
        if (ServerFacade.getGameType() === gv.DEAD_DROP) {
            dropsRef.current.clear();
            const gsd = ServerFacade.currGameComm?.gameStatusData;
            if (gsd) {
                const allDrops = MapLayers.displayDrops(gsd);
                dropsRef.current.addFeatures(allDrops);
                mainMap.addLayer(drops);
                console.log('Updating Drop Data Layer');
            }
        }
    }), [ServerFacade.currGameComm?.gameStatusData.dropData];


    // Cameras
    useEffect(() => {
        if (ServerFacade.getGameType() === gv.DEAD_DROP) {
            cameraPointsRef.current.clear();
            const cams = ServerFacade.currGameComm?.gameStatusData.cameras;
            if (cams) {
                cameraZonesRef.current.refresh();
                cameraZonesRef.current = MapLayers.getCameras();
                const completeCams = new TileLayer ({
                    source: cameraZonesRef.current
                })
                mainMap.addLayer(completeCams);

                const cameraPoints = MapLayers.displayCameras(cams);
                cameraPointsRef.current.addFeatures(cameraPoints);
                mainMap.addLayer(cameras)
                console.log('Updating Camera Layers');
            }
        }
    }), [ServerFacade.currGameComm?.gameStatusData.cameras];

    // Player Points and Territory
    useEffect(() => {
        // King Of the Hill Territory
        if (ServerFacade.getGameType() === gv.KING_OF_THE_HILL) {
            territoryRef.current.refresh(); // Experiment with this in different places
            territoryRef.current = MapLayers.getTerritory();
            const territory = new TileLayer ({
                source: territoryRef.current
            })
            mainMap.addLayer(territory);
            console.log('Updating territory layer');
        }

        // Player Points
        const psd = ServerFacade.currGameComm?.playerStatusData
        if (psd) {
            playerRef.current.clear();
            const players = MapLayers.displayPlayers(psd);
            playerRef.current.addFeatures(players);
            mainMap.addLayer(points);
        }
        console.log('Updating Player Points');
    }), [ServerFacade.currGameComm?.playerStatusData];

    // Placed Items
    useEffect(() => {
        if (ServerFacade.getGameType() === gv.CHASE_THE_RABBIT) {
            const gsd = ServerFacade.currGameComm?.gameStatusData;
            if(gsd) {
                itemsRef.current.clear();
                const allItems = MapLayers.displayItems(gsd);
                itemsRef.current.addFeatures(allItems);
                mainMap.addLayer(items);
                console.log('Updating Item Layer');
            }
        }
    }), [ServerFacade.currGameComm?.gameStatusData.placed_items];
    
    return (
        <div
          id="map"
          className="map"
          style={{ minHeight: "100px", height: "100%", width: "100%" }}>
        </div>
      );
};

export default TestMap;