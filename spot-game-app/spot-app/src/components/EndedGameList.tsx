import { IonBadge, IonButton, IonItem, IonLabel, IonList, IonCol, IonAlert, IonCard, IonCardTitle, IonModal, IonHeader, IonButtons, IonContent, IonInput, IonTitle, IonToolbar } from '@ionic/react';
import { ServerFacade } from './ServerFacade';
import React, { useEffect, useRef, useState } from 'react'
import { OverlayEventDetail } from '@ionic/react/dist/types/components/react-component-lib/interfaces';
import ScoreList from './ScoreList';
import { PlayerStatusData } from './Interfaces';


function gameType(type: number) {
  switch (type) {
    case 1:
      return "King of the Hill";
    case 2:
      return "Dead Drop";
    case 3:
      return "Chase the Rabbit"
    case 4:
      return "Capture the Flag"
    default:
      return "Last Intern Standing"
  }
}

const EndedGameList: React.FC = () => {
  const [games, setGames] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<boolean>(false);
  const [joinMessage, setJoinMessage] = useState<string>("");
  const modal = useRef<HTMLIonModalElement>(null);
  const [GameInfoIsOpen, setGameInfoIsOpen] = useState(false);
  const [playerData, setGameInfo] = useState<PlayerStatusData[] | null>(null);
  const [gameTypeNum, setGameType] = useState(0);
  const [selectedGame, setSelectedGame] = useState("");


  useEffect(() => {
    const fetchGames = async () => {
      try {
        if (ServerFacade.isLoggedIn()) {
          const fetchedGames = await ServerFacade.getHistory();
          setGames(fetchedGames);
        }
      } catch (error: any) {
        setJoinError(true);
        setJoinMessage(error.message)
      }
    };

    fetchGames();
  }, []);

  const handleGameInfo = async(game:any) => {
    const playerList = await ServerFacade.getHistoryInfo(game.game_id);
    if(playerList.length === 0){
      setJoinMessage("There was an error retrieving this info. Please don't press that button");
      setJoinError(true);
    } else {
      setSelectedGame(game.game_name);
      setGameInfoIsOpen(true);
      setGameInfo(playerList.sort((a:any, b:any) => b.score - a.score));
      setGameType(game.game_type);
    }
  }

  function onWillDismiss(ev: CustomEvent<OverlayEventDetail>) {
    setGameInfoIsOpen(false)
  }

  if (error) {
    // console.log("Error")
    return <div> {error}</div>; // FIX: This is catching all errors and the join game ones aren't getting to a modal. 
  }

  if (games.length === 0) {
    // console.log("Empty")
    return <div className='empty-message'>No games found. <br></br> Refresh to check for more!</div>; // Maybe put "Please refresh"?
  }

  return (
    <>
      <IonCard>
        <IonCardTitle className='games-title'>Finished Games</IonCardTitle>
        <IonCol>
          Game Name:
        </IonCol>
        <IonCol>
          Game Type:
        </IonCol>
        <IonCol>
          Date:
        </IonCol>
        <IonList>
          {games.map((game: any) => (
            <IonItem key={game.game_id}>
              <IonCol>
                {game.game_name}
              </IonCol>
              <IonCol>
                {gameType(game.game_type)}
              </IonCol>
              <IonCol>
                {game.time_created.substr(5,5)}
              </IonCol>
              <IonButton slot="end" fill="outline" color={"medium"} onClick={() => handleGameInfo(game)}> 
                Info
              </IonButton>
            </IonItem>
          ))}
        </IonList>
        <IonModal ref={modal} isOpen={GameInfoIsOpen} onWillDismiss={(ev) => onWillDismiss(ev)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>{selectedGame}</IonTitle>
              <IonButton slot="end" fill="outline" color={"medium"} onClick={() => modal.current?.dismiss()}>Close</IonButton>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
          <div className='summary-content'>
            <IonBadge className="winner-name" style={{background: playerData ? playerData[0].team : "Error!"}}>
              {playerData ? playerData[0].username : "Error!"}
            </IonBadge>
            <div className="won-text">Won!</div>
            {playerData ? ScoreList(playerData, gameTypeNum) : null}
          </div>
          </IonContent>
        </IonModal>
        <IonAlert
          isOpen={joinError}
          onDidDismiss={() => setJoinError(false)}
          header="Error"
          message={joinMessage}
          buttons={['Dismiss']}
        ></IonAlert>
      </IonCard>
    </>
  );
}

export default EndedGameList;