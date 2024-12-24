import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonMenu,
  IonButton,
  IonButtons,
  IonMenuButton,
  IonFab,
  IonFabButton,
  IonAlert,
  useIonViewWillEnter,
  useIonViewWillLeave,
  IonModal,
  IonCard,
  IonBadge,
  IonIcon,
  useIonLoading,
  useIonToast,
  useIonViewDidEnter,
  IonFabList
} from "@ionic/react";
import "./Game.css";
import GameMap from "../components/GameMap"; // Importing the GameMap
import { useRef, useState, useEffect, SetStateAction } from "react";
import { useHistory } from "react-router-dom";
import { ServerFacade } from "../components/ServerFacade";
import LeaderboardButton from "../components/LeaderboardButton";
import Clock from "../components/Clock";
import { CirclePicker } from 'react-color';
import ScoreList from "../components/ScoreList";
import { locate, server, handRight, cart } from "ionicons/icons";
import { GameVals as gv } from "../components/GameVals";
import { GameStatusData, PlayerStatusData, cameraInfo, gameComms, inventoryItem } from "../components/Interfaces";
import { MdInventory2 } from "react-icons/md";
import { GiLandMine, GiBoxTrap, GiRabbit, GiDropWeapon } from "react-icons/gi";
import { GiFox } from "react-icons/gi";
import { ScreenOrientation } from '@capacitor/screen-orientation';
import TestMap from "../components/TestMap";


const Game: React.FC = () => {
  let runLoop: boolean = false;
  // Redirects a user to the login page if they don't have an active session
  const history = useHistory();
  if (!ServerFacade.isLoggedIn()) {
    console.log('Session not found. Routing to login.');
    runLoop = false;
    history.push('/home');
  }

  async function lockOrientation() {
    await ScreenOrientation.lock({ orientation: 'portrait' });
  }

  // Page vars
  const menuRef = useRef<HTMLIonMenuElement>(null);
  const [iserror, setIsError] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [summaryisOpen, openSummary] = useState(false);
  const [displayColorPicker, openColorPicker] = useState(false);
  const [userColor, setColor] = useState<string | null>(null);

  // General Game vars
  const [playerState, setPlayerState] = useState(0);
  const [ready, setReady] = useState(false);
  const [currGameState, setGameState] = useState<number>(0);
  const [currPSDs, setPSDs] = useState<PlayerStatusData[]>();
  const [currGameData, setGameData] = useState<GameStatusData>();
  const [currCam, setCameras] = useState<cameraInfo[]>();
  const [gameStarted, setGameStarted] = useState(false);

  // Game specific vars
  const [presentToast] = useIonToast();
  const [inventory, setInventory] = useState<inventoryItem[]>([]);
  const ctrMap: Record<string, JSX.Element> = {
    'Landmine': <GiLandMine />,
    'Trap': <GiBoxTrap/>
  };

  // Starts the game loop when the user enters the page
  useIonViewDidEnter(() => {
    console.log('Starting game Loop');
    setReady(false);
    setGameStarted(false);
    if (!runLoop) {
      gameLoop();
    }
  });

  // Makes sure to end the game loop when the user leaves
  useIonViewWillLeave(() => {
    console.log('End game loop');
    runLoop = false;
    setGameState(0);
    setReady(false);
    setPSDs([]);
    setGameData(gv.baseComm.gameStatusData);
    setCameras([]);
    setGameStarted(false);
    setPlayerState(0);
  });
  function getConnectionColor() {
    const ping = ServerFacade.getPing();
    if (ping < 300) {
      return '#06b434';
    } else if (ping < 10000) {
      return '#FFD700';
    } else {
      return 'crimson';
    }
  }

  // Variables for use in the loop
  const commsInterval = 1; // seconds between comms requests
  runLoop = false;
  // Function to delay game loop requests
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  // Main game loop
  async function gameLoop() {
    runLoop = true;
    try {
      for (let i = 0; i <= 1000; i++) { // TODO: When there's confidence that it works, switch to while(runLoop){     
        //console.log(`Game loop running its ${i}th iteration!`);
        const comms = ServerFacade.currGameComm;
        if (comms) {
          parseComms(comms);
        }
        await delay(commsInterval * 1000);
        if (!runLoop) { break; }
      }
    } catch (err:any) {
      console.error('Error encountered in game loop.', err);
      setMessage(err.message);
      setIsError(true);
    } finally {
      runLoop = false;
      history.push('/menu');
    }
  }

  const parseComms = (comms: gameComms) => {
    //console.log("Comms:", comms);
    // Convert from binary string to integer
    const newState = parseInt(comms.gameStatusData.game_state, 2);
    
    if ((parseInt(ServerFacade.getGameState(), 2) & 0b10000010) === 2) { // if currGameState is 'running'
      setupGameStart();
    } else if ((newState & 0b10000000) !== 0) { // Check if game has ended
      setupGameEnd();
    }
    // Updating states
    setGameState(newState);
    setGameData(comms.gameStatusData);
    setPSDs(comms.playerStatusData);

    if (comms.gameStatusData.cameras) {
      setCameras(comms.gameStatusData.cameras);
    }
    if (ServerFacade.getGameType() === gv.CHASE_THE_RABBIT || ServerFacade.getGameType() === gv.DEAD_DROP) {
      grabInventory(comms);
      findPlayerState(comms.playerStatusData);
    }
  };

  function findPlayerState(PSDs: PlayerStatusData[]){
    const sessID = ServerFacade.getSession()
    for(let PSD of PSDs){
      if(PSD.session_id === sessID){
        setPlayerState(parseInt(PSD.player_state, 2));
        break;
      }
    }
  }

  const setupGameStart = () => {
    console.log(`Game started! Time:`, ServerFacade.getStartTime());
    setGameStarted(true);
  };

  const setupGameEnd = () => {
    console.log(`Game ended!`)
    openSummary(true);
  }

  // Ensuring the ready button appears whenever the component mounts
  useEffect(() => {
    setGameStarted(false);
    openSummary(false);
  }, []);

  const avgPlayerDist = () => {
    if(!currPSDs){ throw new Error('Player data not ready yet'); }
    const sessID = ServerFacade.getSession()
    let userPos = {lat:0,long:0};
    let positions = [];
    for(let PSD of currPSDs){
      if(PSD.session_id === sessID){
        userPos = {lat:PSD.lat,long:PSD.long};
      } else {
        positions.push({lat:PSD.lat,long:PSD.long});
      }
    }
    let distSum = 0;
    for(let pos of positions){
      const dist = Math.sqrt((userPos.lat-pos.lat)**2 + (userPos.long-pos.long)**2);
      distSum += dist;
    }
    return distSum / positions.length;
  }

  // Sends ready request
  const hitReady = async () => {
    try {
      // const avgDist = avgPlayerDist();
      // if(!avgDist){ throw new Error('Player distance is unavailable'); }
      // console.log(`Average player distance:`,avgDist);
      // if(ServerFacade.getGameType() === gv.DEAD_DROP){
      //   if(avgDist > gv.DD_STARTING_PLAYER_RANGE){
      //     throw new Error('Players are too far apart to start game. Get closer to start!')
      //   }
      // } else if(ServerFacade.getGameType() === gv.CHASE_THE_RABBIT){
      //   if(avgDist < gv.CR_STARTING_PLAYER_RANGE){
      //     throw new Error('Players are too close to start game. Spread out to start!')
      //   }
      // }
      await ServerFacade.ready(userColor);
      setReady(!ready);
      openColorPicker(false);
      console.log("I'm ready:", !ready);
    }
    catch (error: any) {
      setIsError(true);
      setMessage(error.message)
    }
  };

  // Ready button message
  const readyMessage = () => {
    if (!ready) {
      return "Ready!"
    }
    else {
      const psd = ServerFacade.getPlayerStatusData();
      if (psd) {
        var numReadyPlayers = 0;
        var numPlayers = psd.length
        for (let player of psd) {
          if (player.player_state === "00000011") {
            numReadyPlayers++
          }
        }
        return "" + numReadyPlayers + "/" + numPlayers;
      }
      setIsError(true)
      setMessage("There is no player status data")
    }
  }

  const showColorPicker = () => {
    openColorPicker(!displayColorPicker);
  }
  const pickColor = (color: any) => {
    console.log("Color picked", color.hex);
    setColor(color.hex);
  }

  const checkCanReady = () => {
    const psd = ServerFacade.getPlayerStatusData();
    if(!psd){ return false; }
    const sessID = ServerFacade.getSession()
    let inBounds = false;
    for(let player_state of psd){
      if(player_state.session_id === sessID){
        inBounds = player_state.inBounds;
        break;
      }
    }
    return userColor !== null && inBounds;
  }

  const clickedYes = async () => {
    try {
      openSummary(false);
      setReady(false);
      const game_state = parseInt(ServerFacade.getGameState(), 2);
      if((game_state & 128) === 0){
        await ServerFacade.leaveGame();
      }
    } catch (err) {
      console.error("Error encountered when leaving game.", err);
    } finally {
      menuRef.current?.close();
      history.push('/menu');
    }
  }

  const getWinner = () => {
    const psd = ServerFacade.getPlayerStatusData();
    const winner = psd?.sort((a: any, b: any) => b.score - a.score)[0];
    if (winner) {
      return winner;
    } else {
      return null;
    }
  }

  const handleDrop = () => {
    presentToast({
      position: 'middle',
      message: 'Setting dead drop. Don\'t move or you\'ll have to start over!',
      layout: 'stacked',
      duration: gv.DD_DROP_DELAY * 1000,
      buttons:[{text:'CANCEL DROP',role:'cancel'}],
      onDidDismiss: async (e: CustomEvent) => {
        // Check if the player moved?
        if(e.detail.role !== 'cancel'){
          try {
            if(parseInt(ServerFacade.getGameState(), 2) === 3){
              await ServerFacade.makeDrop();
            }
          } catch (error:any) {
            console.error(error.message,error.cause)
            setIsError(true);
            setMessage(error.message)
          }
        }
      },
    });
  }

  const handlePickup = () => {
    presentToast({
      position: 'middle',
      message: 'Picking up the drop. Don\'t move or you\'ll have to start over!',
      layout: 'stacked',
      duration: gv.DD_COLLECT_DELAY * 1000,
      buttons:[{text:'CANCEL PICKUP',role:'cancel'}],
      onDidDismiss: async (e: CustomEvent) => {
        // Check if the player moved?
        if(e.detail.role !== 'cancel'){
          try {
            await ServerFacade.pickupDrop();
          } catch (error:any) {
            console.error(error.message,error.cause)
            setIsError(true);
            setMessage(error.message)
          }
        }
      },
    });
  }

  // Grabs the inventory for this specific player
  const grabInventory = async (comms: gameComms) => {
    let inventoryItems: inventoryItem[] = [];
    try {
      const players = comms.playerStatusData
      for (let i = 0; i < players.length; i++) {
        if (players[i].session_id === ServerFacade.getSession()) {
          inventoryItems = players[i].inventory;
        }
      }
      if (inventoryItems) {
        // We are excluding pellets from the inventory
        setInventory(inventoryItems.filter(item => item.object_type !== 'Pellet'));
      }
    } 
    catch (error) {
      console.error('Failed to fetch inventory', error);
    }
  }

  const useItem = async (item: string) => {
    try {
      await ServerFacade.placeItem(item);
    } catch (error:any) {
      console.error(error.message, error.cause);
    }
  }

  if (import.meta.env.MODE !== 'development') {
    lockOrientation();
  }
  return (
    <>
      {/* The Side Menu */}
      <IonMenu ref={menuRef} contentId="main-content">
        <IonHeader>
          <IonToolbar>
            <IonTitle>Options</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonButton expand="full" color={"danger"} id="present-alert">Leave Game</IonButton>
          <IonAlert
            trigger="present-alert"
            header="Are you sure?"
            className="custom-alert"
            buttons={[{text: 'No',cssClass: 'alert-button-cancel',},
              {text: 'Yes',cssClass: 'alert-button-confirm',handler: clickedYes},]}
          ></IonAlert>
        </IonContent>
      </IonMenu>
      {/* Main Page */}
      <IonPage id="main-content">
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonMenuButton></IonMenuButton>
            </IonButtons>
            <IonTitle>{ServerFacade.getGameName() ?? "brokey"}</IonTitle>
            <IonTitle slot="secondary">
              <Clock></Clock>
            </IonTitle>
            {ServerFacade.getGameType() === gv.DEAD_DROP && parseInt(ServerFacade.getGameState(), 2) === 3 ? <>
              <IonBadge color={"danger"} slot="secondary">DROP<br/>PHASE</IonBadge>
            </> : null}
            {ServerFacade.getGameType() === gv.DEAD_DROP && parseInt(ServerFacade.getGameState(), 2) === 7 ? <>
              <IonBadge color={"secondary"} slot="secondary">PICKUP<br/>PHASE</IonBadge>
            </> : null}
            {ServerFacade.getGameType() === gv.CHASE_THE_RABBIT && playerState === 7 && parseInt(ServerFacade.getGameState(), 2) > 1 ? <>
              <IonBadge color={"danger"} slot="secondary"><GiFox /></IonBadge>
            </>: null}
            {ServerFacade.getGameType() === gv.CHASE_THE_RABBIT && playerState === 15 && parseInt(ServerFacade.getGameState(), 2) > 1 ? <>
              <IonBadge color={"secondary"} slot="secondary"><GiRabbit /></IonBadge>
            </> : null}
            <IonTitle slot="primary" className="connection-slot">
              <IonIcon icon={server} style={{ color: getConnectionColor() }}></IonIcon>
            </IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          {/* The Map and the Leaderboard */}
          <div className="map-container">
            <TestMap/>
            {displayColorPicker ?
              <IonCard className='color-card'>
                <CirclePicker className='color-picker' circleSpacing={8} width="130px" onChangeComplete={pickColor}></CirclePicker>
              </IonCard>
              : null}
            <div className="leaderboard-card">
              <LeaderboardButton PSDs={ServerFacade.getPlayerStatusData()}></LeaderboardButton>
            </div>
          </div>
          {!gameStarted && (
            <><IonFab horizontal="end" vertical="bottom">
              <IonFabButton disabled={ready} className='color-button' onClick={showColorPicker} color={"light"} >
                <IonBadge className="color-badge" style={{ background: userColor }}>
                  {displayColorPicker ? <>Close<br />Picker</> : <>Pick<br />Color</>}
                </IonBadge>
              </IonFabButton>
              <IonFabButton disabled={!checkCanReady()} className={`ready-button-container ${ready ? 'ready' : 'not-ready'}`} onClick={hitReady}>
                {readyMessage()}
              </IonFabButton>
            </IonFab></>
          )}
          {ServerFacade.getGameType() === 2 && parseInt(ServerFacade.getGameState(), 2) === 3 ? <>
            <IonFab horizontal="end" vertical="bottom">
              <IonFabButton className="drop-button" disabled={inventory.length === 0} onClick={handleDrop}>
                <GiDropWeapon style={{ fontSize: 35 }}/>
              </IonFabButton>
            </IonFab>
          </>: null}

          {ServerFacade.getGameType() === 2 && parseInt(ServerFacade.getGameState(), 2) === 7 ? <>
            <IonFab horizontal="end" vertical="bottom">
              <IonFabButton className="pickup-button" disabled={inventory.length > 0} onClick={handlePickup}>
                <IonIcon icon={handRight}/>
              </IonFabButton>
            </IonFab>
          </>: null}
          {ServerFacade.getGameType() === 3 && gameStarted ?
          <>
            <IonFab slot="fixed" vertical="bottom" horizontal="end">
              <IonFabButton color={"medium"}>
                <MdInventory2/>
              </IonFabButton>
              <IonFabList side="top">
                {inventory.map((item, index) => (
                  <IonFabButton key={index} onClick={() => useItem(item.object_type)} color={"warning"}>
                    {ctrMap[item.object_type]}
                  </IonFabButton>
                ))}
              </IonFabList>
            </IonFab>
          </>: null
          }
          <IonAlert
            isOpen={iserror}
            onDidDismiss={() => setIsError(false)}
            header="Error"
            message={message}
            buttons={['Dismiss']}
          ></IonAlert>
          {/* The Game Summary Modal */}
          <IonModal isOpen={summaryisOpen}>
            <IonHeader>
              <IonToolbar>
                <IonTitle>Game Over!</IonTitle>
              </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding">
              <div className='summary-content'>
                <IonBadge className="winner-name" style={{ background: getWinner()?.team }}>
                  {getWinner()?.username}
                </IonBadge>
                <div className="won-text">Won!</div>
                {ServerFacade.getPlayerStatusData() ? ScoreList(ServerFacade.getPlayerStatusData()?.sort((a: any, b: any) => b.score - a.score), ServerFacade.getGameType()) : null}
              </div>
              <IonButton color="dark" expand="block" slot="fixed" onClick={() => clickedYes()} strong={true}>Back to Menu</IonButton>
            </IonContent>
          </IonModal>
        </IonContent>
      </IonPage>
    </>
  );
};

export default Game;