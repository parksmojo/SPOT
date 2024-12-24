import { IonBadge, IonButton, IonItem, IonLabel, IonList, IonCol, IonAlert, IonCard, IonCardTitle, IonGrid, IonRow, IonCardSubtitle } from '@ionic/react';
import { ServerFacade } from './ServerFacade';
import React, { useEffect, useState } from 'react'
import { useHistory } from 'react-router-dom';


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

const GameList: React.FC = () => {
  const [games, setGames] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<boolean>(false);
  const [joinMessage, setJoinMessage] = useState<string>("");
  const history = useHistory();


  useEffect(() => {
    const fetchGames = async () => {
      try {
        if (ServerFacade.isLoggedIn()) {
          const fetchedGames = await ServerFacade.grabGames();
          setGames(fetchedGames);
        }
      } catch (error: any) {
        setJoinError(true);
        setJoinMessage(error.message)
      }
    };

    fetchGames();
  }, []);

  async function handleJoinGame(gameID: number, name: string, duration: number) {
    console.log("handling join game" + gameID)
    try {
      await ServerFacade.joinGame(gameID, name, duration)
      history.push('/game')
    }
    catch (error: any) {
      setError(error.message)
    }
  }

  if (error) {
    // console.log("Error")
    return <IonCard>{error}</IonCard>; // FIX: This is catching all errors and the join game ones aren't getting to a modal. 
  }

  if (games.length === 0) {
    // console.log("Empty")
    return <IonCard className='empty-message'>No games found. <br /> Refresh to check for more!</IonCard>; // Maybe put "Please refresh"?
  }

  return (
    <>
      {games.map((game: any) => (
        <IonCard key={game.game_id}><IonGrid><IonRow class="ion-align-items-center">
          <IonCol style={{padding: 0}}>
            <IonCardTitle className='game-title'>{game.game_name}</IonCardTitle>
            <IonCardSubtitle className='game-creator'>{game.creator}</IonCardSubtitle>
          </IonCol>
          <IonCol style={{padding: 0}}>
            <div className='game-type'>{gameType(game.game_type)}</div>
            <div className='game-duration'>{game.game_duration} min.</div>
          </IonCol>
          <IonCol  style={{padding: 0}} size='2.1'>
            <IonButton className='join-button' onClick={() => handleJoinGame(game.game_id, game.game_name, game.game_duration)}>Join</IonButton>
          </IonCol>
        </IonRow></IonGrid></IonCard>
      ))}
      <IonAlert
        isOpen={joinError}
        onDidDismiss={() => setJoinError(false)}
        header="Error"
        message={joinMessage}
        buttons={['Dismiss']}
      ></IonAlert>
    </>
  );
}

export default GameList;